import { expect, it } from "vitest";
import type { TextEmbeddingEvidence } from "@krds-detector/contracts";
import type { VisualCandidate } from "../src/creative.js";
import { decideVisualImage, shouldAnalyzeVisualText } from "../src/visual-decision.js";
const candidate: VisualCandidate = { sourceKind: "img", pageUrl: "https://page.example/", frameUrl: "https://page.example/",
  location: "#ad", destinationUrl: "https://offer.example/", candidateEvidence: ["external-destination"], visibleDomAdTexts: [] };
const evidence: TextEmbeddingEvidence = { state: "available", model: "embeddinggemma-2-text-f32", policy: "text-ad-embedding-v1",
  revision: "daa72c51243991dfcaf9f9137d2c573d8f7790c0", positiveSimilarity: 0.7, negativeSimilarity: 0.6,
  margin: 0.1, threshold: 0, passed: true, elapsedMs: 10 };
const ocr = (text: string) => ({ state: "available", backend: "offline", text, confidence: 0.6 } as const);
it("adds an explicitly model-derived review while preserving observed OCR and literal matches", () => {
  const input = ocr("페이백10x 콤프3.5x 입금 가능");
  const baseline = decideVisualImage(candidate, input, false);
  expect(baseline.decision.passed).toBe(false);
  const review = decideVisualImage(candidate, input, false, evidence);
  expect(review.decision.rule).toBe("image-only-ad-v4-text-review");
  expect(review.decision.passed).toBe(true);
  expect(review.gate.matchedTerms).toEqual(baseline.gate.matchedTerms);
  expect(review.gate.normalizedText).toBe(baseline.gate.normalizedText);
});
it.each(["카지노 첫충·페이백·콤프 3.5% 불법광고 신고 및 예방 안내", "불법도박 교육: 페이백10% 콤프3.5% 입금 가능 문구를 신고하세요"])(
  "excludes public information before inference and despite a positive model: %s", text => {
    expect(shouldAnalyzeVisualText(candidate, ocr(text))).toBe(false);
    expect(decideVisualImage(candidate, ocr(text), false, evidence).decision.passed).toBe(false);
  });
it.each([undefined, "https://page.example/", "javascript:alert(1)", "https://user:secret@offer.example/"])(
  "requires a real external noncredential destination: %s", destinationUrl => {
    const input = { ...candidate, destinationUrl };
    expect(shouldAnalyzeVisualText(input, ocr("페이백10x 콤프3.5x 입금"))).toBe(false);
    expect(decideVisualImage(input, ocr("페이백10x 콤프3.5x 입금"), false, evidence).decision.passed).toBe(false);
  });
it("requires observed candidate evidence and excludes visible DOM equivalents", () => {
  const text = "페이백10x 콤프3.5x 입금";
  for (const input of [{ ...candidate, candidateEvidence: [] }, { ...candidate, visibleDomAdTexts: [text] }]) {
    expect(shouldAnalyzeVisualText(input, ocr(text))).toBe(false);
    expect(decideVisualImage(input, ocr(text), false, evidence).decision.passed).toBe(false);
  }
});
it("retains the rule verdict when the model is unavailable or prefers a normal class", () => {
  const text = ocr("페이백10x 콤프3.5x 입금");
  const baseline = decideVisualImage(candidate, text, false);
  expect(decideVisualImage(candidate, text, false, { state: "unavailable", reason: "budget" })).toEqual(baseline);
  expect(decideVisualImage(candidate, text, false, { ...evidence, positiveSimilarity: 0.5, margin: -0.1, passed: false })).toEqual(baseline);
});
it.each(["+", "• 100% 7474", "보이스피싱 제로(Zero)캠페인 돈보내라고? 전화끊고 확인하세요", "보이스피싱 피해 예방 주의 안내"])(
  "never sends meaningless OCR or phishing prevention campaigns to the helper: %s", text => {
    expect(shouldAnalyzeVisualText(candidate, ocr(text))).toBe(false);
    expect(decideVisualImage(candidate, ocr(text), false, evidence).decision.passed).toBe(false);
  });
it("does not infer a different domain from a different port on the same hostname", () => {
  const input = { ...candidate, destinationUrl: "https://page.example:8443/offer" };
  expect(shouldAnalyzeVisualText(input, ocr("페이백10x 콤프3.5x 입금"))).toBe(false);
});

it.each(["100% 당첨 3만원 추가월인구은 수경합연부폰 5만원 추가입연부론", "신규 경품 추첨 상금 5만원"])(
  "does not infer gambling from an unsupported prize promotion: %s", text => {
    expect(shouldAnalyzeVisualText(candidate, ocr(text))).toBe(false);
    expect(decideVisualImage(candidate, ocr(text), false, evidence).decision.passed).toBe(false);
  });
it.each(["카지노 가입 당첨 이벤트", "상금 이벤트 첫충40% 입금 가능", "경품 추첨 페이백10% 콤프3%"])(
  "preserves observed gambling or deposit context inside prize promotions: %s", text => {
    expect(shouldAnalyzeVisualText(candidate, ocr(text))).toBe(true);
    expect(decideVisualImage(candidate, ocr(text), false, evidence).decision.passed).toBe(true);
  });

it.each(["MEXX", "MEXX!", "가일보드ETBT"])("does not infer an advertisement from a single unsupported name: %s", text => {
  expect(shouldAnalyzeVisualText(candidate, ocr(text))).toBe(false);
  expect(decideVisualImage(candidate, ocr(text), false, evidence).decision.passed).toBe(false);
});

it("does not infer a gambling offer from a generic headline without observed offer context",()=>{
 const text={state:"available",backend:"cpu",text:"이달의혜택을 한눈에",confidence:.7} as const;
 expect(shouldAnalyzeVisualText(candidate,text)).toBe(false);
});

it.each(["전강의 수강 개강맞이3만원 할인", "휴대폰 쿠폰5만원 증정", "응시료1만원 할인 자료집 제공"])("does not override clear ordinary transaction context with a positive model: %s",text=>{
 expect(shouldAnalyzeVisualText(candidate,ocr(text))).toBe(false);
 expect(decideVisualImage(candidate,ocr(text),false,evidence).decision.passed).toBe(false);
});
