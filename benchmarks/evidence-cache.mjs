/** Synthetic IPC retention probe, not native Windows memory or image decoding. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import console from "node:console";
import { performance } from "node:perf_hooks";
import { build } from "esbuild";

if (!globalThis.gc) throw new Error("Run with node --expose-gc");
const source = resolve(process.argv[2] ?? "apps/web/src/host/tauri.ts");
const bundle = await build({ entryPoints: [source], bundle: true, write: false, platform: "node", format: "esm",
  plugins: [{ name: "synthetic-ipc", setup(builder) {
    builder.onResolve({ filter: /^@tauri-apps\/api\// }, args => ({ path: args.path, namespace: "synthetic-ipc" }));
    builder.onLoad({ filter: /.*/, namespace: "synthetic-ipc" }, args => ({ contents: args.path.endsWith("/core")
      ? "export const invoke = (...args) => globalThis.krdsEvidenceCacheProbe(...args);"
      : args.path.endsWith("/event") ? "export const listen = async () => () => {};"
        : "export const getCurrentWindow = () => { throw new Error('not a native-window probe'); };" }));
  } }] });
const { TauriHost } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);
let reads = 0;
globalThis.krdsEvidenceCacheProbe = async (_command, { assetId }) => {
  reads++;
  return { assetId, mimeType: "image/jpeg", dataUrl: `data:image/jpeg;base64,${Buffer.alloc(256 * 1024, Number(assetId.slice(6)) % 256).toString("base64")}` };
};
const host = new TauriHost();
globalThis.gc();
const before = process.memoryUsage();
const start = performance.now();
const active = await host.getEvidenceAsset("probe", "asset-0");
const originalHash = createHash("sha256").update(active.dataUrl).digest("hex");
for (let i = 1; i < 96; i++) await host.getEvidenceAsset("probe", `asset-${i}`);
const fillMs = performance.now() - start;
globalThis.gc();
const after = process.memoryUsage();
const callsAfterFill = reads;
await host.getEvidenceAsset("probe", "asset-95");
assert.equal(reads, callsAfterFill, "most recent asset should be reused");
const reloadStart = performance.now();
const reloaded = await host.getEvidenceAsset("probe", "asset-0");
const reloadMs = performance.now() - reloadStart;
assert.equal(createHash("sha256").update(reloaded.dataUrl).digest("hex"), originalHash);
assert.equal(createHash("sha256").update(active.dataUrl).digest("hex"), originalHash);
console.log(JSON.stringify({ scope: "synthetic IPC; Node V8; no native IPC/decode", source,
  sourceSha256: createHash("sha256").update(await readFile(source)).digest("hex"),
  node: process.version, assets: 96, rawBytesEach: 256 * 1024, fillMs, reloadMs, callsAfterFill, readsAfterReopen: reads,
  retainedHeapDelta: after.heapUsed - before.heapUsed, retainedExternalDelta: after.external - before.external,
  retainedRssDelta: after.rss - before.rss, activeAndReloadedBytesEqual: true }));
delete globalThis.krdsEvidenceCacheProbe;
