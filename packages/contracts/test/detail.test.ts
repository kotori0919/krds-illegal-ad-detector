import { expect, it } from "vitest";
import { validateScanDetailBundle, validTextEmbeddingEvidence, type TextEmbeddingEvidence, type ScanDetailBundle, type OfficialResult, type ExtraResult } from "../src/index.js";

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

it("retains actual animation frame provenance and rejects invented frame metadata", () => {
  const data = bundle();
  data.imageAnalysis![0]!.animationFrame = { index: 1, timestampMs: 40 };
  expect(validateScanDetailBundle(data, result, extra).ok).toBe(true);
  for (const invalid of [null, { index: -1, timestampMs: 40 }, { index: 120, timestampMs: 40 }, { index: 1, timestampMs: Number.NaN }]) {
    const broken = structuredClone(data);
    Object.assign(broken.imageAnalysis![0]!, { animationFrame: invalid });
    expect(validateScanDetailBundle(broken, result, extra).ok).toBe(false);
  }
});

it("accounts for multiple captured frames without inventing extra DOM candidates", () => {
  const data = bundle();
  data.visualAnalysisCoverage = { pagesConsidered: 1, pagesNotConsidered: 0, candidatesObserved: 1,
    candidateTotal: null, imagesAcquired: 2, imageAnalysisRecords: 2, ocrImagesAttempted: 2,
    ocrImagesCompleted: 2, ocrImagesUnavailable: 0,
    limits: { pages: 1, candidatesPerDocument: 32, elementsPerDocument: 10_000, bytesPerPage: 1_000_000, distinctOcrImages: 40, framesPerCandidate: 4 },
    limitsReached: [], skips: [] };
  expect(validateScanDetailBundle(data, result, extra).ok).toBe(true);
  delete data.visualAnalysisCoverage.limits.framesPerCandidate;
  expect(validateScanDetailBundle(data, result, extra).ok).toBe(false);
});

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

const embedding: TextEmbeddingEvidence = { state: "available", policy: "text-ad-embedding-v1", model: "embeddinggemma-2-text-f32",
  revision: "daa72c51243991dfcaf9f9137d2c573d8f7790c0", positiveSimilarity: 0.6, negativeSimilarity: 0.4,
  margin: 0.2, threshold: 0, passed: true, elapsedMs: 100 };

it("checks actual cosine evidence and rejects forged margins, versions and probabilities", () => {
  expect(validTextEmbeddingEvidence(embedding)).toBe(true);
  expect(validTextEmbeddingEvidence({ ...embedding, model: "embeddinggemma-2-text-int8", policy: "text-ad-embedding-v3" })).toBe(true);
  expect(validTextEmbeddingEvidence({ ...embedding, model: "embeddinggemma-2-text-int8" })).toBe(false);
  expect(validTextEmbeddingEvidence({ ...embedding, policy: "text-ad-embedding-v2" })).toBe(true);
  expect(validTextEmbeddingEvidence({ ...embedding, policy: "text-ad-embedding-v3" })).toBe(true);
  for (const patch of [{ margin: 0.3 }, { positiveSimilarity: 1.1 }, { negativeSimilarity: Number.NaN },
    { passed: false }, { policy: "unknown" }, { model: "another-model" }, { revision: "main" },
    { threshold: 0.05 }, { elapsedMs: -1 }, { elapsedMs: 8001 }]) {
    expect(validTextEmbeddingEvidence({ ...embedding, ...patch })).toBe(false);
  }
  for (const reason of ["budget", "model-error", "invalid-input"]) expect(validTextEmbeddingEvidence({ state: "unavailable", reason })).toBe(true);
  expect(validTextEmbeddingEvidence({ state: "unavailable", reason: "other" })).toBe(false);
});

it("allows an embedding review without fabricated literal matches only with joined OCR and external evidence", () => {
  const data = bundle(), image = data.imageAnalysis![0]!;
  Object.assign(image, { textEmbedding: embedding, matchedTerms: [], frameUrl: result.meta.entry_url, location: "#banner",
    destinationUrl: "https://advertiser.example/join", candidateEvidence: ["external-destination"], visibleDomEquivalent: false,
    extraFindingId: "x1", decision: { rule: "image-only-ad-v4-text-review", score: 3, threshold: 3, passed: true, detail: "review" } });
  const extras: ExtraResult = { meta: result.meta, findings: [{ id: "x1", url: result.meta.entry_url, location: "#banner",
    technique: "ETC", extra_finding: "IMAGE_ONLY_ILLEGAL_AD", is_violation: true, evidence_text: "카지노 가입" }] };
  expect(validateScanDetailBundle(data, result, extras).ok).toBe(true);
  image.textEmbedding = { ...embedding, policy: "text-ad-embedding-v2" };
  expect(validateScanDetailBundle(data, result, extras).ok).toBe(true);
  for (const patch of [{ textEmbedding: undefined }, { textEmbedding: { state: "unavailable", reason: "budget" } },
    { candidateEvidence: [] }, { candidateEvidence: {} }, { visibleDomEquivalent: true },
    { decision: { rule: "image-only-ad-v4-text-review", score: 0.2, threshold: 0, passed: true, detail: "forged score" } }, { destinationUrl: "https://example.kr/join" },
    { destinationUrl: "https://user:secret@advertiser.example/" }, { destinationUrl: "javascript:alert(1)" },
    { ocr: { state: "available", backend: "cpu", text: " ", confidence: 0.9 } },
    { ocr: { state: "available", backend: "cpu", text: 42, confidence: 0.9 } },
    { ocr: { state: "available", backend: "cpu", text: "x".repeat(4097), confidence: 0.9 } }]) {
    const invalid = structuredClone(data); Object.assign(invalid.imageAnalysis![0]!, patch);
    expect(validateScanDetailBundle(invalid, result, extras).ok).toBe(false);
  }
  image.decision.rule = "image-only-ad-v3";
  expect(validateScanDetailBundle(data, result, extras).errors).toContain("image-only identity invalid");
});

