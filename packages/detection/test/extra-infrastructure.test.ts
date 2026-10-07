import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { validateExtraResult, validateOfficialResultText } from "@krds-detector/contracts";
import { scanSite } from "../src/scan.js";

let site: Server;
let asset: Server;
let siteOrigin = "";
let cdnOrigin = "";
let analyticsOrigin = "";
let fontOrigin = "";
let destinationOrigin = "";
let documentationOrigin = "";

beforeAll(async () => {
  const logoBytes = await readFile(resolve(import.meta.dirname, "../../../fixtures/realistic/ads/creative.png"));
  asset = createServer((request, response) => {
    const path = new URL(request.url ?? "/", "http://fixture.local").pathname;
    if (path === "/styles.css") {
      response.writeHead(200, { "content-type": "text/css" });
      response.end(`@font-face {font-family:fixture;src:url('${fontOrigin}/font.woff2')} body {font-family:fixture}`);
    } else if (path.endsWith(".js")) {
      response.writeHead(200, { "content-type": "application/javascript" });
      response.end("void 0;");
    } else if (path === "/font.woff2") {
      response.writeHead(200, { "content-type": "font/woff2" });
      response.end(Buffer.from("observed font request"));
    } else if (path === "/logo.png") {
      response.writeHead(200, { "content-type": "image/png", "content-length": logoBytes.length });
      response.end(logoBytes);
    } else {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise<void>((resolve) => asset.listen(0, "127.0.0.1", resolve));
  const assetAddress = asset.address();
  if (!assetAddress || typeof assetAddress === "string") throw new Error("asset port unavailable");
  const origin = (host: string): string => `http://${host}.localhost:${String(assetAddress.port)}`;
  cdnOrigin = origin("cdn");
  analyticsOrigin = origin("analytics");
  fontOrigin = origin("fonts");
  destinationOrigin = origin("ads");
  documentationOrigin = origin("documentation");
  site = createServer((request, response) => {
    const path = new URL(request.url ?? "/", "http://fixture.local").pathname;
    if (!["/negative", "/negative-second", "/positive", "/positive-second"].includes(path)) {
      response.writeHead(404); response.end(); return;
    }
    const positive = path.startsWith("/positive");
    const secondPath = positive ? "/positive-second" : "/negative-second";
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(`<!doctype html><html lang="ko"><head>
      <link rel="stylesheet" href="${cdnOrigin}/styles.css">
      <script src="${cdnOrigin}/framework.js"></script><script src="${analyticsOrigin}/analytics.js"></script>
      </head><body><h1>기관 소식</h1><a href="${secondPath}">다음 소식</a>
      <a href="${documentationOrigin}/docs"><img alt="기관 상징" width="${logoBytes.readUInt32BE(16)}" height="${logoBytes.readUInt32BE(20)}" src="${cdnOrigin}/logo.png"></a>
      ${positive ? `<a id="offer" style="opacity:0" href="${destinationOrigin}/casino/join">카지노 신규가입</a>` : ""}
    </body></html>`);
  });
  await new Promise<void>((resolve) => site.listen(0, "127.0.0.1", resolve));
  const siteAddress = site.address();
  if (!siteAddress || typeof siteAddress === "string") throw new Error("site port unavailable");
  siteOrigin = `http://127.0.0.1:${String(siteAddress.port)}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => site.close(() => resolve()));
  await new Promise<void>((resolve) => asset.close(() => resolve()));
});

describe("live extra infrastructure result", () => {
  it("retains repeated CDN, analytics, fonts and externally linked logo observations without advertising findings", async () => {
    const output = await scanSite({ entryUrl: `${siteOrigin}/negative`, crawl: {
      concurrency: 2, settleMs: 250, perPageMs: 7000,
      limits: { maxPages: 2, maxDepth: 1, timeoutSec: 45 },
    } });
    expect(output.pagesVisited).toBe(2);
    expect(output.failedPages).toBe(0);
    expect(validateOfficialResultText(output.json).ok).toBe(true);
    expect(validateExtraResult(output.extraResult).ok).toBe(true);
    expect(output.result.findings).toEqual([]);
    expect(output.extraResult.findings).toEqual([]);
    expect(output.detailBundle.infrastructure).toEqual([]);
    const domains = output.detailBundle.evidenceGraph!.nodes.filter((node) => node.kind === "Domain").map((node) => node.label);
    for (const origin of [cdnOrigin, analyticsOrigin, fontOrigin, documentationOrigin]) expect(domains).toContain(new URL(origin).host);
    const logos = output.detailBundle.imageAnalysis!.filter((analysis) => analysis.sourceUrl === `${cdnOrigin}/logo.png`);
    const visualDiagnostics=JSON.stringify({coverage:output.detailBundle.visualAnalysisCoverage,
      issues:output.detailBundle.analysisIssues,
      observations:output.detailBundle.imageAnalysis?.map((analysis)=>({sourceUrl:analysis.sourceUrl,pageUrls:analysis.pageUrls,ocr:analysis.ocr.state}))});
    expect([...new Set(logos.flatMap((analysis) => analysis.pageUrls))].sort(), visualDiagnostics)
      .toEqual([`${siteOrigin}/negative`, `${siteOrigin}/negative-second`]);
    for (const analysis of logos) {
      expect(analysis.candidateEvidence).toEqual(["external-destination"]);
      expect(analysis.matchedTerms).toEqual([]);
      expect(analysis.decision.passed).toBe(false);
    }
  }, 20_000);

  it("attributes a repeated official advertisement destination without changing official finding objects", async () => {
    const output = await scanSite({ entryUrl: `${siteOrigin}/positive`, crawl: {
      concurrency: 2, settleMs: 250, perPageMs: 7000,
      limits: { maxPages: 2, maxDepth: 1, timeoutSec: 45 },
    } });
    expect(output.pagesVisited).toBe(2);
    expect(output.failedPages).toBe(0);
    expect(validateOfficialResultText(output.json).ok).toBe(true);
    expect(validateExtraResult(output.extraResult).ok).toBe(true);
    expect(output.result.findings).toEqual(["/positive", "/positive-second"].map((path, index) => ({
      id: `f${String(index + 1)}`, url: `${siteOrigin}${path}`, is_violation: true,
      location: "#offer", evidence_text: "카지노 신규가입", technique: "TRANSPARENT",
    })));
    expect(output.extraResult.findings.map((finding) => finding.extra_finding)).toEqual(["AD_INFRASTRUCTURE_CORRELATION"]);
    expect(output.detailBundle.infrastructure!.map(({ domain, pageUrls, evidenceKinds }) => ({ domain, pageUrls, evidenceKinds })))
      .toEqual([{ domain: new URL(destinationOrigin).host, pageUrls: [`${siteOrigin}/positive`, `${siteOrigin}/positive-second`],
        evidenceKinds: ["official-finding"] }]);
  }, 20_000);
});
