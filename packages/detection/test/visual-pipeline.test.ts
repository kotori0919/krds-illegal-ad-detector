import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { expect, it, vi } from "vitest";
import * as evidence from "@krds-detector/evidence";
import { validateExtraResult, validateScanDetailBundle } from "@krds-detector/contracts";
import { scanSite } from "../src/scan.js";

async function listen(server: Server): Promise<string> {
  await new Promise<void>((done) => server.listen(0,"127.0.0.1",done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture listen failed");
  return `http://127.0.0.1:${String(address.port)}`;
}
async function close(server: Server): Promise<void> {
  server.closeAllConnections();
  await new Promise<void>((done) => server.close(() => done()));
}

it("detects an unmarked externally linked image offer through real capture and offline OCR", async () => {
  const banner = await readFile("fixtures/ocr/banner.png");
  const normal = await readFile("fixtures/realistic/ads/creative.png");
  const server = createServer((request, response) => {
    if (request.url === "/0722.png" || request.url === "/ordinary.png") {
      const image = request.url === "/0722.png" ? banner : normal;
      response.writeHead(200, { "content-type": "image/png", "content-length": image.length });
      response.end(image);
    } else {
      response.setHeader("content-type", "text/html; charset=utf-8");
      response.end('<a href="https://advertiser.example/?code=0722"><img alt="0722" src="/0722.png"></a>'
        + '<a href="https://shop.example/"><img alt="logo" src="/ordinary.png"></a>');
    }
  });
  const origin = await listen(server);
  try {
    const output = await scanSite({ entryUrl: origin + "/", crawl: { concurrency: 1, settleMs: 100,
      limits: { maxPages: 1, timeoutSec: 30 } } });
    expect(output.result.findings).toEqual([]);
    expect(output.extraResult.findings.map((finding) => finding.extra_finding)).toEqual(["IMAGE_ONLY_ILLEGAL_AD"]);
    const analyses = output.detailBundle.imageAnalysis ?? [];
    expect(analyses.find((image) => image.sourceUrl.endsWith("/0722.png"))?.ocr).toMatchObject({ state: "available" });
    expect(analyses.find((image) => image.sourceUrl.endsWith("/ordinary.png"))?.extraFindingId).toBeUndefined();
    expect(validateScanDetailBundle(output.detailBundle, output.result, output.extraResult)).toEqual({ ok: true, errors: [] });
  } finally { await close(server); }
}, 30_000);

it("calls real OCR for all gated visual sources and preserves an empty official result", async () => {
  const banner = await readFile("fixtures/ocr/banner.png");
  const normal = await readFile("fixtures/realistic/ads/creative.png");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="150"><image width="800" height="150" href="data:image/png;base64,${banner.toString("base64")}"/></svg>`;
  const server = createServer((request,response) => {
    const image = request.url === "/normal.png" ? normal : banner;
    if (request.url?.endsWith(".png")) {
      response.writeHead(200,{"content-type":"image/png","content-length":image.length}); response.end(image);
    } else if (request.url === "/vector.svg") {
      response.writeHead(200,{"content-type":"image/svg+xml","content-length":Buffer.byteLength(svg)}); response.end(svg);
    } else {
      response.setHeader("content-type","text/html; charset=utf-8");
      response.end(`<img class="ad" src="/banner.png"><div class="ad" style="width:800px;height:150px;background-image:url('/banner.png')"></div>
        ${svg.replace("<svg ","<svg class=\"ad\" ")}<img class="ad" src="/vector.svg">
        <canvas class="ad" width="800" height="150"></canvas><img class="ad" src="/normal.png">
        <script>const image=new Image();image.onload=()=>document.querySelector('canvas').getContext('2d').drawImage(image,0,0);image.src='/banner.png';</script>`);
    }
  });
  const origin = await listen(server);
  try {
    const output = await scanSite({entryUrl:origin+"/",crawl:{concurrency:1,settleMs:100,limits:{maxPages:1,timeoutSec:40}}});
    expect(output.result.findings).toEqual([]);
    const analyses = output.detailBundle.imageAnalysis ?? [];
    expect(new Set(analyses.map((image)=>image.sourceKind))).toEqual(new Set(["img","background-image","svg","canvas"]));
    const positives = analyses.filter((analysis)=>analysis.extraFindingId);
    expect(positives).toHaveLength(5);
    for (const analysis of positives) {
      expect(analysis.ocr.state).toBe("available");
      expect(analysis.normalizedText).toContain("카지노가입보너스지급");
      expect(analysis.visibleDomEquivalent).toBe(false);
      expect(analysis.assetId).toBeDefined();
    }
    expect(analyses.find((image)=>image.sourceUrl.endsWith("/normal.png"))?.extraFindingId).toBeUndefined();
    expect(output.detailBundle.visualAnalysisCoverage).toMatchObject({pagesConsidered:1,pagesNotConsidered:0,
      candidatesObserved:6,candidateTotal:null,imagesAcquired:6,imageAnalysisRecords:6,ocrImagesAttempted:2,
      ocrImagesCompleted:2,ocrImagesUnavailable:0,limitsReached:[],skips:[]});
    expect(output.extraResult.findings.map((finding)=>finding.extra_finding)).toEqual(Array(5).fill("IMAGE_ONLY_ILLEGAL_AD"));
    expect(validateExtraResult(output.extraResult)).toEqual({ok:true,errors:[]});
    expect(validateScanDetailBundle(output.detailBundle,output.result,output.extraResult)).toEqual({ok:true,errors:[]});
  } finally { await close(server); }
},40_000);

it("preserves valid official findings when extended classification fails", async () => {
  const server=createServer((_request,response)=>{
    response.setHeader("content-type","text/html; charset=utf-8");
    response.end('<p style="opacity:0">카지노 가입 보너스 지급</p>');
  });
  const origin=await listen(server);
  const failure=vi.spyOn(evidence,"buildExtraResult").mockImplementation(()=>{throw new Error("classification unavailable");});
  try {
    const output=await scanSite({entryUrl:origin+"/",crawl:{settleMs:20,limits:{maxPages:1,timeoutSec:20}}});
    expect(output.result.findings.map((finding)=>finding.technique)).toEqual(["TRANSPARENT"]);
    expect(output.extraResult).toEqual({meta:output.result.meta,findings:[]});
    expect(output.detailBundle.analysisIssues).toContain("extra-analysis-unavailable");
    expect(output.detailBundle.coverage.checkedPages).toBe(1);
    expect(output.detailBundle.visualAnalysisCoverage).toMatchObject({pagesConsidered:1,candidatesObserved:0,
      candidateTotal:null,ocrImagesAttempted:0,ocrImagesCompleted:0,limitsReached:[],skips:[]});
    expect(validateScanDetailBundle(output.detailBundle,output.result,output.extraResult)).toEqual({ok:true,errors:[]});
  } finally {failure.mockRestore();await close(server);}
},20_000);

it("suppresses image-only classification only for equivalent visible DOM advertisement text", async () => {
  const banner = await readFile("fixtures/ocr/banner.png");
  const server = createServer((request,response) => {
    if (request.url === "/banner.png") {
      response.writeHead(200,{"content-type":"image/png","content-length":banner.length});response.end(banner);
    } else {
      response.setHeader("content-type","text/html; charset=utf-8");
      response.end(`<p${request.url === "/hidden" ? ' style="opacity:0"' : ""}>카지노 가입 보너스 지급</p><img class="ad" src="/banner.png">`);
    }
  });
  const origin = await listen(server);
  try {
    const visible = await scanSite({entryUrl:origin+"/visible",crawl:{settleMs:20,limits:{maxPages:1,timeoutSec:20}}});
    expect(visible.detailBundle.imageAnalysis?.[0]?.visibleDomEquivalent).toBe(true);
    expect(visible.extraResult.findings).toEqual([]);
    const hidden = await scanSite({entryUrl:origin+"/hidden",crawl:{settleMs:20,limits:{maxPages:1,timeoutSec:20}}});
    expect(hidden.extraResult.findings.map((finding)=>finding.extra_finding)).toEqual(["IMAGE_ONLY_ILLEGAL_AD"]);
    expect(hidden.result.findings.map((finding)=>finding.technique)).toEqual(["TRANSPARENT"]);
  } finally { await close(server); }
},40_000);
