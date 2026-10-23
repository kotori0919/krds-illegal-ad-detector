import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { PNG } from "pngjs";
import { scanSite } from "../packages/detection/dist/scan.js";
import { validateOfficialResult, validateExtraResult, validateScanDetailBundle } from "../packages/contracts/dist/index.js";

// Real archived screen pixels, not live-site recall or original GIF bytes.
const root = new URL("../", import.meta.url);
const output = new URL("artifacts/detection-improvement-20261021/corpus/", root);
await mkdir(output, { recursive: true });
const manifest = JSON.parse(await readFile(new URL("fixtures/real-banners/manifest.json", root), "utf8"));
const inputs = await Promise.all(manifest.inputs.map(async item => {
  const bytes = await readFile(new URL(`fixtures/real-banners/${item.file}`, root));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), item.sha256);
  return { ...item, bytes };
}));
const positives = inputs.filter(item => item.kind === "positive");
const negatives = [...inputs.filter(item => item.kind === "negative"), {
  file: "existing-illustration.png", bytes: await readFile(new URL("fixtures/realistic/ads/creative.png", root)),
}];
const blank = new PNG({ width: 206, height: 62 }); blank.data.fill(255);
const firstFrame = PNG.sync.write(blank);
// Derived timing control: white -> actual archived banner pixels -> white.
// It is not a downloaded real-world animation.
const flash = await readFile(new URL("fixtures/real-banners/blacktoon-7-flash.gif", root));
const requests = [];
const assets = new Map([...positives, ...negatives].map(item => [`/${item.file}`, item.bytes]));
assets.set("/first-frame.png", firstFrame); assets.set("/flash.gif", flash);
const destinations = ["https://ch-hhh.com/", "https://gmb-ggg.com/", "https://ygsqnqotwmudafbdgdoggp15wje.com/?agentCode=111",
  "http://rv-0303.com/?ref=bk", "http://mco-ccc.com/", "https://xn--2e0bl66bgoa00e.com/", "https://angbet-2.com/?agentCode=1744", "http://hb-mm.com/"];
const image = (item, index, destination) => `<a href="${destination}"><img class="banner" id="poster-${index + 1}" src="/${item.file}"></a>`;
const server = createServer((request, response) => {
  requests.push(request.url);
  const bytes = assets.get(request.url);
  if (bytes) {
    response.writeHead(200, { "content-type": request.url.endsWith(".gif") ? "image/gif" : "image/png", "content-length": bytes.length });
    response.end(bytes); return;
  }
  const pages = {
    "/positives/": positives.map((item, index) => image(item, index, destinations[index])).join(""),
    "/negatives/": negatives.map((item, index) => image(item, index, "https://ordinary-retailer.example/catalog")).join(""),
    "/flash/": image({ file: "flash.gif" }, 0, destinations[6]),
    "/first-frame/": image({ file: "first-frame.png" }, 0, destinations[6]),
  };
  if (!(request.url in pages)) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { "content-type": "text/html;charset=utf-8" });
  response.end(`<!doctype html>${pages[request.url]}`);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const originalLaunch = chromium.launch.bind(chromium);
if (process.env.KRDS_TEST_UNSANDBOXED === "1") chromium.launch = options => originalLaunch({ ...options, chromiumSandbox: false });
try {
  const runs = {};
  for (const name of ["positives", "negatives", "first-frame", "flash"]) {
    const run = await scanSite({ entryUrl: `http://127.0.0.1:${server.address().port}/${name}/`,
      crawl: { concurrency: 1, settleMs: 20, limits: { maxPages: 1, maxDepth: 0, timeoutSec: 60 } } });
    assert.equal(validateOfficialResult(run.result).ok, true);
    assert.equal(validateExtraResult(run.extraResult).ok, true);
    assert.deepEqual(validateScanDetailBundle(run.detailBundle, run.result, run.extraResult), { ok: true, errors: [] });
    for (const [suffix, value] of [["official", run.result], ["extra", run.extraResult], ["detail", run.detailBundle]]) {
      await writeFile(new URL(`${name}-${suffix}.json`, output), JSON.stringify(value, null, 2) + "\n");
    }
    const found = run.extraResult.findings.filter(item => item.extra_finding === "IMAGE_ONLY_ILLEGAL_AD");
    runs[name] = { found: found.length, locations: found.map(item => item.location),
      coverage: run.detailBundle.visualAnalysisCoverage,
      images: run.detailBundle.imageAnalysis.map(item => ({ sourceUrl: item.sourceUrl, location: item.location,
        animationFrame: item.animationFrame, ocr: item.ocr, matchedTerms: item.matchedTerms, decision: item.decision })) };
  }
  assert(runs.positives.locations.includes("#poster-7"), "Known missed real banner must now be detected");
  assert.equal(runs.negatives.found, 0, "Control images must not produce image-only findings");
  assert.equal(runs["first-frame"].found, 0);
  assert.equal(runs.flash.found, 1);
  assert(runs.flash.images.some(item => item.animationFrame?.index === 1 && item.animationFrame.timestampMs === 40));
  const report = { evidence: "OFFLINE_REAL_SCREEN_PIXEL_CORPUS_AND_DERIVED_ANIMATION_NOT_LIVE_SITE",
    positives: { labelled: 8, detected: runs.positives.found, missed: 8 - runs.positives.found },
    negatives: { labelled: negatives.length, falsePositives: runs.negatives.found, provenance: "four synthetic controls and one existing illustration fixture" },
    animation: { firstFrameDetected: runs["first-frame"].found, multiFrameDetected: runs.flash.found,
      provenance: "synthetic timing around actual archived positive pixels" },
    runs, requests, inputs: manifest.inputs, liveNewtoki: "NOT_RUN: original media unavailable" };
  await writeFile(new URL("observed.json", output), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ positives: report.positives, negatives: report.negatives, animation: report.animation }, null, 2));
} finally {
  chromium.launch = originalLaunch;
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
}
