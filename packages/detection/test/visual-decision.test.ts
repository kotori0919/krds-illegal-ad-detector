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

it("corroborates the observed external banner's compound gambling deposit offer", () => {
  const verdict = decide("페이백\n10%\n콤프\n3.5%\nUSDT\n테더\n입금\n가능");
  expect(verdict.decision.passed).toBe(true);
  expect(verdict.gate.matchedTerms).toEqual(expect.arrayContaining(["페이백", "콤프"]));
});

it.each([
  "온라인 게임 첫충100% 페이백 쿠폰 이벤트",
  "정식 모바일 게임 첫 충전10% 페이백 보상 지급",
  "쇼핑 페이백10% 적립 입금 안내",
  "카지노 첫충·페이백·콤프 3.5% 불법광고 신고 및 예방 안내",
  "불법도박 교육: ‘페이백10% 콤프3.5% 입금 가능’ 문구를 신고하세요",
  "콤프 3.5% 이용 통계",
  "페이백10% 콤프3.5%",
  "첫충70% 페이백10% 콤프3.5% 입금 광고를 발견하면 신고해 주세요.",
  "첫충70% 페이백10% 콤프3.5% 입금 문구는 도박 예방을 위한 교육용 예시입니다.",
  "교육: 첫충70% 페이백10% 콤프3.5% 입금 광고를 주의하세요.",
])("does not turn an ordinary offer, public notice or incomplete compound into a deposit ad: %s", (text) => {
  expect(decide(text).decision.passed).toBe(false);
});

it.each(["신규회원 쿠폰 지급 브랜드 이벤트", "무료체험 신청 제공", "카지노", "온라인 게임 첫충100% 페이백 쿠폰 이벤트"])(
  "does not treat a banner marker as proof of illegal semantics: %s", (text) => {
    expect(decide(text, { candidateEvidence: ["ad-marker", "external-destination"] }).decision.passed).toBe(false);
  });
