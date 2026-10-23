import { createServer } from "node:http";
import { performance } from "node:perf_hooks";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { scanSite } from "../packages/detection/dist/scan.js";
import { validateScanDetailBundle } from "../packages/contracts/dist/index.js";

// Gold labels and model/policy were frozen before any inference on this corpus.
// Browser replay tests collection->OCR->helper->detail, NOT live destination
// reachability. Original click targets are absent from screenshot positives.
const base = new URL("../artifacts/text-embedding-integration-20261021/", import.meta.url);
const holdout = new URL("holdout/", base), output = new URL("runs/", base);
await mkdir(output, { recursive: true });
const primary = JSON.parse(await readFile(new URL("independent-manifest.json", holdout), "utf8"));
const secondary = JSON.parse(await readFile(new URL("manifest.json", holdout), "utf8"));
const groups = { primary: primary.inputs.filter(row => row.kind === "positive"),
  secondary: secondary.inputs.filter(row => row.kind === "positive"), negatives: primary.inputs.filter(row => row.kind === "negative") };
try {
  const supplement = JSON.parse(await readFile(new URL("text-sales-manifest.json", holdout), "utf8"));
  groups.supplement = supplement.inputs;
} catch (error) { if (error.code !== "ENOENT") throw error; }
const assets = new Map();
for (const group of Object.values(groups)) for (const item of group) {
  const bytes = await readFile(new URL(item.file, holdout));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), item.sha256);
  assets.set(`/assets/${item.id}.png`, { bytes, mediaType: item.mediaType ?? "image/png" });
}
const requests = [];
const server = createServer((request, response) => {
  requests.push(request.url);
  const asset = assets.get(request.url);
  if (asset) { response.writeHead(200, { "content-type": asset.mediaType, "content-length": asset.bytes.length }); response.end(asset.bytes); return; }
  const group = groups[request.url.slice(1, -1)];
  if (!group) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { "content-type": "text/html;charset=utf-8" });
  // Same opaque external href for positives AND negatives; no class leakage.
  // Ad marker is controlled and present for every image, never a gold label.
  response.end(`<!doctype html><meta charset="utf-8"><style>a{display:block}img{display:block;max-width:100%}</style>${group.map(item =>
    `<a href="https://observed-offer.example/"><img class="banner" id="${item.id}" src="/assets/${item.id}.png"></a>`).join("")}`);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const launch = chromium.launch.bind(chromium);
if (process.env.KRDS_TEST_UNSANDBOXED === "1") chromium.launch = options => launch({ ...options, chromiumSandbox: false });
const runs = [];
try {
  for (const repetition of [1, 2, 3]) for (const name of Object.keys(groups)) {
    // Alternate order to avoid always assigning warm OS cache to the helper.
    for (const helper of repetition % 2 ? [false, true] : [true, false]) {
      const started = performance.now(); let officialAt;
      const run = await scanSite({ entryUrl: `http://127.0.0.1:${server.address().port}/${name}/`,
        textEmbedding: helper ? undefined : "disabled", commitOfficial: () => { officialAt = performance.now() - started; },
        crawl: { concurrency: 1, settleMs: 20, limits: { maxPages: 1, maxDepth: 0, timeoutSec: 120 } } });
      const elapsedMs = performance.now() - started;
      assert.deepEqual(validateScanDetailBundle(run.detailBundle, run.result, run.extraResult), { ok: true, errors: [] });
      assert.equal(run.result.findings.length, 0, "Image-only helper must not add official concealment findings");
      const found = new Set(run.extraResult.findings.filter(row => row.extra_finding === "IMAGE_ONLY_ILLEGAL_AD").map(row => row.location));
      const byLocation = new Map(run.detailBundle.imageAnalysis.map(row => [row.location, row]));
      const rows = groups[name].map(item => ({ id: item.id, gold: item.goldLabel, kind: item.kind, sha256: item.sha256,
        detected: found.has(`#${item.id}`), analysis: byLocation.get(`#${item.id}`) ?? null }));
      const receipt = { repetition, name, helper, elapsedMs, officialAtMs: officialAt,
        postOfficialMs: elapsedMs - officialAt, detected: rows.filter(row => row.detected).length,
        evaluated: rows.filter(row => row.analysis?.ocr.state === "available").length,
        images: rows, coverage: run.detailBundle.visualAnalysisCoverage, analysisIssues: run.detailBundle.analysisIssues };
      await writeFile(new URL(`${name}-${repetition}-${helper ? "helper" : "baseline"}.json`, output), JSON.stringify({ ...receipt,
        official: run.result, extra: run.extraResult }, null, 2) + "\n");
      assert.equal(receipt.evaluated, groups[name].length, "Every frozen input must be acquired and OCR completed before counting negatives");
      runs.push(receipt);
      console.log(JSON.stringify({ repetition, name, helper, detected: receipt.detected, elapsedMs, officialAtMs: officialAt,
        acquired: receipt.coverage.imagesAcquired, ocrCompleted: receipt.coverage.ocrImagesCompleted,
        helperCompleted: rows.filter(row => row.analysis?.textEmbedding?.state === "available").length }));
    }
  }
  const summary = { protocol: "fixed margin0, same opaque external link condition for all classes, CPU FP32 2 threads;3 paired full scan repetitions; fresh child/model load each helper scan; alternate ordering; no fitting on these labels",
    limitations: primary.limitations, source: "OFFLINE_REAL_PIXELS_CANONICAL_SCAN_REPLAY_NOT_LIVE_SITE", runs, requests };
  await writeFile(new URL("observed.json", base), JSON.stringify(summary, null, 2) + "\n");
} finally {
  chromium.launch = launch; server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
}
