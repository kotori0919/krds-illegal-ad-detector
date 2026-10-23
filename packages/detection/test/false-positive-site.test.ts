import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { validateOfficialResultText } from "@krds-detector/contracts";
import { scanSite } from "../src/scan.js";

const pages: Record<string, string> = {
  "/": `
    <a id="skip" href="#content" style="position:absolute;left:-9999px">본문으로 이동</a>
    <nav><a href="/report">신고 안내</a><a href="/accessibility">접근성</a>
    <a href="/glossary">용어 교육</a><a href="/campaign">예방 캠페인</a>
    <a href="/dialog">신고 확인</a><a href="/tabs">교육 탭</a>
    <a href="/carousel">예방 소식</a><a href="/chart">통계</a>
    <a href="/adult-block">유해정보 차단</a></nav>
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
  "/dialog": `
    <h1>신고 절차</h1><button aria-haspopup="dialog">접수 내용 확인</button>
    <dialog open aria-labelledby="dialog-title"><h2 id="dialog-title">피해 신고 확인</h2>
    <p>무직자 대출 사기 피해를 접수할 때 필요한 자료를 확인하세요.</p>
    <button>확인</button></dialog>
    <div inert>카지노 광고 신고 안내의 이전 화면</div>`,
  "/tabs": `
    <h1>다국어 예방 교육</h1>
    <div role="tablist" aria-label="예방 교육 언어"><button role="tab" aria-selected="true">한국어</button>
    <button role="tab" aria-selected="false">English</button></div>
    <section role="tabpanel"><p>ㅋㅏㅈㅣㄴㅗ 표기는 카지노 광고를 피하기 위한 교육 사례입니다.</p></section>
    <section role="tabpanel" hidden><p>Report a casino advertisement. 대출 사기 예방 안내.</p></section>`,
  "/carousel": `
    <h1>피해 예방 소식</h1>
    <section aria-roledescription="carousel" aria-label="예방 카드">
      <article>불법 카지노 광고를 발견하면 신고해 주세요.</article>
      <article aria-hidden="true" style="position:absolute;left:-9999px">대출 사기 피해 신고 방법을 안내합니다.</article>
      <button aria-label="이전 카드">이전</button><button aria-label="다음 카드">다음</button>
    </section>`,
  "/chart": `
    <h1>신고 통계</h1><p>카지노 범죄 및 대출 사기 신고 건수입니다.</p>
    <svg role="img" aria-labelledby="chart-title chart-desc" width="320" height="120">
      <title id="chart-title">불법 광고 신고 통계</title>
      <desc id="chart-desc">카지노 광고 신고와 대출 사기 신고 추이</desc>
      <rect x="4" y="20" width="80" height="80" fill="#234"/>
      <text x="8" y="110">신고 80건</text>
    </svg>`,
  "/adult-block": `
    <h1>유해정보 차단 안내</h1>
    <p>성인물 차단과 불법 도박 사이트 신고 방법을 안내합니다.</p>
    <a href="/report">대출 사기 피해 신고 절차 보기</a>
    <aside hidden>성인 콘텐츠 차단 설정 도움말</aside>`,
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
        limits: { maxPages: 10, maxDepth: 1, timeoutSec: 60 },
      } });
      expect(output.pagesVisited).toBe(10);
      expect(output.failedPages).toBe(0);
      expect(output.timedOut).toBe(false);
      expect(validateOfficialResultText(output.json).ok).toBe(true);
      expect(output.result.findings).toEqual([]);
      expect(output.extraResult.findings).toEqual([]);
    }
  }, 30_000);
});
