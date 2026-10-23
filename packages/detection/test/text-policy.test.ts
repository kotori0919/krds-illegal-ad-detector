import { describe, expect, it } from "vitest";
import { chromium } from "playwright-core";
import { semanticGate, normalizeForMatch } from "../src/semantic.js";
import { homoglyphSignal } from "../src/homoglyph.js";
import { jamoSignal } from "../src/jamo.js";
import { detectPageCandidates } from "../src/pipeline.js";
import { MAX_TEXT_CODE_UNITS, restoreText } from "../src/text-policy.js";

describe("restoration and local public context", () => {
  it.each(["ｃａｓｉｎｏ 가입", "ＣＡＳＩＮＯ 가입", "Сasino 가입", "cаsino 신규가입", "C4sino 가입"])("restores a supported promotional spelling: %s", (raw) => {
    expect(semanticGate(raw).passed).toBe(true);
    expect(homoglyphSignal(raw)?.technique).toBe("HOMOGLYPH");
  });

  it.each(["ㅋㅏㅈㅣㄴㅗ 가입", "대출 무서류 승인", "ㄷㅐㅊㅜㄹ 무서류 승인", "ㄷ ㅐ ㅊ ㅜ ㄹ 간편 승인", "카ㅈㅣ노 첫충"])("restores attributable Jamo including compatibility finals: %s", (raw) => {
    expect(semanticGate(raw).passed).toBe(true);
    expect(jamoSignal(raw)?.technique).toBe("JAMO");
  });

  it.each(["도서 대출 기간은 14일입니다", "도서관 전자책 대출 연장 신청", "카지노 광고 예방 안내: \"첫충 보너스 지급\"이라는 광고를 신고하세요.", "불법광고 도움말: ‘ＣＡＳＩＮＯ 가입’ 문구를 차단하세요.", "원피스는 ㄹㅇ 재미가보장되있네 ㅋㅋㅋ"])("rejects legitimate local context: %s", (raw) => {
    expect(semanticGate(raw).passed).toBe(false);
  });

  it("does not make an unrelated transformed token into technique evidence", () => {
    expect(homoglyphSignal("카지노 Москва 여행 안내")).toBeUndefined();
    expect(homoglyphSignal("카지노 가입 ＡＢＣ 안내")).toBeUndefined();
    expect(jamoSignal("카지노 김ㅊㅓㄹ수 후기 ㅋㅋㅋ")).toBeUndefined();
    expect(normalizeForMatch("기간 14일, 전화 010-1234-5678")).toContain("14일");
    expect(normalizeForMatch("기간 14일, 전화 010-1234-5678")).not.toContain("la일");
  });

  it("keeps unquoted offers and observed destination corroboration", () => {
    expect(semanticGate("카지노 피해 신고 안내. 신규가입 보너스 지급").passed).toBe(true);
    expect(semanticGate('카지노 예방 안내: "첫충 보너스 지급" 예시. 신규가입 보너스 지급').passed).toBe(true);
    expect(semanticGate("카지노 피해 신고 안내", "https://casino.example/join").passed).toBe(true);
  });

  it("aligns restored terms after astral text and leaves unrelated numbers intact", () => {
    const raw = "😀 문의 010-1234-5678: Сasino 가입 14일";
    const verdict = semanticGate(raw);
    expect(verdict.matches.find((match) => match.term === "casino")).toMatchObject({
      start: raw.indexOf("Сasino"), end: raw.indexOf("Сasino") + 6, raw: "Сasino", transforms: ["cyrillic", "case"],
    });
    expect(normalizeForMatch("😀 C4sino 가입")).toContain("casino");
    expect(normalizeForMatch("xC4sinox 가입")).not.toContain("casino");
    expect(verdict.normalizedText).toContain("01012345678");
    expect(verdict.normalizedText).toContain("14일");
    expect(verdict.offerSpans.map((span) => raw.slice(span.start, span.end))).toEqual(["가입"]);
  });

  it("reports bounded analysis instead of claiming absent tail text was checked", () => {
    const raw = "가".repeat(MAX_TEXT_CODE_UNITS) + "ＣＡＳＩＮＯ 가입";
    expect(restoreText(raw).truncated).toBe(true);
    const verdict = semanticGate(raw);
    expect(verdict.passed).toBe(false);
    expect(verdict.reasonCodes).toContain("TEXT_ANALYSIS_LIMIT");
    expect(verdict.matches).toEqual([]);
  });

  it("executes the restored decision and independent concealed comment in Chromium", async () => {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.setContent(`<main>
        <p id="library" style="display:none">도서 대출 기간은 14일입니다</p>
        <p id="quote" style="opacity:0">카지노 광고 예방 안내: "첫충 보너스 지급"이라는 광고를 신고하세요.</p>
        <p id="place">카지노 Москва 여행 안내</p>
        <p id="f372" style="opacity:0">원피스는 ㄹㅇ 재미가보장되있네 ㅋㅋㅋ</p>
        <p id="upper">ＣＡＳＩＮＯ 가입</p><p id="cyr">Сasino 가입</p>
        <p id="jamo">ㄷㅐㅊㅜㄹ 무서류 승인</p>
        <article><h2>피해 신고와 교육</h2><p id="comment" style="opacity:0">ＣＡＳＩＮＯ 신규가입 첫충 보너스 지급</p></article>
      </main>`);
      const found = await detectPageCandidates(page, { pageUrl: "https://fixture.example/" });
      expect(found.map((entry) => `${entry.selector}:${entry.technique.technique}`).sort()).toEqual([
        "#comment:HOMOGLYPH", "#comment:TRANSPARENT", "#cyr:HOMOGLYPH", "#jamo:JAMO", "#upper:HOMOGLYPH",
      ]);
      for (const entry of found) expect(await page.locator(entry.selector).textContent()).toBe(entry.technique.rawText);
    } finally {
      await browser.close();
    }
  }, 30000);

  it("maps owned text to original evidence and does not attribute a quoted disguise to a plain offer", async () => {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.setContent(`<div id="parent">😀 Сasino<p>독립된 도서 대출 안내</p> 가입</div>
        <p id="quoted">카지노 예방 안내: "ＣＡＳＩＮＯ 가입" 광고 예시. 카지노 신규가입</p>
        <p id="wide">Ｋ카지노 신규가입</p>`);
      const found = await detectPageCandidates(page, { pageUrl: "https://fixture.example/" });
      expect(found.map((entry) => entry.selector).sort()).toEqual(["#parent", "#wide"]);
      const parent = found.find((entry) => entry.selector === "#parent")!;
      const policy = parent.textPolicy!;
      expect(policy.sourceMapping.map((part) => parent.technique.rawText.slice(part.sourceStart, part.sourceStart + part.length)).join("")).toBe(policy.analysisText);
      expect(policy.matches.find((match) => match.term === "casino")?.raw).toBe("Сasino");
      const wide = found.find((entry) => entry.selector === "#wide")!;
      expect(wide.textPolicy?.techniqueSpans[0]?.raw).toBe("Ｋ카지노");
    } finally {
      await browser.close();
    }
  }, 30000);

  it("omits an oversized source owner explicitly while preserving a later complete owner", async () => {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.setContent(`<div id="large">${"가".repeat(MAX_TEXT_CODE_UNITS)}<span>ＣＡＳＩＮＯ 가입</span></div><p id="complete">Сasino 가입</p>`);
      const issues: string[] = [];
      const found = await detectPageCandidates(page, { pageUrl: "https://fixture.example/", onTextCollectionIssue: (issue) => issues.push(issue.detail) });
      expect(found.map((entry) => entry.selector)).toEqual(["#complete"]);
      expect(issues).toContain("owner-text-limit");
    } finally {
      await browser.close();
    }
  }, 30000);
});
