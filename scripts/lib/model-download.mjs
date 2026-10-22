/** Pinned model downloads: per-attempt timeout, bounded retry, hash verification. */
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { rename, rm } from "node:fs/promises";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import process from "node:process";

// The text backbone is 1.08 GiB. A 15-minute ceiling permits ~1.2 MiB/s
// sustained, five times more slack than the previous 3-minute cap that aborted
// a healthy CI stream, while three attempts (2 s + 4 s backoff) stay inside the
// Windows lane's 70-minute job budget.
export const DOWNLOAD_TIMEOUT_MS = 15 * 60_000;
export const DOWNLOAD_ATTEMPTS = 3;
export const DOWNLOAD_BACKOFF_MS = 2_000;
export const DOWNLOAD_BACKOFF_CEILING_MS = 20_000;

const RETRYABLE_STATUS = new Set([408, 429]);
const RETRYABLE_CODES = new Set([
  "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EAI_AGAIN", "ENOTFOUND",
  "ERR_STREAM_PREMATURE_CLOSE", "UND_ERR_SOCKET", "UND_ERR_CONNECT_TIMEOUT",
]);

/** Timeouts, network failures and 5xx/408/429 retry; hashes, sizes and 4xx do not. */
export function isRetryableDownloadError(error) {
  if (error?.fatal) return false;
  if (Number.isInteger(error?.status)) return error.status >= 500 || RETRYABLE_STATUS.has(error.status);
  if (error?.name === "TimeoutError" || error?.name === "AbortError") return true;
  if (error?.name === "TypeError") return true; // fetch failed / terminated
  return RETRYABLE_CODES.has(error?.code) || RETRYABLE_CODES.has(error?.cause?.code);
}

const fatal = error => { error.fatal = true; return error; };

async function attemptDownload({ file, url, bytes, sha256 }, { timeoutMs, fetchImpl }, attempt) {
  const temporary = `${file}.${process.pid}.${attempt}.tmp`;
  let received = 0;
  const hash = createHash("sha256");
  await rm(temporary, { force: true });
  try {
    const response = await fetchImpl(url, { signal: globalThis.AbortSignal.timeout(timeoutMs) });
    if (!response.ok || !response.body) {
      const error = new Error(`HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`);
      error.status = response.status;
      throw error;
    }
    const bounded = new Transform({
      transform(chunk, _encoding, callback) {
        received += chunk.length;
        if (received > bytes) { callback(fatal(new Error(`size exceeded: ${received} > ${bytes} bytes`))); return; }
        hash.update(chunk);
        callback(null, chunk);
      },
    });
    await pipeline(response.body, bounded, createWriteStream(temporary, { flags: "wx" }));
    const actual = hash.digest("hex");
    if (received !== bytes || actual !== sha256)
      throw fatal(new Error(`checksum mismatch: ${received} bytes sha256 ${actual}, expected ${bytes} bytes sha256 ${sha256}`));
    await rename(temporary, file);
  } catch (error) {
    error.received = received;
    throw error;
  } finally {
    await rm(temporary, { force: true });
  }
}

/**
 * Download one pinned asset into `file`, verifying the exact byte count and
 * SHA-256 before the atomic rename. Failures are retried only when transient.
 * Each attempt writes a fresh temp file, so a partial response is never reused.
 */
export async function downloadPinnedAsset(asset, options = {}) {
  const attempts = options.attempts ?? DOWNLOAD_ATTEMPTS;
  const timeoutMs = options.timeoutMs ?? DOWNLOAD_TIMEOUT_MS;
  const backoffMs = options.backoffMs ?? DOWNLOAD_BACKOFF_MS;
  const backoffCeilingMs = options.backoffCeilingMs ?? DOWNLOAD_BACKOFF_CEILING_MS;
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const log = options.log ?? (line => process.stderr.write(`${line}\n`));
  const sleep = options.sleep ?? (ms => new Promise(resolve => globalThis.setTimeout(resolve, ms)));
  const label = asset.label ?? asset.file;
  let last;
  let used = 0;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const startedAt = Date.now();
    used = attempt;
    try {
      await attemptDownload(asset, { timeoutMs, fetchImpl }, attempt);
      log(`[model] ${label} attempt ${attempt}/${attempts} ok: ${asset.bytes} bytes in ${Date.now() - startedAt}ms`);
      return attempt;
    } catch (error) {
      last = error;
      log(`[model] ${label} attempt ${attempt}/${attempts} failed after ${Date.now() - startedAt}ms (${error.received ?? 0} bytes): ${error.message}`);
      if (!isRetryableDownloadError(error) || attempt === attempts) break;
      const delay = Math.min(backoffMs * 2 ** (attempt - 1), backoffCeilingMs);
      await sleep(delay);
    }
  }
  throw new Error(`Pinned asset download failed (${label}, ${used}/${attempts} attempts): ${last.message}`, { cause: last });
}
