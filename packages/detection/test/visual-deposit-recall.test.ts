import { expect, it } from "vitest";
import type { TextEmbeddingEvidence } from "@krds-detector/contracts";
import type { VisualCandidate } from "../src/creative.js";
import { decideVisualImage, depositCreativeTerms } from "../src/visual-decision.js";

// Transcripts below are the actual recognition output of the offline Korean
// engine for fixtures/real-banners, including its corruptions (첫중 for 첫충,
// 입급/입들금 for 입금, 메이백/매이백 for 페이백). They are frozen strings so
// the gate is tested deterministically without OCR or network access.
const candidate = (destinationUrl: string | undefined, evidence: string[] = ["ad-marker", "external-destination"],
  visibleDomAdTexts: string[] = []): VisualCandidate => ({ sourceKind: "img", pageUrl: "https://blacktoon424.com/",
  frameUrl: "https://blacktoon424.com/", location: "#poster", destinationUrl, candidateEvidence: evidence, visibleDomAdTexts });
const decide = (text: string, overrides: Partial<VisualCandidate> = {}) => decideVisualImage({ ...candidate("https://angbet-2.com/?agentCode=1744"), ...overrides },
  { state: "available", backend: "ppocrv5-korean-mobile-cpu-v1", text, confidence: 0.7 }, false);

const promoted = {
  "blacktoon-1.png": "첫충\n페이백10x\n콤프4\n가입코드BTBT",
  "blacktoon-2.png": "신규\n=\n3333\n가입코드\n천민인증X\n무한\n완전/콤프\n3.5%\n무기명(태데회원가입기능\n매탈 1억 상금 토너먼트 진행",
  "blacktoon-3.png": "값입\n:\n첫중\n.\n무기명\n가능\nC\n테더\n가입코드\n급액계판X매이백10%\nM3.5%\nER15X",
  "blacktoon-4.png": "신규40×무한15x\n메이백1다×금프7×\n3+25+310+5\n30+12\n20+\nB\n가입코드:BK\n50+20\n100+35200+70",
  "blacktoon-5.png": "가입코드\n콤프\n40%\n10%\n4%\nBBB\nMACN\n이사지원 100만\n미더 입들금\n가능\n마\n·\nH\n5+310+550+20\n100±35\n200+70",
  "blacktoon-7.png": "페이백\n10%\n콤프\n3.5%\n•USDT\n입금\n가능\n테더\n1744\n가입코드\n무제한\n행전·무제재\n운을·모든은철 가능",
  "blacktoon-8.png": "가입코드\n9699\nL\n업계최고록프\n페이백10%\n4%\n모든은법\n테더 입급가능\n가업가는",
};

it.each(Object.entries(promoted))("reads the observed deposit offer on %s as ad semantics", (file, text) => {
  const verdict = decide(text);
  expect(verdict.decision.passed).toBe(true);
  expect(verdict.decision.rule).toBe("image-only-ad-v3");
  // A passed image-only finding must carry observed terms for the validator.
  expect(verdict.gate.matchedTerms.length).toBeGreaterThan(0);
});

it("keeps a rebate table without settlement or deposit wording on the review path", () => {
  const text = "콤프\n131백\n1E%\n스모츠\n무기영B더\n2원기월\n7122\n고맥전응\n&\nHFI\n1억\n24";
  const embedding: TextEmbeddingEvidence = { state: "available", model: "embeddinggemma-2-text-f32", policy: "text-ad-embedding-v3",
    revision: "daa72c51243991dfcaf9f9137d2c573d8f7790c0", positiveSimilarity: 0.6, negativeSimilarity: 0.57,
    margin: 0.03, threshold: 0, passed: true, elapsedMs: 5 };
  expect(depositCreativeTerms(decide(text).gate.normalizedText)).toEqual([]);
  expect(decide(text).decision.passed).toBe(false);
  expect(decideVisualImage(candidate("https://angbet-2.com/?agentCode=1744"),
    { state: "available", backend: "ppocrv5-korean-mobile-cpu-v1", text, confidence: 0.7 }, false, embedding).decision.passed).toBe(true);
});

const negatives = {
  "negative-logo.png": "BLACKTOON\n",
  "negative-commercial.png": "그 무료\n\n신규회원 가입 쿠폰 지\n\n= T=\n\n배송\n",
  "negative-public-notice.png": "카지노 대출 광고 신고 안내\n\n불법 광고를 발견하면 신고해 주세요\n",
  "negative-library-service.png": "도서관 전자책 대출 안내\n",
};

it.each(Object.entries(negatives))("keeps the control fixture %s a non-finding", (_, text) => {
  expect(decide(text).decision.passed).toBe(false);
});

it.each([
  "가입코드 9699 입금하면 10% 보너스 지급",
  "테더 입금 10% 보너스 이벤트",
  "교통카드 충전 10% 보너스",
  "쇼핑 페이백10% 적립 입금 안내",
  "응시료1만원 할인 자료집 제공",
  "콤프 3.5% 이용 통계",
  "페이백10% 콤프3.5%",
])("never turns one kind of wording or an ordinary transaction into a deposit offer: %s", (text) => {
  expect(decide(text).decision.passed).toBe(false);
});

it.each([
  "첫충70% 페이백10% 콤프3.5% 입금 광고를 발견하면 신고해 주세요.",
  "불법도박 교육: 카지노 첫충·페이백·콤프 3.5% 입금 가능 문구를 신고하세요",
])("keeps reporting and education text excluded even with the complete offer: %s", (text) => {
  expect(decide(text).decision.passed).toBe(false);
});

it("still requires a second axis: observed link or marker plus no visible DOM equivalent", () => {
  const text = promoted["blacktoon-8.png"];
  expect(decide(text, { destinationUrl: undefined, candidateEvidence: [] }).decision.passed).toBe(false);
  expect(decide(text, { destinationUrl: "https://blacktoon424.com/offer", candidateEvidence: [] }).decision.passed).toBe(false);
  expect(decide(text, { visibleDomAdTexts: [text] }).decision.passed).toBe(false);
  // An external link alone, without a readable offer, stays a miss.
  expect(decide("브랜드 로고").decision.passed).toBe(false);
});
