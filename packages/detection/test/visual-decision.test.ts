import { expect, it } from "vitest";
import type { VisualCandidate } from "../src/creative.js";
import { decideVisualImage } from "../src/visual-decision.js";

const candidate: VisualCandidate = {
  sourceKind: "img", pageUrl: "https://directory.example/address-collection",
  frameUrl: "https://directory.example/address-collection", location: "#numeric-image",
  resourceUrl: "https://static.example/0722.jpg",
  destinationUrl: "https://advertiser.example/?code=0722",
  candidateEvidence: ["external-destination"], visibleDomAdTexts: [],
};
const decide = (text: string, overrides: Partial<VisualCandidate> = {}) => decideVisualImage(
  { ...candidate, ...overrides }, { state: "available", backend: "offline", text, confidence: 0.82 }, false);

it("admits the observed high-stakes casino banner with an opaque external click target", () => {
  const verdict = decide("카지노&스포츠고액전용\n\nHom\n\n깃들\n");
  expect(verdict.decision.passed).toBe(true);
  expect(verdict.gate.matchedTerms).toContain("카지노");
});

it.each(["카지노 가입 보너스 지급", "슬롯 신규회원 첫입금 혜택"])("corroborates an external image offer: %s", (text) => {
  expect(decide(text).decision.passed).toBe(true);
});

it.each(["카지노", "카지노 통계 교육", "카지노 고액전용 차단 안내", "충전기 신규회원 할인", "브랜드 로고", "쿠폰 지급"])(
  "does not classify a linked category, public notice or ordinary commercial image: %s", (text) => {
    expect(decide(text).decision.passed).toBe(false);
  });

it.each([undefined, "https://directory.example/?code=0722", "javascript:void(0)", "invalid"])(
  "requires an actual external HTTP destination, not a marker alone: %s", (destinationUrl) => {
    expect(decide("카지노&스포츠고액전용", { destinationUrl }).decision.passed).toBe(false);
  });

it("retains the visible DOM equivalence and missing OCR guards", () => {
  expect(decide("카지노 가입 보너스 지급", { visibleDomAdTexts: ["카지노 가입 보너스 지급"] }).decision.passed).toBe(false);
  expect(decideVisualImage(candidate, { state: "unavailable", backend: "offline", reason: "recognition-error" }, false)
    .decision.passed).toBe(false);
});
