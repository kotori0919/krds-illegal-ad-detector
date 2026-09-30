import { describe, expect, it } from "vitest";
import {
  detectTechniques,
  expectedPairs,
  extractIdElements,
  hasAdSemantics,
  loadGroundTruth,
  normalizeForMatch,
  predictStatic,
  scoreStatic,
} from "../src/evaluate.js";

describe("ground truth", () => {
  it("covers all GOAL Phase 2 case classes", async () => {
    const cases = await loadGroundTruth();
    const kinds = new Set(cases.map((c) => `${c.kind}:${c.id}`));
    for (const id of [
      "positive:hg-casino",
      "positive:hg-baccarat",
      "positive:jamo-casino",
      "positive:jamo-loan",
      "positive:tr-opacity",
      "positive:tr-samecolor",
      "positive:off-displaynone",
      "positive:off-negpos",
      "positive:off-fontsize",
      "positive:combo-hg",
      "positive:frame-jamo",
      "positive:query-hg",
      "positive:delayed-offscreen",
      "positive:comment-hidden",
      "negative:neg-skip-link",
      "negative:neg-nav",
      "negative:neg-modal",
      "negative:neg-responsive",
      "negative:neg-jamo",
      "negative:neg-unicode",
      "negative:neg-appstate",
      "structural:struct-dedup",
      "structural:struct-query-clean",
    ]) {
      expect(kinds.has(id), id).toBe(true);
    }
  });

  it("expects 17 positive pairs (combo + delayed + comment count twice)", async () => {
    const cases = await loadGroundTruth();
    expect(expectedPairs(cases).size).toBe(17);
  });
});

describe("semantic gate", () => {
  it("passes ad terms after NFKC + space removal", () => {
    expect(hasAdSemantics("Ｋ카지노 신규가입")).toBe(true);
    expect(hasAdSemantics("대출 24시 간편 승인")).toBe(true);
  });

  it("rejects legitimate hidden UI text", () => {
    expect(hasAdSemantics("본문으로 건너뛰기")).toBe(false);
    expect(hasAdSemantics("임시 저장된 초안 상태")).toBe(false);
    expect(hasAdSemantics("한글 자모 ㅋㅋㅋ 교육 자료")).toBe(false);
  });

  it("keeps raw text separate from normalized match form", () => {
    expect(normalizeForMatch("Ｋ카지노")).toBe("K카지노");
  });
});

describe("technique signals", () => {
  it("flags fullwidth homoglyph", () => {
    expect(
      detectTechniques({ id: "x", rawText: "Ｋ카지노", styleAttr: "", classAttr: "" }, ""),
    ).toContain("HOMOGLYPH");
  });

  it("flags Compatibility Jamo loan ad", () => {
    expect(
      detectTechniques({ id: "x", rawText: "대출 24시 간편 승인", styleAttr: "", classAttr: "" }, ""),
    ).toContain("JAMO");
  });

  it("does not flag legitimate Jamo education text as JAMO", () => {
    expect(
      detectTechniques(
        { id: "x", rawText: "한글 자모 ㅋㅋㅋ 교육 자료: 자음과 모음의 결합 원리", styleAttr: "", classAttr: "" },
        "",
      ),
    ).not.toContain("JAMO");
  });

  it("flags opacity:0 and same-fg-bg as TRANSPARENT", () => {
    expect(
      detectTechniques({ id: "x", rawText: "대출", styleAttr: "opacity: 0", classAttr: "" }, ""),
    ).toContain("TRANSPARENT");
    expect(
      detectTechniques({ id: "x", rawText: "대출", styleAttr: "", classAttr: "same-fg-bg" }, ""),
    ).toContain("TRANSPARENT");
  });

  it("flags display:none, negative pos, font-size:0 as OFFSCREEN", () => {
    for (const style of ["display: none", "position: absolute; left: -9999px", "font-size: 0"]) {
      expect(detectTechniques({ id: "x", rawText: "대출", styleAttr: style, classAttr: "" }, "")).toContain(
        "OFFSCREEN",
      );
    }
  });

  it("extracts id elements with style and class", () => {
    const els = extractIdElements('<p id="a" style="opacity: 0" class="x">대출</p>');
    expect(els).toEqual([{ id: "a", rawText: "대출", styleAttr: "opacity: 0", classAttr: "x" }]);
  });
});

describe("static baseline", () => {
  it("scores 17 TP with zero FP/FN on fixtures", async () => {
    const cases = await loadGroundTruth();
    const { predictions, elapsedMs } = await predictStatic();
    const m = scoreStatic(cases, predictions, elapsedMs);
    expect(m.missing).toEqual([]);
    expect(m.unexpected).toEqual([]);
    expect(m.tp).toBe(17);
    expect(m.fp).toBe(0);
    expect(m.fn).toBe(0);
    expect(m.precision).toBe(1);
    expect(m.recall).toBe(1);
  }, 30000);
});
