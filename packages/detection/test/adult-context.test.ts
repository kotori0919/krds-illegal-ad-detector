import { describe, expect, it } from "vitest";
import { semanticGate } from "../src/semantic.js";

// Development/adversarial cases; not holdout. Pure source tests, no browser/model.
const contrasts = [
  ["성인방송 지금 가입", "성인방송 가입하지 마세요"],
  ["야동 무료시청", "야동 무료시청 금지"],
  ["성인방송 가입 즉시시청", "성인방송 가입 불가"],
  ["성인영상 자료실 신규가입 무료시청", "성인영상 예방 자료 무료시청"],
  ["성인방송 상담 후 가입 즉시시청", "성인방송 치료 상담 회원가입"],
  ["성인사이트 차단없이 무제한시청", "성인사이트 차단 프로그램 회원가입"],
  ["성인영상\n신규가입 무료시청", "성인영상.신규가입 무료시청"],
  ["성인영상 무료체험 신청", "성인영상 무료체험 신청 금지"],
  ["성.인.방.송 신규가입", "포르노.회원가입 안내"],
  ["성인방송 가입불가.성인영상 무료시청", "성인방송 가입불가.회원가입 안내"],
  ["성인영상 자료실 가입", "도서관 성인 영상자료 대출 회원가입"],
  ["성인영상 무료시청", "성인 성교육 회원가입"],
  ["성인방송 가입불가 무료시청", "성인방송 무료시청은 금지"],
  ["성인영상 무료체험 제공", '교육 자료: "성인영상 신규가입" 예시. 무료체험 신청'],
] as const;

describe("adult CTA scope and intent contrasts", () => {
  it.each(contrasts)("separates solicitation '%s' from informational/negated '%s'", (positive, negative) => {
    const yes = semanticGate(positive, "https://media.example/watch");
    const no = semanticGate(negative, "https://media.example/watch");
    expect(yes.passed).toBe(true);
    expect(yes.offerIntent).toBe(true);
    expect(yes.offerSpans.length).toBeGreaterThan(0);
    expect(no.passed).toBe(false);
    for (const span of yes.offerSpans) expect(positive.slice(span.start, span.end)).toBe(span.raw);
  });

  it("attributes only the affirmed CTA and its transformed category", () => {
    const text = "성.인.방.송 가입하지 마세요. 성인영상 무료체험 신청";
    const gate = semanticGate(text);
    expect(gate.passed).toBe(true);
    expect(gate.offerSpans.map(span => span.raw)).toEqual(["무료체험 신청"]);
    expect(gate.adMatches.map(match => match.raw)).toEqual(["성인영상", "무료체험"]);
    expect(gate.detail).toContain("adult-service-solicitation-v2");
    expect(gate.policyVersion).toBe("text-policy-2");
  });

  it("preserves gambling and financial solicitation independently of adult context", () => {
    expect(semanticGate("카지노 첫충 보너스 지급").passed).toBe(true);
    expect(semanticGate("대출 무서류 승인").passed).toBe(true);
    expect(semanticGate("도서관 전자책 대출 회원가입").passed).toBe(false);
  });

  it("does not claim unsupported English adult categories or CTA coverage", () => {
    expect(semanticGate("ＰＯＲＮ 신규가입 무료시청").passed).toBe(false);
    expect(semanticGate("성인방송 JOIN NOW WATCH FREE").passed).toBe(false);
  });
});

it.each([
  "성인방송 가입 절대 금지",
  "야동 무료시청 절대 하지 마세요",
  "야동 무료시청 절대로 하지 마세요",
  "성인방송 가입은 절대 금지됨",
  "성인방송 가입하지 말아 주세요",
  "성인방송 가입 금지됨",
  "성인방송 가입 절대 반드시 불가",
  "야동 무료시청 무조건 금지",
])("rejects a nearby modified prohibition: %s", text => {
  const gate = semanticGate(text, "https://media.example/watch");
  expect(gate.passed).toBe(false);
  expect(gate.offerIntent).toBe(false);
  expect(gate.offerSpans).toEqual([]);
});

it("keeps a separate affirmative CTA after a modified prohibition", () => {
  const gate = semanticGate("성인방송 가입 절대 금지. 성인영상 무료시청");
  expect(gate.passed).toBe(true);
  expect(gate.offerSpans.map(span => span.raw)).toEqual(["무료시청"]);
});

it("does not treat emphasis or blocking bypass wording alone as negation", () => {
  for (const text of ["성인방송 가입 무조건 혜택 제공", "성인영상 무료시청 반드시 제공", "성인사이트 차단없이 무제한시청"]) {
    expect(semanticGate(text).passed).toBe(true);
  }
});
