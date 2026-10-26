import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { validateOfficialResultText, validateScanDetailBundle, type ScanProgress } from "@krds-detector/contracts";
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

// Hand-counted text owners, including hidden text and SVG title/desc/text.
// Images are not eligible here: the two SVGs have neither ad markers nor an
// external destination (creative.ts selectVisuals gate). No iframe is authored.
// /report links to /public/casino-report at depth 2, outside the unchanged
// maxDepth:1 crawl. It is not one of the ten authored inspection targets.
const expectedTextOwners: Record<string, number> = {
  "/": 12, "/report": 5, "/accessibility": 4, "/glossary": 4, "/campaign": 3,
  "/dialog": 6, "/tabs": 5, "/carousel": 5, "/chart": 5, "/adult-block": 4,
};
const expectedPaths = Object.keys(expectedTextOwners).sort();
const expectedElements = Object.values(expectedTextOwners).reduce((sum, count) => sum + count, 0);
function fixturePath(url?: string): string {
  if (!url) return "<none>";
  const path = new URL(url).pathname;
  return Object.hasOwn(pages, path) ? path : "<unlisted>";
}
function observe(concurrency: number, phase: string, detail: object = {}): void {
  // Existing guard captures stdout. Fixed labels/counters only, no browser
  // argv, image bytes, arbitrary error text or external URLs are logged.
  console.info(`FALSE_POSITIVE_SITE ${JSON.stringify({ concurrency, phase,
    wallTimeMs: Date.now(), monotonicNs: process.hrtime.bigint().toString(), ...detail })}`);
}

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
      let output: Awaited<ReturnType<typeof scanSite>> | undefined;
      let finalProgress: ScanProgress | undefined;
      let pageEvents = 0;
      let passed = false;
      observe(concurrency, "scan-start", { expectedPages: 10, expectedElements, expectedTextOwners });
      try {
        output = await scanSite({ entryUrl: `${origin}/`, crawl: {
          concurrency, settleMs: 300, perPageMs: 7000,
          limits: { maxPages: 10, maxDepth: 1, timeoutSec: 60 },
        }, onEvent: event => {
          if (event.kind === "session-finished") finalProgress = event.progress;
          if (["page-started", "page-visited", "page-failed"].includes(event.kind)) {
            pageEvents++;
            if (pageEvents <= 20) observe(concurrency, event.kind, { path: fixturePath(event.pageUrl),
              visitedPages: event.progress.visitedPages, elementsAnalyzed: event.progress.elementsAnalyzed });
          }
        } });
        expect(output.pagesVisited).toBe(10);
        expect(output.failedPages).toBe(0);
        expect(output.timedOut).toBe(false);
        expect(validateOfficialResultText(output.json).ok).toBe(true);
        expect(output.result.findings).toEqual([]);
        expect(output.extraResult.findings).toEqual([]);
        const detail = output.detailBundle;
        expect(detail.analysisIssues).toEqual([]);
        expect(detail.coverage).toEqual({ checkedPages: 10, failedPages: [], timedOut: false, cancelled: false });
        expect(detail.pageOutcomes).toHaveLength(10);
        expect(detail.pageOutcomes!.map(page => fixturePath(page.url)).sort()).toEqual(expectedPaths);
        for (const page of detail.pageOutcomes!) {
          expect(page).toMatchObject({ outcome: "checked", status: 200, depth: fixturePath(page.url) === "/" ? 0 : 1 });
          expect(page.issue).toBeUndefined();
          expect(page.collectionIssues ?? []).toEqual([]); // Optional means no reported collection issue.
          expect(fixturePath(page.finalUrl)).toBe(fixturePath(page.url));
        }
        expect(pageEvents).toBe(20); // Exactly one start and one successful visit per authored page.
        expect(finalProgress).toMatchObject({ stage: "succeeded", visitedPages: 10, failedPages: 0,
          queuedPages: 0, currentPages: [], framesInspected: 0, elementsAnalyzed: expectedElements,
          candidates: 0, confirmedFindings: 0 });
        expect(detail.visualAnalysisCoverage).toMatchObject({ pagesConsidered: 10, pagesNotConsidered: 0,
          candidatesObserved: 0, candidateTotal: null, imagesAcquired: 0, imageAnalysisRecords: 0,
          ocrImagesAttempted: 0, ocrImagesCompleted: 0, ocrImagesUnavailable: 0, limitsReached: [], skips: [],
          selection: { retainedRecords: 0, retainedAssets: 0, retainedBytes: 0, excludedRecords: 0, ocrSha256: [] } });
        expect(detail.imageAnalysis).toEqual([]);
        expect(validateScanDetailBundle(detail, output.result, output.extraResult).ok).toBe(true);
        passed = true;
      } finally {
        const detail = output?.detailBundle;
        observe(concurrency, output ? passed ? "scan-pass" : "assertion-failed" : "scan-rejected", {
          pageEvents, pageEventLogTruncated: pageEvents > 20,
          progress: finalProgress && { stage: finalProgress.stage, visitedPages: finalProgress.visitedPages,
            elementsAnalyzed: finalProgress.elementsAnalyzed, framesInspected: finalProgress.framesInspected,
            failedPages: finalProgress.failedPages, candidates: finalProgress.candidates, confirmedFindings: finalProgress.confirmedFindings,
            queuedPages: finalProgress.queuedPages, currentPageCount: finalProgress.currentPages.length },
          analysisIssueCount: detail?.analysisIssues?.length,
          analysisIssues: detail?.analysisIssues?.slice(0, 32).map(issue => issue.slice(0, 160)),
          coverage: detail && { checkedPages: detail.coverage.checkedPages, failedPages: detail.coverage.failedPages.length,
            timedOut: detail.coverage.timedOut, cancelled: detail.coverage.cancelled },
          pageOutcomes: detail?.pageOutcomes?.slice(0, 10).map(page => ({ path: fixturePath(page.url),
            status: page.status, outcome: page.outcome, depth: page.depth,
            collectionIssues: page.collectionIssues?.slice(0, 8).map(issue => issue.slice(0, 160)) ?? [] })),
          visualAnalysisCoverage: detail?.visualAnalysisCoverage,
          expectedNotApplicable: ["no-authored-iframes", "unmarked-local-SVGs:no-gated-visual-candidates", "depth-2-guide-outside-maxDepth-1"],
        });
      }
    }
  }, 30_000);
});
