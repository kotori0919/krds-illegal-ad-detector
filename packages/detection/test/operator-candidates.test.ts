import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import { validateOfficialResultText, validateScanDetailBundle } from "@krds-detector/contracts";
import { scanSite } from "../src/scan.js";

const ordinaryComment = "원피스는 ㄹㅇ 재미가보장되있네 ㅋㅋㅋ";
const fixture = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
  <style>body { color:#111; background:#fff; }
    @media(min-width:768px) { #compact-categories, [aria-controls="compact-categories"] { display:none; } }
    @media(max-width:767px) { #full-categories { display:none; } }
  </style>
  </head><body>
  <nav aria-label="자료 분류">
    <button aria-controls="compact-categories" aria-expanded="false"
      onclick="const panel=document.getElementById('compact-categories');panel.hidden=!panel.hidden;this.setAttribute('aria-expanded',String(!panel.hidden))">자료 분류 보기</button>
    <ul id="compact-categories" hidden><li><a id="collapsed-category" href="/game/baccarat">바카라</a></li></ul>
    <div id="full-categories"><a id="visible-category" href="/game/baccarat">바카라</a></div>
  </nav>
  <main><h1>콘텐츠 이용 안내</h1><p id="ordinary-comment">${ordinaryComment}</p>
    <a id="hidden-offer" href="/game/baccarat" style="display:none">카지노 첫충 보너스 지급</a>
    <section id="report-help" hidden><p id="hidden-report">카지노 피해 신고 절차와 도움말</p></section>
  </main></body></html>`;

async function scanOwnedPage(html: string) {
  const site = createServer((_request, response) => {
    response.setHeader("content-type", "text/html; charset=utf-8");
    response.end(html);
  });
  await new Promise<void>((resolve) => site.listen(0, "127.0.0.1", resolve));
  const address = site.address();
  if (!address || typeof address === "string") throw new Error("fixture port unavailable");
  try {
    return await scanSite({ entryUrl: `http://127.0.0.1:${address.port}/`,
      crawl: { concurrency: 1, settleMs: 0, perPageMs: 10_000,
        limits: { maxPages: 1, maxDepth: 0, timeoutSec: 30 } } });
  } finally { await new Promise<void>((resolve) => site.close(() => resolve())); }
}

describe("operator candidate review on an owned live site", () => {
  it("retains a deliberate hidden offer while excluding ordinary comments, responsive controls and reporting help", async () => {
    const output = await scanOwnedPage(fixture);
    expect(output.detailBundle.coverage.checkedPages).toBe(1);
    expect(output.failedPages).toBe(0);
    expect(output.timedOut).toBe(false);
    expect(validateOfficialResultText(output.json).ok).toBe(true);
    expect(validateScanDetailBundle(output.detailBundle, output.result, output.extraResult).ok).toBe(true);
    expect(output.result.findings.map((finding) => ({ location: finding.location,
      evidenceText: finding.evidence_text, technique: finding.technique }))).toEqual([
      { location: "#hidden-offer", evidenceText: "카지노 첫충 보너스 지급", technique: "OFFSCREEN" },
    ]);
    expect(output.detailBundle.findings[0]?.destinationUrl).toBe(new URL("/game/baccarat", output.result.meta.entry_url).href);
    expect(output.detailBundle.findings[0]?.matchedTerms).toEqual(expect.arrayContaining(["카지노", "첫충", "보너스"]));
  }, 40_000);

  it("requires real navigation evidence and retains offers/actions even inside convincing UI", async () => {
    const html = `<!doctype html><html lang="ko"><body>
      <nav><button aria-controls="other controlled-panel" aria-expanded="false">분류</button>
        <div id="controlled-panel" hidden><a id="controlled-category" href="/game/baccarat">바카라</a></div></nav>
      <div role="navigation"><a id="mirrored-category" href="/game/baccarat" hidden>바카라</a>
        <a href="/game/baccarat">바카라</a></div>
      <a id="ordinary-hidden-category" href="/game/baccarat" hidden>바카라</a>
      <nav><a id="uncontrolled-category" href="/game/baccarat" hidden>바카라</a></nav>
      <nav><button aria-controls="offer-panel" aria-expanded="false">분류</button>
        <div id="offer-panel" hidden><a id="nav-offer" href="/game/baccarat">카지노 첫충 보너스 지급</a></div>
        <a href="/game/baccarat">카지노 첫충 보너스 지급</a></nav>
      <nav><button aria-controls="action-panel" aria-expanded="false">분류</button>
        <div id="action-panel" hidden><a id="nav-action" href="/casino/join">안내</a></div></nav>
      <nav><div aria-controls="fake-panel" aria-expanded="false">분류</div>
        <div id="fake-panel" hidden><a id="fake-control-category" href="/game/baccarat">바카라</a></div></nav>
      <nav><button disabled role="button" aria-controls="disabled-panel" aria-expanded="false">분류</button>
        <div id="disabled-panel" hidden><a id="disabled-control-category" href="/game/baccarat">바카라</a></div></nav>
      <div id="duplicate-panel"></div><nav><button aria-controls="duplicate-panel" aria-expanded="false">분류</button>
        <div id="duplicate-panel" hidden><a id="duplicate-control-category" href="/game/baccarat">바카라</a></div></nav>
      <nav><a id="different-text-category" href="/game/baccarat" hidden>바카라</a>
        <a href="/game/baccarat">바카라 자료실</a></nav>
      <nav><a id="different-destination-category" href="/game/baccarat" hidden>바카라</a>
        <a href="/reference/baccarat">바카라</a></nav>
      <nav><a id="transparent-mirror-category" href="/game/baccarat" hidden>바카라</a>
        <a id="transparent-mirror" href="/game/baccarat" style="opacity:0">바카라</a></nav>
      </body></html>`;
    const output = await scanOwnedPage(html);
    expect(output.detailBundle.coverage.checkedPages).toBe(1);
    expect(output.failedPages).toBe(0);
    expect(output.timedOut).toBe(false);
    expect(output.result.findings.map((finding) => `${finding.location}:${finding.technique}`).sort()).toEqual([
      "#different-destination-category:OFFSCREEN", "#different-text-category:OFFSCREEN", "#fake-control-category:OFFSCREEN",
      "#disabled-control-category:OFFSCREEN", "#duplicate-control-category:OFFSCREEN",
      "#nav-action:OFFSCREEN", "#nav-offer:OFFSCREEN", "#ordinary-hidden-category:OFFSCREEN",
      "#transparent-mirror-category:OFFSCREEN", "#transparent-mirror:TRANSPARENT", "#uncontrolled-category:OFFSCREEN",
    ].sort());
    expect(validateOfficialResultText(output.json).ok).toBe(true);
    expect(validateScanDetailBundle(output.detailBundle, output.result, output.extraResult).ok).toBe(true);
  }, 40_000);
});
