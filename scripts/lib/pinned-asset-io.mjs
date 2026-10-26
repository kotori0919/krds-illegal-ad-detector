/** One full pinned-SHA pass; bounded buffers, no receipt/cache trust shortcut. */
import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { link, rename, rm, stat } from "node:fs/promises";
import { Transform, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { setImmediate } from "node:timers";
import process from "node:process";

const BUFFER_BYTES = 16 * 1024;
const YIELD_BYTES = 1024 * 1024;

async function consumePinnedFile(asset, sink) {
  const { file, bytes, sha256 } = asset;
  const label = asset.label ?? file;
  if (!Number.isSafeInteger(bytes) || bytes < 0 || !/^[a-f0-9]{64}$/.test(sha256 ?? ""))
    throw new Error(`Invalid pinned asset: ${label}`);
  const source = await stat(file);
  if (!source.isFile() || source.size !== bytes) throw new Error(`Pinned asset size changed: ${label}`);
  const hash = createHash("sha256");
  let received = 0; let sinceYield = 0;
  const checksum = new Transform({
    highWaterMark: BUFFER_BYTES,
    transform(chunk, _encoding, callback) {
      received += chunk.length; sinceYield += chunk.length;
      if (received > bytes) { callback(new Error(`Pinned asset size changed: ${label}`)); return; }
      hash.update(chunk);
      if (sinceYield >= YIELD_BYTES) { sinceYield = 0; setImmediate(() => callback(null, chunk)); }
      else callback(null, chunk);
    },
    flush(callback) {
      if (received !== bytes || hash.digest("hex") !== sha256) callback(new Error(`Pinned asset checksum changed: ${label}`));
      else callback();
    },
  });
  await pipeline(createReadStream(file, { highWaterMark: BUFFER_BYTES }), checksum, sink());
}

export async function verifyPinnedFile(asset) {
  await consumePinnedFile(asset, () => new Writable({ highWaterMark: BUFFER_BYTES,
    write(_chunk, _encoding, callback) { callback(); } }));
}

/** Publish only after SHA verification. Link the private temporary entry first
 * so a source-path replacement cannot swap the inode after validation. The
 * cache inode is still assumed immutable, as with the existing hardlink path.
 */
export async function publishPinnedFile(asset, destination, { preferHardlink = false } = {}) {
  const temporary = `${destination}.${process.pid}.${randomUUID()}.tmp`;
  try {
    let linked = false;
    if (preferHardlink) {
      try { await link(asset.file, temporary); linked = true; }
      catch (error) { if (error.code !== "EXDEV") throw error; }
    }
    if (linked) await verifyPinnedFile({ ...asset, file: temporary });
    else await consumePinnedFile(asset, () => createWriteStream(temporary, { flags: "wx", highWaterMark: BUFFER_BYTES }));
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { force: true });
  }
}
