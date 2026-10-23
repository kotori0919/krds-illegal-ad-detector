import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LocalOcrBackend } from "@krds-detector/evidence";
import { validateScanDetailBundle, type TextEmbeddingEvidence } from "@krds-detector/contracts";
import { scanSite } from "../src/scan.js";

// These cases isolate text/OCR selection; pixel-model quality is exercised separately.
let visualMock: { mockRestore(): void };
let warmMock: { mockRestore(): void };
beforeEach(() => {
  visualMock = vi.spyOn(LocalOcrBackend.prototype, "analyzeImage").mockResolvedValue({ state: "unavailable", reason: "model-error" });
  // Every boundary case below mocks the analysis methods; a real warm-up would
  // fork the production worker and load its models for no coverage.
  warmMock = vi.spyOn(LocalOcrBackend.prototype, "warm").mockResolvedValue(undefined);
});
afterEach(() => { visualMock.mockRestore(); warmMock.mockRestore(); });

it.each(["positive", "failed", "cancelled", "oversized-alternative"] as const)("keeps official output immutable when optional text analysis is %s", async state => {
  const image = await readFile("fixtures/real-banners/blacktoon-1.png");
  const server = createServer((request, response) => {
    response.setHeader("content-type", request.url === "/ad.png" ? "image/png" : "text/html;charset=utf-8");
    response.end(request.url === "/ad.png" ? image
      : '<p style="opacity:0">카지노 가입 보너스 지급</p><a href="https://offer.example/"><img class="banner" src="/ad.png" id="offer"></a>');
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No fixture address");
  const controller = new AbortController(); let committed: string | undefined;
  const events: string[] = [];
  // Isolate the optional-analysis integration boundary, not OCR/model quality.
  const recognition = vi.spyOn(LocalOcrBackend.prototype, "recognize").mockImplementation(async crop => ({ sourceId: "ad", backend: "boundary-fixture",
    text: state === "oversized-alternative" && crop.variant ? "x".repeat(4097) : "페이백10x 콤프3.5x 입금 가능", confidence: 0.6 }));
  const embedding = vi.spyOn(LocalOcrBackend.prototype, "analyzeText").mockImplementation(async () => {
    expect(committed).toBeDefined();
    if (state === "cancelled") { controller.abort(); throw new Error("OCR budget exhausted"); }
    if (state === "failed") throw new Error("model unavailable");
    return { state: "available", policy: "text-ad-embedding-v1", model: "embeddinggemma-2-text-f32",
      revision: "daa72c51243991dfcaf9f9137d2c573d8f7790c0", positiveSimilarity: state === "oversized-alternative" ? 0.5 : 0.7, negativeSimilarity: 0.6,
      margin: state === "oversized-alternative" ? -0.1 : 0.1, threshold: 0, passed: state !== "oversized-alternative", elapsedMs: 1 } satisfies TextEmbeddingEvidence;
  });
  try {
    const output = await scanSite({ entryUrl: `http://127.0.0.1:${address.port}/`, signal: controller.signal,
      onEvent: event => { events.push(event.kind); }, commitOfficial: json => { committed = json; }, crawl: { settleMs: 20, limits: { maxPages: 1, maxDepth: 0, timeoutSec: 60 } } });
    expect(embedding).toHaveBeenCalledOnce();
    expect(output.json).toBe(committed);
    expect(output.result.findings.map(finding => finding.technique)).toEqual(["TRANSPARENT"]);
    expect(output.extraResult.findings.filter(finding => finding.extra_finding === "IMAGE_ONLY_ILLEGAL_AD")).toHaveLength(state === "positive" ? 1 : 0);
    const analysis = output.detailBundle.imageAnalysis![0]!;
    expect(analysis.ocr.state === "available" && analysis.ocr.text).toBe("페이백10x 콤프3.5x 입금 가능");
    if (state === "oversized-alternative") expect(analysis.ocrAlternatives).toEqual([{state:"unavailable",backend:"ppocrv5-korean-mobile-4x-cpu-v2",reason:"recognition-error"}]);
    if (state === "cancelled") {expect(output.detailBundle.coverage.cancelled).toBe(true);expect(events.at(-1)).toBe("session-cancelled");}
    if (state === "failed" || state === "cancelled") expect(analysis.textEmbedding).toEqual({ state: "unavailable", reason: state === "cancelled" ? "budget" : "model-error" });
    expect(validateScanDetailBundle(output.detailBundle, output.result, output.extraResult)).toEqual({ ok: true, errors: [] });
  } finally {
    embedding.mockRestore(); recognition.mockRestore(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
  }
}, 15_000);

it.each(["normal", "public", "failed", "embedding-failed"] as const)("verifies an ambiguous Tesseract semantic review while retaining both OCR readings: %s", async state => {
  const image=await readFile("fixtures/ocr/banner.png");
  const primary="연속 만점자의 최신 실전 전략\n1만원 할인 + 시크릿 자료집 제공";
  const verified=state==="public"?"카지노 가입 보너스 불법광고 신고 및 예방 안내":"토익 연속 만점자의 최신 실전 전략\n토익 1만원 할인 + 시크릿 자료집 제공";
  const server=createServer((request,response)=>{response.setHeader("content-type",request.url==="/ad.png"?"image/png":"text/html;charset=utf-8");response.end(request.url==="/ad.png"?image:'<a href="https://offer.example/"><img class="banner" id="ad" width="800" height="150" src="/ad.png"></a>');});
  await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));const address=server.address();if(!address||typeof address==="string")throw Error("No fixture address");let committed:string|undefined;
  const recognition=vi.spyOn(LocalOcrBackend.prototype,"recognize").mockImplementation(async crop=>{
    if(crop.variant){expect(crop.variant).toBe("neural-review");if(state==="failed")throw Error("OCR recognition failed");return{sourceId:"ad",backend:"ppocrv5-korean-mobile-cpu-v1",text:verified,confidence:.91};}
    return{sourceId:"ad",backend:"tesseract-cpu-kor-eng-v7",text:primary,confidence:.76};
  });
  const embedding=vi.spyOn(LocalOcrBackend.prototype,"analyzeText").mockImplementation(async text=>{if(state==="embedding-failed"&&text!==primary)throw Error("model unavailable");return {state:"available",policy:"text-ad-embedding-v2",model:"embeddinggemma-2-text-f32",revision:"daa72c51243991dfcaf9f9137d2c573d8f7790c0",positiveSimilarity:.7,negativeSimilarity:text===primary?.6:.8,margin:text===primary?.1:-.1,threshold:0,passed:text===primary,elapsedMs:1};});
  try{
    const output=await scanSite({entryUrl:`http://127.0.0.1:${address.port}/`,commitOfficial:json=>{committed=json;},crawl:{settleMs:20,limits:{maxPages:1,maxDepth:0,timeoutSec:60}}});
    const analysis=output.detailBundle.imageAnalysis![0]!;
    expect(recognition).toHaveBeenCalledTimes(2);expect(output.json).toBe(committed);
    expect(analysis.decision.passed).toBe(state==="failed"||state==="embedding-failed");
    expect(analysis.ocr.state==="available"&&analysis.ocr.text).toBe(state==="failed"||state==="embedding-failed"?primary:verified);
    if(state==="failed")expect(analysis.ocrAlternatives).toEqual([{state:"unavailable",backend:"ppocrv5-korean-mobile-cpu-v1",reason:"recognition-error"}]);
    else if(state==="embedding-failed"){expect(analysis.ocrAlternatives?.[0]).toMatchObject({state:"available",text:verified,backend:"ppocrv5-korean-mobile-cpu-v1"});expect(analysis.textEmbedding?.state==="available"&&analysis.textEmbedding.passed).toBe(true);}
    else expect(analysis.ocrAlternatives?.[0]).toMatchObject({state:"available",text:primary,backend:"tesseract-cpu-kor-eng-v7"});
    if(state==="normal")expect(analysis.textEmbedding?.state==="available"&&analysis.textEmbedding.passed).toBe(false);
    if(state==="public"){expect(embedding).toHaveBeenCalledOnce();expect(analysis.textEmbedding).toBeUndefined();}
    expect(validateScanDetailBundle(output.detailBundle,output.result,output.extraResult)).toEqual({ok:true,errors:[]});
  }finally{recognition.mockRestore();embedding.mockRestore();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
},15_000);

it.each([false,true])("does not promote a degraded scale hypothesis solely through similarity (literal offer: %s)",async literal=>{
  const image=await readFile("fixtures/real-banners/blacktoon-1.png"),primary="Golary 12s Series",alternate=literal?"카지노 가입 보너스 지급":"alary126 5e";
  const server=createServer((request,response)=>{response.setHeader("content-type",request.url==="/ad.png"?"image/png":"text/html;charset=utf-8");response.end(request.url==="/ad.png"?image:'<a href="https://offer.example/"><img class="banner" id="ad" width="206" height="62" src="/ad.png"></a>');});
  await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));const address=server.address();if(!address||typeof address==="string")throw Error("No fixture address");
  const recognition=vi.spyOn(LocalOcrBackend.prototype,"recognize").mockImplementation(async crop=>({sourceId:"ad",backend:crop.variant?"ppocrv5-korean-mobile-4x-cpu-v2":"ppocrv5-korean-mobile-cpu-v1",text:crop.variant?alternate:primary,confidence:crop.variant?.63:.77}));
  const embedding=vi.spyOn(LocalOcrBackend.prototype,"analyzeText").mockImplementation(async text=>({state:"available",policy:"text-ad-embedding-v2",model:"embeddinggemma-2-text-f32",revision:"daa72c51243991dfcaf9f9137d2c573d8f7790c0",positiveSimilarity:.7,negativeSimilarity:text===primary?.8:.6,margin:text===primary?-.1:.1,threshold:0,passed:text!==primary,elapsedMs:1}));
  try{const output=await scanSite({entryUrl:`http://127.0.0.1:${address.port}/`,crawl:{settleMs:20,limits:{maxPages:1,maxDepth:0,timeoutSec:60}}});const analysis=output.detailBundle.imageAnalysis![0]!;
    expect(analysis.decision.passed).toBe(literal);expect(embedding).toHaveBeenCalledOnce();
    expect(analysis.ocr.state==="available"&&analysis.ocr.text).toBe(literal?alternate:primary);
    expect(analysis.ocrAlternatives?.[0]?.state==="available"&&analysis.ocrAlternatives[0].text).toBe(literal?primary:alternate);
  }finally{recognition.mockRestore();embedding.mockRestore();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
},15_000);

it.each(["weak-positive", "negative", "public", "dom", "education"] as const)("keeps observed category text when neural verification loses it: %s", async state => {
  const image = await readFile("fixtures/ocr/banner.png");
  const primary = "온카카지노\n니티\n현금\n교환무료쿠폰이\n커뮤니티";
  const alternative = state === "education" ? "전강의 수강 개강맞이3만원 할인" : state === "dom" ? "꽁머니 가입 쿠폰 제공" : state === "public" ? "카지노 가입 보너스 불법광고 신고 및 예방 안내" : "뮤니티\n온키\n폰이벤트\n교환\n현\nD\n바카리";
  const server = createServer((request, response) => {
    response.setHeader("content-type", request.url === "/ad.png" ? "image/png" : "text/html;charset=utf-8");
    response.end(request.url === "/ad.png" ? image : `<a href="https://offer.example/"><img class="banner" id="ad" width="800" height="150" src="/ad.png"></a>${state === "dom" ? `<p>${alternative}</p>` : ""}`);
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); if (!address || typeof address === "string") throw Error("No fixture address");
  const recognition = vi.spyOn(LocalOcrBackend.prototype, "recognize").mockImplementation(async crop => ({ sourceId: "ad",
    backend: crop.variant ? "ppocrv5-korean-mobile-cpu-v1" : "tesseract-cpu-kor-eng-v7", text: crop.variant ? alternative : primary, confidence: crop.variant ? .91 : .78 }));
  const embedding = vi.spyOn(LocalOcrBackend.prototype, "analyzeText").mockImplementation(async text => {
    const margin = text === primary ? .03 : state === "weak-positive" ? .000018 : -.01;
    return { state: "available", policy: "text-ad-embedding-v2", model: "embeddinggemma-2-text-f32", revision: "daa72c51243991dfcaf9f9137d2c573d8f7790c0",
      positiveSimilarity: .7 + margin, negativeSimilarity: .7, margin, threshold: 0, passed: margin >= 0, elapsedMs: 1 };
  });
  try {
    const output = await scanSite({ entryUrl: `http://127.0.0.1:${address.port}/`, crawl: { settleMs: 20, limits: { maxPages: 1, maxDepth: 0, timeoutSec: 60 } } });
    const analysis = output.detailBundle.imageAnalysis![0]!;
    const excluded = state === "public" || state === "dom" || state === "education";
    expect(analysis.decision.passed).toBe(!excluded);
    expect(analysis.ocr.state === "available" && analysis.ocr.text).toBe(excluded ? alternative : primary);
    if (!excluded) { expect(analysis.matchedTerms).toContain("카지노"); expect(analysis.textEmbedding?.state === "available" && analysis.textEmbedding.margin).toBeCloseTo(.03, 6); }
    else expect(analysis.textEmbedding).toBeUndefined();
    expect(analysis.ocrAlternatives?.[0]).toMatchObject({ state: "available", text: excluded ? primary : alternative });
    expect(validateScanDetailBundle(output.detailBundle, output.result, output.extraResult)).toEqual({ ok: true, errors: [] });
  } finally { recognition.mockRestore(); embedding.mockRestore(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
}, 15_000);

it("warms the shared engine once and records a failed warm-up without failing the scan", async () => {
  const image = await readFile("fixtures/real-banners/blacktoon-1.png");
  const server = createServer((request, response) => {
    response.setHeader("content-type", request.url === "/ad.png" ? "image/png" : "text/html;charset=utf-8");
    response.end(request.url === "/ad.png" ? image
      : '<p style="opacity:0">카지노 가입 보너스 지급</p><a href="https://offer.example/"><img class="banner" id="offer" src="/ad.png"></a>');
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No fixture address");
  const recognition = vi.spyOn(LocalOcrBackend.prototype, "recognize").mockImplementation(async () => ({ sourceId: "ad", backend: "boundary-fixture",
    text: "페이백10x 콤프3.5x 입금 가능", confidence: 0.6 }));
  const embedding = vi.spyOn(LocalOcrBackend.prototype, "analyzeText").mockResolvedValue({ state: "available", policy: "text-ad-embedding-v1",
    model: "embeddinggemma-2-text-f32", revision: "daa72c51243991dfcaf9f9137d2c573d8f7790c0", positiveSimilarity: 0.7, negativeSimilarity: 0.6,
    margin: 0.1, threshold: 0, passed: true, elapsedMs: 1 } satisfies TextEmbeddingEvidence);
  const warm = vi.spyOn(LocalOcrBackend.prototype, "warm").mockRejectedValue(new Error("OCR warm-up failed"));
  try {
    const output = await scanSite({ entryUrl: `http://127.0.0.1:${address.port}/`,
      crawl: { settleMs: 20, limits: { maxPages: 1, maxDepth: 0, timeoutSec: 60 } } });
    // Warm-up is advisory: attempted exactly once, recorded, and never fatal.
    expect(warm).toHaveBeenCalledOnce();
    expect(output.detailBundle.analysisIssues).toContain("embedding-warm:error");
    expect(output.result.findings.map(finding => finding.technique)).toEqual(["TRANSPARENT"]);
    expect(output.detailBundle.imageAnalysis![0]!.ocr).toMatchObject({ state: "available", text: "페이백10x 콤프3.5x 입금 가능" });
    expect(validateScanDetailBundle(output.detailBundle, output.result, output.extraResult)).toEqual({ ok: true, errors: [] });
  } finally {
    warm.mockRestore(); embedding.mockRestore(); recognition.mockRestore(); server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}, 15_000);
