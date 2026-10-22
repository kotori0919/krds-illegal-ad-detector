import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { expect, it, vi } from "vitest";
import { LocalOcrBackend } from "@krds-detector/evidence";
import { scanSite } from "../src/scan.js";
import { SCAN_POLICY } from "@krds-detector/contracts";

it.each([{pages:9,imageCount:7},{pages:8,imageCount:6}])("reports reached capacities separately from known exclusions: %j", async ({pages,imageCount}) => {
  const banner = await readFile("fixtures/ocr/banner.png");
  const normal = await readFile("fixtures/realistic/ads/creative.png");
  // PNG decoders accept trailing bytes; different bounded response bytes must
  // exercise distinct OCR work without manufacturing new image dependencies.
  const images = [banner, normal, ...Array.from({length:imageCount-2},(_,index)=>Buffer.concat([normal,Buffer.from(`coverage-${index}`)]))];
  const server = createServer((request,response)=>{
    const imageMatch = request.url?.match(/^\/image-(\d+)\.png$/);
    if (imageMatch) {
      const image=images[Number(imageMatch[1])]!;
      response.writeHead(200,{"content-type":"image/png","content-length":image.length});response.end(image);
    } else {
      response.setHeader("content-type","text/html; charset=utf-8");
      response.end(request.url === "/"
        ? images.map((_,index)=>`<img class="ad" src="/image-${index}.png">`).join("")
          +Array.from({length:pages-1},(_,index)=>`<a href="/page-${index}">Page ${index}</a>`).join("")
        : '<img class="ad" src="/image-0.png">');
    }
  });
  await new Promise<void>((done)=>server.listen(0,"127.0.0.1",done));
  const address=server.address();
  if (!address || typeof address === "string") throw new Error("fixture address unavailable");
  try {
    const output=await scanSite({entryUrl:`http://127.0.0.1:${address.port}/`,
      crawl:{concurrency:1,settleMs:20,limits:{maxPages:pages,timeoutSec:60}}});
    expect(output.result.findings).toEqual([]);
    expect(output.detailBundle.coverage.checkedPages).toBe(pages);
    const coverage=output.detailBundle.visualAnalysisCoverage!;
    expect(coverage).toMatchObject({pagesConsidered:pages,pagesNotConsidered:0,candidatesObserved:imageCount+pages-1,candidateTotal:null,
      imagesAcquired:imageCount+pages-1,imageAnalysisRecords:imageCount+pages-1,ocrImagesAttempted:imageCount,ocrImagesCompleted:imageCount,ocrImagesUnavailable:0,
      limits:{pages,candidatesPerDocument:SCAN_POLICY.visual.candidatesPerDocument,elementsPerDocument:10_000,bytesPerPage:SCAN_POLICY.visual.bytesPerPage,distinctOcrImages:SCAN_POLICY.visual.ocrImages},
      limitsReached:[],skips:[]});
    const analyses=output.detailBundle.imageAnalysis!;
    for (const analysis of analyses) {
      const selected = coverage.selection!.ocrSha256.some((sha) => analysis.assetId === `visual-${sha}`);
      expect(analysis.ocr.state).toBe(selected ? "available" : "unavailable");
      if (!selected) expect(analysis.decision.passed).toBe(false);
    }
  } finally {
    server.closeAllConnections();await new Promise<void>((done)=>server.close(()=>done()));
  }
},65_000);

it("keeps a failed OCR attempt separate from completed OCR and preserves official output", async () => {
  const image=await readFile("fixtures/ocr/banner.png");
  const server=createServer((request,response)=>{
    if (request.url === "/banner.png") {
      response.writeHead(200,{"content-type":"image/png","content-length":image.length});response.end(image);
    } else {
      response.setHeader("content-type","text/html; charset=utf-8");
      response.end('<p style="opacity:0">카지노 가입 보너스 지급</p><img class="ad" src="/banner.png">');
    }
  });
  await new Promise<void>((done)=>server.listen(0,"127.0.0.1",done));
  const address=server.address();
  if (!address || typeof address === "string") throw new Error("fixture address unavailable");
  const failure=vi.spyOn(LocalOcrBackend.prototype,"recognize").mockRejectedValue(new Error("offline OCR unavailable"));
  try {
    const output=await scanSite({entryUrl:`http://127.0.0.1:${address.port}/`,
      crawl:{settleMs:20,limits:{maxPages:1,timeoutSec:20}}});
    expect(output.result.findings.map((finding)=>finding.technique)).toEqual(["TRANSPARENT"]);
    expect(output.detailBundle.visualAnalysisCoverage).toMatchObject({pagesConsidered:1,candidatesObserved:1,
      imagesAcquired:1,imageAnalysisRecords:1,ocrImagesAttempted:1,ocrImagesCompleted:0,ocrImagesUnavailable:1,
      limitsReached:[],skips:[{reason:"image-unavailable",unit:"image",count:1}]});
    expect(output.detailBundle.imageAnalysis![0]).toMatchObject({ocr:{state:"unavailable",reason:"recognition-error"},decision:{passed:false}});
    expect(output.extraResult.findings).toEqual([]);
  } finally {
    failure.mockRestore();server.closeAllConnections();await new Promise<void>((done)=>server.close(()=>done()));
  }
},25_000);
