import { expect, it } from "vitest";
import { validateScanDetailBundle, type ScanDetailBundle, type OfficialResult, type ExtraResult } from "../src/index.js";

const result: OfficialResult = { meta: { topic: "TOPIC", entry_url: "https://example.kr/",
  started_at: "2026-10-07T00:00:00Z", finished_at: "2026-10-07T00:00:01Z", elapsed_sec: 1, tool_version: "0.1.0" }, findings: [] };
const extra: ExtraResult = { meta: result.meta, findings: [] };
function bundle(): ScanDetailBundle {
  return { version: 2, findings: [], creativeImages: [],
    coverage: { checkedPages: 1, failedPages: [], timedOut: false },
    pageOutcomes: [{ url: result.meta.entry_url, finalUrl: result.meta.entry_url, status: 200, depth: 0, outcome: "checked" }],
    imageAnalysis: [{ sourceUrl: "https://example.kr/ad.png", pageUrls: [result.meta.entry_url],
      ocr: { state: "available", backend: "cpu", text: "카지노 가입", confidence: 0.96 }, matchedTerms: ["카지노"],
      normalizedText: "카지노가입", decision: { rule: "structured", score: 2, threshold: 2, passed: true, detail: "ad semantics and image text" } }] };
}

it("keeps measured visual coverage distinct and rejects invented or inconsistent totals", () => {
  const data = bundle();
  data.visualAnalysisCoverage = { pagesConsidered: 8, pagesNotConsidered: 1, candidatesObserved: 7,
    candidateTotal: null, imagesAcquired: 7, imageAnalysisRecords: 7, ocrImagesAttempted: 6,
    ocrImagesCompleted: 5, ocrImagesUnavailable: 1,
    limits: { pages: 8, candidatesPerDocument: 8, elementsPerDocument: 10_000, bytesPerPage: 250_000, distinctOcrImages: 6 },
    limitsReached: ["page-limit", "ocr-image-limit"],
    skips: [{ reason: "page-limit", unit: "page", count: 1 }, { reason: "ocr-image-limit", unit: "image", count: 1 }] };
  expect(validateScanDetailBundle(data, result, extra).ok).toBe(true);
  for (const changes of [{ candidateTotal: 50 }, { ocrImagesCompleted: 7 }, { ocrImagesAttempted: 7 },
    { pagesConsidered: 9 }, { imageAnalysisRecords: 8 }, { candidatesObserved: 6 }]) {
    const invalid = { ...data, visualAnalysisCoverage: { ...data.visualAnalysisCoverage, ...changes } } as ScanDetailBundle;
    expect(validateScanDetailBundle(invalid, result, extra).ok).toBe(false);
  }
  data.visualAnalysisCoverage.skips[0]!.count = -1;
  expect(validateScanDetailBundle(data, result, extra).ok).toBe(false);
});

it("rejects page outcomes that overstate successfully checked coverage", () => {
  const data = bundle();
  data.pageOutcomes![0]!.status = 404;
  expect(validateScanDetailBundle(data, result, extra).ok).toBe(false);
  data.pageOutcomes![0]!.outcome = "failed";
  expect(validateScanDetailBundle(data, result, extra).ok).toBe(false);
  data.coverage = { checkedPages: 0, failedPages: [{ url: result.meta.entry_url, status: 404, reason: "HTTP 404" }], timedOut: false };
  expect(validateScanDetailBundle(data, result, extra).ok).toBe(true);
});

it("retains HTTP200 challenge coverage while refusing to count it as successfully analyzed", () => {
  const data = bundle();
  data.pageOutcomes![0]!.issue = { kind: "challenge", retryable: false };
  expect(validateScanDetailBundle(data, result, extra).ok).toBe(false);
  data.pageOutcomes![0]!.outcome = "failed";
  data.coverage = { checkedPages: 0, failedPages: [{ url: result.meta.entry_url, status: 200, reason: "challenge" }], timedOut: false };
  expect(validateScanDetailBundle(data, result, extra).ok).toBe(true);
  data.pageOutcomes![0]!.issue = { kind: "rate-limit", retryable: true, retryAfterMs: Number.MAX_SAFE_INTEGER + 1 };
  expect(validateScanDetailBundle(data, result, extra).ok).toBe(false);
});

it("rejects invalid OCR confidence and inconsistent structured decisions", () => {
  const data = bundle();
  const recognition = data.imageAnalysis![0]!.ocr;
  if (recognition.state !== "available") throw new Error("fixture recognition unavailable");
  for (const invalid of [Number.NaN, -0.1, 1.1]) {
    recognition.confidence = invalid;
    expect(validateScanDetailBundle(data, result, extra).ok).toBe(false);
  }
  recognition.confidence = 0.96;
  data.imageAnalysis![0]!.decision.passed = false;
  expect(validateScanDetailBundle(data, result, extra).ok).toBe(false);
  data.imageAnalysis![0]!.decision.passed = true;
  expect(validateScanDetailBundle(data, result, extra).ok).toBe(true);
});

it("requires an image-only finding to join its exact OCR source and opaque asset", () => {
  const data=bundle();
  const image=data.imageAnalysis![0]!;
  Object.assign(image,{assetId:"visual-1",sourceKind:"canvas",frameUrl:result.meta.entry_url,
    location:"canvas.ad",extraFindingId:"x1",visibleDomEquivalent:false});
  data.visualAssets=[{assetId:"visual-1",mimeType:"image/png",dataUrl:"data:image/png;base64,YQ=="}];
  const extras:ExtraResult={meta:result.meta,findings:[{id:"x1",url:result.meta.entry_url,location:"canvas.ad",
    technique:"ETC",extra_finding:"IMAGE_ONLY_ILLEGAL_AD",is_violation:true,evidence_text:"카지노 가입"}]};
  expect(validateScanDetailBundle(data,result,extras)).toEqual({ok:true,errors:[]});
  image.visibleDomEquivalent=true;
  expect(validateScanDetailBundle(data,result,extras).errors).toContain("image-only identity invalid");
  image.visibleDomEquivalent=false;image.assetId="missing";
  expect(validateScanDetailBundle(data,result,extras).errors).toContain("image asset missing");
  image.assetId="visual-1";extras.findings[0]!.url="https://other.kr/";
  expect(validateScanDetailBundle(data,result,extras).errors).toContain("image-only identity invalid");
});

it("rejects local-path assets and dangling graph edges", () => {
  const data=bundle();
  data.visualAssets=[{assetId:"visual-1",mimeType:"image/png",dataUrl:"file:///private/image.png"}];
  expect(validateScanDetailBundle(data,result,extra).errors).toContain("visual asset representation invalid");
  data.visualAssets=[];
  data.evidenceGraph={nodes:[{id:"p",kind:"Page",label:"page"}],edges:[{from:"p",to:"missing",kind:"LOADS"}]};
  expect(validateScanDetailBundle(data,result,extra).errors).toContain("evidence graph invalid");
});
