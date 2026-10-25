import { describe, expect, it } from "vitest";
import { chromium } from "playwright-core";
import { semanticGate } from "../src/semantic.js";
import { detectPageCandidates } from "../src/pipeline.js";

// Development/regression examples. Evaluation cases live separately and are not imported here.
describe("adult service solicitation", () => {
  it.each([
    "성인영상 신규가입 즉시 시청", "야동 성인방송 지금 가입", "성인 사이트 무료 시청",
    "음란물 지금 입장", "포르노 무제한 시청", "성인방송 예방 안내. 성인영상 지금 가입",
  ])("recognizes service and solicitation together: %s", text => {
    const gate = semanticGate(text, "https://media.example/watch");
    expect(gate.passed).toBe(true);
    expect(gate.reasonCodes).toContain("AD_CATEGORY");
    expect(gate.reasonCodes).toContain("AD_OFFER");
    expect(gate.offerSpans.length).toBeGreaterThan(0);
    for (const span of [...gate.matches, ...gate.offerSpans]) expect(text.slice(span.start, span.end)).toBe(span.raw);
  });

  it.each([
    "성인 예방 교육 안내", "성인 성교육 회원가입", "성인영상", "성인방송 단속 기사",
    "성인영상 예방 교육 회원가입", "성인방송 가입 광고 신고 안내", "야동 시청 중독 예방 상담 신청",
    '성인영상 예방 안내: "신규가입 즉시 시청" 광고 예시',
    '교육 자료: "성인영상 신규가입" 문구를 차단하세요',
    "성인영상 무료 시청 광고 피해 예방", "도서관 성인영상 자료 무료 시청 회원가입",
    "도서관 성인 영상자료 대출 회원가입", // Promoted from first evaluation after its observed FP.
    "정상 교육 가입 안내. 성인영상 중독 예방", "성인 건강검진 예약",
  ])("rejects public information and unsupported category mentions: %s", text => {
    expect(semanticGate(text, "https://media.example/watch").passed).toBe(false);
  });

  it("reproduces the independent Chromium miss and checks four techniques and raw evidence", async () => {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      const rows = [
        { id: "adult-opacity", text: "성인영상 신규가입 즉시 시청", style: "opacity:0", technique: "TRANSPARENT" },
        { id: "adult-hidden", text: "야동 성인방송 지금 가입", style: "display:none", technique: "OFFSCREEN" },
        { id: "adult-offscreen", text: "성인방송 지금 입장", style: "position:absolute;left:-8000px", technique: "OFFSCREEN" },
        { id: "adult-jamo", text: "ㅅㅓㅇㅇㅣㄴ영상 신규가입", style: "", technique: "JAMO" },
        { id: "adult-separated", text: "성.인.영.상 신규가입", style: "", technique: "HOMOGLYPH" },
        { id: "casino-opacity", text: "카지노 첫충 보너스 지급", style: "opacity:0", technique: "TRANSPARENT" },
        { id: "loan-hidden", text: "대출 무서류 승인", style: "display:none", technique: "OFFSCREEN" },
      ];
      await page.setContent(`<main>${rows.map(r => `<a id="${r.id}" href="https://media.example/watch" style="${r.style}">${r.text}</a>`).join("")}
        <p style="opacity:0">성인 예방 교육 안내</p><p style="display:none">성인영상 예방 교육 회원가입</p>
        <p>성.인.영.상 예방 교육</p><p>ㅅㅓㅇㅇㅣㄴ영상 예방 교육</p>
        <p style="position:absolute;left:-9000px">성인방송 무료 시청 광고 신고 안내</p>
        <p id="visible">성인영상 신규가입 즉시 시청</p></main>`);
      const found = await detectPageCandidates(page, { pageUrl: "https://fixture.example/" });
      expect(found.map(c => `${c.selector}:${c.technique.technique}`).sort()).toEqual(rows.map(r => `#${r.id}:${r.technique}`).sort());
      for (const c of found) {
        const row = rows.find(r => `#${r.id}` === c.selector)!;
        expect(await page.locator(c.selector).count()).toBe(1);
        expect(c.location).toBe(c.selector);
        expect(c.technique.rawText).toBe(row.text);
        expect(c.illegalAd.rawText).toBe(row.text);
        expect(c.decision.detail).toContain("AD_CATEGORY");
        expect(c.technique.detail.length).toBeGreaterThan(0);
        if (row.style === "display:none") {
          expect(c.observed.css.display).toBe("none");
          expect(c.technique.detail).toContain("display:none");
        }
        if (row.style === "opacity:0") expect(c.technique.detail).toContain("opacity:0");
        if (row.id === "adult-offscreen") expect(c.observed.box.x).toBeLessThan(0);
        if (c.technique.technique === "JAMO" || c.technique.technique === "HOMOGLYPH") expect(c.textPolicy?.techniqueSpans.length).toBeGreaterThan(0);
      }
    } finally { await browser.close(); }
  }, 30000);
});
