import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { validateOfficialResultText } from "@krds-detector/contracts";
import { scanSite } from "../src/scan.js";

const pages: Record<string, string> = {
  "/": `
    <a id="skip" href="#content" style="position:absolute;left:-9999px">본문으로 이동</a>
    <nav><a href="/report">신고 안내</a><a href="/accessibility">접근성</a>
    <a href="/glossary">용어 교육</a><a href="/campaign">예방 캠페인</a></nav>
    <main id="content"><h1>공공 안전 정보</h1><p id="intro">불법광고 피해 예방 자료입니다.</p></main>`,
  "/report": `
    <h1>불법 도박 신고 안내</h1>
    <a id="report-guide" href="/public/casino-report" style="display:none">카지노 피해 신고 절차 안내</a>
    <p id="casino-report">Ｃasino 범죄 예방과 카지노 피해 신고 절차를 안내합니다.</p>
    <p id="loan-report">대출 사기 피해 신고는 관할 기관에 문의하세요.</p>
    <section id="dialog" hidden><p id="dialog-help">대출 피해 신고 양식을 작성하는 방법</p></section>`,
  "/accessibility": `
    <h1>접근성 설정</h1>
    <div id="collapsed-help" style="display:none">대출 피해 신고 도움말</div>
    <div role="tablist"><button role="tab" aria-selected="true">기본 정보</button></div>
    <div id="chart-description" style="position:absolute;left:-9999px">카지노 피해 신고 통계 차트 설명</div>`,
  "/glossary": `
    <h1>다국어 도박 예방 교육</h1>
    <p id="jamo-glossary">ㅋㅏㅈㅣㄴㅗ는 카지노를 뜻하는 자모 표기입니다. 광고를 신고하세요.</p>
    <p id="multi">Casino crime prevention / 카지노 범죄 예방</p>
    <svg role="img" aria-label="대출 사기 피해 통계"><title>대출 사기 피해 통계</title></svg>`,
  "/campaign": `
    <h1>광고 차단 캠페인</h1>
    <p id="campaign-copy">카지노 가입 광고를 발견하면 신고해 주세요.</p>
    <div id="carousel-hidden" style="opacity:0">도박 광고 신고 방법을 설명하는 다음 슬라이드</div>`,
};

let server: Server;
let origin = "";
beforeAll(async () => {
  server = createServer((request, response) => {
    const body = pages[new URL(request.url ?? "/", "http://fixture.local").pathname];
    if (!body) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(`<!doctype html><html lang="ko"><body>${body}</body></html>`);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture port unavailable");
  origin = `http://127.0.0.1:${String(address.port)}`;
});
afterAll(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); });

describe("L2 public-information false-positive site", () => {
  it("keeps education, reporting and hidden accessibility text out of official findings", async () => {
    for (const concurrency of [1, 2, 3, 4]) {
      const output = await scanSite({ entryUrl: `${origin}/`, crawl: {
        concurrency, settleMs: 300, perPageMs: 7000,
        limits: { maxPages: 5, maxDepth: 1, timeoutSec: 60 },
      } });
      expect(output.pagesVisited).toBe(5);
      expect(output.failedPages).toBe(0);
      expect(output.timedOut).toBe(false);
      expect(validateOfficialResultText(output.json).ok).toBe(true);
      expect(output.result.findings).toEqual([]);
      expect(output.extraResult.findings).toEqual([]);
    }
  }, 30_000);
});
