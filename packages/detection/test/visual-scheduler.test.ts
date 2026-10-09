import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { validateScanDetailBundle } from "@krds-detector/contracts";
import { CaptureStore, VisualScheduler, VISUAL_LIMITS } from "../src/visual-scheduler.js";
import type { CapturedVisualImage } from "../src/creative.js";
import { scanSite } from "../src/scan.js";

function image(index: number): CapturedVisualImage {
  const bytes = Buffer.alloc(8000, index);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const sourceUrl = `https://fixture.invalid/image-${index}.png`;
  return { sourceUrl, sha256, mimeType: "image/png", dataUrl: `data:image/png;base64,${bytes.toString("base64")}`,
    width: 20, height: 20, capturedAt: "2026-10-09T00:00:00Z", candidate: { sourceKind: "img", pageUrl: "https://fixture.invalid/",
      frameUrl: "https://fixture.invalid/", location: `#ad-${index}`, candidateEvidence: ["ad-marker"], visibleDomAdTexts: [] } };
}

it("keeps a bounded deterministic creative set under reordered acquisition", () => {
  const inputs = Array.from({ length: 100 }, (_, index) => ({ pageUrl: `https://fixture.invalid/page-${index}`, image: image(index) }));
  const outputs = [];
  for (const ordered of [inputs, [...inputs].reverse(), [...inputs.slice(50), ...inputs.slice(0, 50)]]) {
    const scheduler = new VisualScheduler();
    for (const entry of ordered) scheduler.offer(entry.pageUrl, [entry.image], [{ sourceUrl: entry.image.sourceUrl, sha256: entry.image.sha256,
      perceptualHash: "0".repeat(16), width: 20, height: 20, mediaType: "image/png", sourceHost: "fixture.invalid" }]);
    outputs.push(scheduler.retained().map((record) => record.key));
    expect(scheduler.coverage()).toMatchObject({ retainedAssets: VISUAL_LIMITS.retainedAssets, excludedRecords: 60 });
    expect(scheduler.coverage().retainedBytes).toBeLessThanOrEqual(VISUAL_LIMITS.retainedBytes);
    expect(new Set(scheduler.selectOcr().map((record) => record.pageUrl)).size).toBe(6);
  }
  expect(outputs[1]).toEqual(outputs[0]); expect(outputs[2]).toEqual(outputs[0]);
});

it("stores identical capture bytes once for one or 200 references", () => {
  const store = new CaptureStore();
  const bytes = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0xff, 0xd9]);
  const references = Array.from({ length: 200 }, () => store.add(bytes));
  expect(new Set(references).size).toBe(1);
  expect(store.values()).toHaveLength(1);
});

it("finds the same observed creative on early, ninth and final pages after real live acquisition and OCR", async () => {
  const banner = await readFile("fixtures/ocr/banner.png");
  const normal = await readFile("fixtures/realistic/ads/creative.png");
  const bannerSha = createHash("sha256").update(banner).digest("hex");
  let position = 0;
  let reverse = false;
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? "/", "http://fixture.invalid").pathname;
    if (path === "/robots.txt" || path === "/sitemap.xml") { response.statusCode = 404; response.end(); return; }
    if (path.endsWith(".png")) {
      const bytes = path === "/banner.png" ? banner : Buffer.concat([normal, Buffer.from(path)]);
      response.writeHead(200, { "content-type": "image/png", "content-length": bytes.length }); response.end(bytes); return;
    }
    response.setHeader("content-type", "text/html; charset=utf-8");
    if (path === "/") {
      const links = Array.from({ length: 10 }, (_, index) => `<a href="/page-${String(index).padStart(2,"0")}">page</a>`);
      response.end((reverse ? links.reverse() : links).join("")); return;
    }
    const index = Number(path.slice(-2));
    setTimeout(() => response.end(index === position
      ? '<a href="https://ads.invalid/"><img class="ad" src="/banner.png"></a>'
      : `<a href="https://assets.invalid/"><img src="/normal-${index}.png"></a>`), reverse ? (10-index)*3 : index*3);
  });
  await new Promise<void>((resolve) => server.listen(0,"127.0.0.1",resolve));
  const entryUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}/`;
  try {
    for (const input of [{ position: 0, reverse: false }, { position: 8, reverse: true }, { position: 9, reverse: false }]) {
      position = input.position; reverse = input.reverse;
      const output = await scanSite({ entryUrl, crawl: { concurrency: 3, settleMs: 0, limits: { maxPages: 11, maxDepth: 1, timeoutSec: 60 } } });
      expect(output.detailBundle.visualAnalysisCoverage?.pagesConsidered).toBe(11);
      expect(output.detailBundle.visualAnalysisCoverage?.pagesNotConsidered).toBe(0);
      expect(output.detailBundle.visualAnalysisCoverage?.selection?.ocrSha256).toContain(bannerSha);
      const target = output.detailBundle.imageAnalysis?.find((analysis) => analysis.assetId === `visual-${bannerSha}`);
      expect(target?.ocr.state).toBe("available"); expect(target?.decision.passed).toBe(true);
      expect(validateScanDetailBundle(output.detailBundle, output.result, output.extraResult).ok).toBe(true);
    }
  } finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
}, 60_000);

it("real one-versus-200-finding pages serialize shared screenshot references without repeated bytes", async () => {
  let count = 1;
  const server = createServer((request,response) => {
    response.setHeader("content-type", "text/html; charset=utf-8");
    if (request.url === "/robots.txt") { response.end(""); return; }
    response.end(Array.from({ length: count }, (_, index) => `<p id="ad-${index}" style="opacity:0">카지노 가입</p>`).join(""));
  });
  await new Promise<void>((resolve) => server.listen(0,"127.0.0.1",resolve));
  const entryUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}/`;
  const ids: string[] = [];
  try {
    for (count of [1,200]) {
      const output = await scanSite({ entryUrl, crawl: { settleMs: 0, limits: { maxPages: 1, maxDepth: 0, timeoutSec: 60 } } });
      expect(output.result.findings).toHaveLength(count);
      const visualIds = new Set(output.detailBundle.findings.map((finding) => finding.visual.assetId));
      expect(visualIds.size).toBe(1);
      const assetId = [...visualIds][0]!; ids.push(assetId);
      expect(output.detailBundle.visualAssets?.filter((asset) => asset.assetId === assetId)).toHaveLength(1);
      for (const finding of output.detailBundle.findings) expect(finding.visual.dataUrl).toBeUndefined();
      expect(validateScanDetailBundle(output.detailBundle, output.result, output.extraResult).ok).toBe(true);
    }
    expect(ids[1]).toBe(ids[0]);
  } finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
}, 60_000);
