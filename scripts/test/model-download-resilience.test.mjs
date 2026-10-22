import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  DOWNLOAD_ATTEMPTS, DOWNLOAD_TIMEOUT_MS, downloadPinnedAsset,
} from "../lib/model-download.mjs";

const payload = Buffer.alloc(64 * 1024, 0x5a);
const sha256 = createHash("sha256").update(payload).digest("hex");

async function withServer(handler, run) {
  const server = createServer(handler);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    return await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.closeAllConnections?.();
    await new Promise(resolve => server.close(resolve));
  }
}

test("retries stalled and aborted attempts, then accepts verified bytes", async () => {
  assert.equal(DOWNLOAD_ATTEMPTS, 3);
  assert.equal(DOWNLOAD_TIMEOUT_MS, 900_000);
  const cache = await mkdtemp(join(tmpdir(), "krds-model-retry-"));
  const file = join(cache, "model.onnx");
  const lines = [];
  let requests = 0;
  try {
    await withServer((_request, response) => {
      requests += 1;
      response.writeHead(200, { "content-length": String(payload.length) });
      if (requests === 1) { response.write(payload.subarray(0, 1024)); return; } // stall past the timeout
      if (requests === 2) { response.write(payload.subarray(0, 2048)); globalThis.setTimeout(() => response.destroy(), 10); return; }
      response.end(payload);
    }, base => downloadPinnedAsset(
      { file, url: `${base}/model.onnx`, bytes: payload.length, sha256, label: "model.onnx" },
      { timeoutMs: 250, backoffMs: 10, backoffCeilingMs: 20, log: line => lines.push(line) },
    ));
    assert.equal(requests, 3);
    assert.deepEqual(await readFile(file), payload);
    assert.deepEqual(await readdir(cache), ["model.onnx"]);
    assert.equal(lines.length, 3);
    assert.match(lines[0], /\[model\] model\.onnx attempt 1\/3 failed after \d+ms \(1024 bytes\)/);
    assert.match(lines[1], /\[model\] model\.onnx attempt 2\/3 failed after \d+ms \(2048 bytes\)/);
    assert.match(lines[2], /\[model\] model\.onnx attempt 3\/3 ok: 65536 bytes in \d+ms/);
  } finally { await rm(cache, { recursive: true, force: true }); }
});

test("checksum mismatches fail fast without retry or a leftover partial file", async () => {
  const cache = await mkdtemp(join(tmpdir(), "krds-model-corrupt-"));
  const file = join(cache, "model.onnx");
  const lines = [];
  let requests = 0;
  try {
    await withServer((_request, response) => {
      requests += 1;
      response.writeHead(200, { "content-length": String(payload.length) });
      response.end(Buffer.alloc(payload.length, 0x77));
    }, base => assert.rejects(
      downloadPinnedAsset(
        { file, url: `${base}/model.onnx`, bytes: payload.length, sha256, label: "model.onnx" },
        { timeoutMs: 1_000, backoffMs: 10, log: line => lines.push(line) },
      ),
      /checksum mismatch/,
    ));
    assert.equal(requests, 1);
    assert.deepEqual(await readdir(cache), []);
    assert.equal(lines.length, 1);
    assert.match(lines[0], /attempt 1\/3 failed after \d+ms \(65536 bytes\): checksum mismatch/);
  } finally { await rm(cache, { recursive: true, force: true }); }
});

test("HTTP 4xx fails fast without retry", async () => {
  const cache = await mkdtemp(join(tmpdir(), "krds-model-404-"));
  const file = join(cache, "model.onnx");
  const lines = [];
  let requests = 0;
  try {
    await withServer((_request, response) => {
      requests += 1;
      response.writeHead(404, { "content-type": "text/plain" });
      response.end("missing");
    }, base => assert.rejects(
      downloadPinnedAsset(
        { file, url: `${base}/model.onnx`, bytes: payload.length, sha256, label: "model.onnx" },
        { timeoutMs: 1_000, backoffMs: 10, log: line => lines.push(line) },
      ),
      /HTTP 404/,
    ));
    assert.equal(requests, 1);
    assert.deepEqual(await readdir(cache), []);
    assert.match(lines[0], /attempt 1\/3 failed after \d+ms \(0 bytes\): HTTP 404/);
  } finally { await rm(cache, { recursive: true, force: true }); }
});