it("keeps bounded independent OCR alternatives without changing the selected transcript", () => {
  const data=bundle(),image=data.imageAnalysis![0]!;
  image.ocrAlternatives=[{state:"available",backend:"small-banner",text:"원문\n40%15%",confidence:0.8}];
  const selected=structuredClone(image.ocr);
  expect(validateScanDetailBundle(data,result,extra).ok).toBe(true);
  expect(image.ocr).toEqual(selected);
  for(const value of [[...image.ocrAlternatives,...image.ocrAlternatives],[{state:"available",backend:"cpu",text:"x".repeat(4097),confidence:.8}],
    [{state:"available",backend:"cpu",text:"raw",confidence:1.1}],[{state:"unavailable",backend:"cpu",reason:"made-up"}]]) {
    const forged=structuredClone(data);Object.assign(forged.imageAnalysis![0]!,{ocrAlternatives:value});
    expect(validateScanDetailBundle(forged,result,extra).ok).toBe(false);
  }
  image.ocrAlternatives=[{state:"unavailable",backend:"small-banner",reason:"budget"}];
  expect(validateScanDetailBundle(data,result,extra).ok).toBe(true);
});

it("binds image review to an actual asset and a negative layout control", () => {
  const data=bundle(),a=data.imageAnalysis![0]!,sha="a".repeat(64),assetId=`visual-${sha}`;
  data.visualAssets=[{assetId,mimeType:"image/png",dataUrl:"data:image/png;base64,YQ=="}];
  Object.assign(a,{assetId,frameUrl:"https://example.kr/",destinationUrl:"https://offer.example/",candidateEvidence:["external-destination"],visibleDomEquivalent:false,ocr:{state:"available",backend:"cpu",text:"7474 30+10",confidence:.9},matchedTerms:[],decision:{rule:"image-only-ad-v5-image-review",score:3,threshold:3,passed:true,detail:"image review"},visualEmbedding:{state:"available",policy:"image-ad-embedding-v1",model:"embeddinggemma-2-image-text-f32",revision:"daa72c51243991dfcaf9f9137d2c573d8f7790c0",imageSha256:sha,positiveSimilarity:.8,negativeSimilarity:.7,margin:.1,shuffledPositiveSimilarity:.6,shuffledNegativeSimilarity:.7,shuffledMargin:-.1,threshold:0,control:"pixel-shuffle-v1",seed:1701,passed:true,elapsedMs:9000}});
  expect(validateScanDetailBundle(data,result,extra).ok).toBe(true);
  if (a.visualEmbedding?.state === "available") a.visualEmbedding.policy = "image-ad-embedding-v2";
  expect(validateScanDetailBundle(data,result,extra).ok).toBe(true);
  if (a.visualEmbedding?.state === "available") a.visualEmbedding.policy = "image-ad-embedding-v3";
  expect(validateScanDetailBundle(data,result,extra).ok).toBe(true);
  if (a.visualEmbedding?.state === "available") a.visualEmbedding.model = "embeddinggemma-2-image-text-int8";
  expect(validateScanDetailBundle(data,result,extra).ok).toBe(true);
  if (a.visualEmbedding?.state === "available") a.visualEmbedding.model = "embeddinggemma-2-image-text-f32-vision-int8";
  expect(validateScanDetailBundle(data,result,extra).ok).toBe(true);
  if (a.visualEmbedding?.state === "available") a.visualEmbedding.policy = "image-ad-embedding-v2";
  expect(validateScanDetailBundle(data,result,extra).ok).toBe(false);
  if (a.visualEmbedding?.state === "available") a.visualEmbedding.policy = "image-ad-embedding-v3";
  for(const mutation of [()=>{a.visualEmbedding={state:"unavailable",reason:"budget"};},()=>{a.assetId="visual-"+"b".repeat(64);},()=>{if(a.visualEmbedding?.state==="available")a.visualEmbedding.shuffledMargin=.1;},()=>{a.destinationUrl="https://user:secret@offer.example/";}]){
    const saved=structuredClone(data);mutation();expect(validateScanDetailBundle(data,result,extra).ok).toBe(false);Object.assign(data,saved);Object.assign(a,saved.imageAnalysis![0]!);data.imageAnalysis![0]=a;
  }
});
