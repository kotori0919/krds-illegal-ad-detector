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

it("rejects page outcomes that overstate successfully checked coverage", () => {
  const data = bundle();
  data.pageOutcomes![0]!.status = 404;
  expect(validateScanDetailBundle(data, result, extra).ok).toBe(false);
  data.pageOutcomes![0]!.outcome = "failed";
  expect(validateScanDetailBundle(data, result, extra).ok).toBe(false);
  data.coverage = { checkedPages: 0, failedPages: [{ url: result.meta.entry_url, status: 404, reason: "HTTP 404" }], timedOut: false };
  expect(validateScanDetailBundle(data, result, extra).ok).toBe(true);
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
