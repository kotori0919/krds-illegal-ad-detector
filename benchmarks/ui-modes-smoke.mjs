/** Browser/Tauri-adapter replay: mode, review, report and single-case infrastructure boundaries. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { chromium } from "playwright-core";
import ExcelJS from "exceljs";
import { installResultReplay } from "./ui-evidence-ipc.mjs";

const root = resolve(import.meta.dirname, "..");
const artifacts = resolve(root, process.env.UI_MODES_EVIDENCE_DIR ?? "artifacts/ui-modes-20261020");
const result = JSON.parse(await readFile(resolve(root, "packages/evidence/test/fixtures/sample_result_617_sanitized.json"), "utf8"));
const original = JSON.stringify(result);
const id = "00000000-0000-4000-8000-000000000020";
const first = result.findings[0];
const second = result.findings.find(finding => finding.url !== first.url);
assert(second, "the saved replay must contain more than one observed page");
const secondPage = second.url;
const detail = { version: 2, findings: [], creativeImages: [],
  coverage: { checkedPages: 211, failedPages: [], timedOut: false },
  infrastructure: [{ domain: "ads.example", nodeId: "domain", pageUrls: [first.url, secondPage], evidenceKinds: ["official-finding"] }],
  evidenceGraph: { nodes: [
    { id: "element", kind: "Element", label: first.evidence_text, findingId: first.id, pageUrl: first.url, adRelated: true },
    { id: "element-two", kind: "Element", label: second.evidence_text, findingId: second.id, pageUrl: second.url, adRelated: true },
    { id: "landing", kind: "Landing", label: "https://ads.example/offer", url: "https://ads.example/offer", adRelated: true },
    { id: "domain", kind: "Domain", label: "ads.example", url: "https://ads.example/", adRelated: true },
  ], edges: [
    { from: "element", to: "landing", kind: "LINKS_TO", adRelated: true, evidenceKinds: ["official-finding"] },
    { from: "element-two", to: "landing", kind: "LINKS_TO", adRelated: true, evidenceKinds: ["official-finding"] },
    { from: "landing", to: "domain", kind: "LINKS_TO", adRelated: true, evidenceKinds: ["official-finding"] },
  ] } };
const manifest = { schemaVersion: 1, caseId: id, entryUrl: result.meta.entry_url, startedAt: result.meta.started_at,
  finishedAt: result.meta.finished_at, exportableAt: result.meta.finished_at, status: "succeeded",
  toolVersion: result.meta.tool_version, policyVersion: 2, officialSha256: createHash("sha256").update(original).digest("hex"),
  findings: result.findings.length, issues: [], settings: { connection: "direct", transport: { kind: "direct", reason: "operator" } } };
let review = { schemaVersion: 1, revision: 0, updatedAt: "", records: [] };
let workbook;
let exported;
const server = createServer((request, response) => {
  const pathname = new URL(request.url ?? "/", "http://fixture.local").pathname;
  const name = pathname === "/" ? "index.html" : pathname.slice(1);
  if (!/^[a-zA-Z0-9._/-]+$/.test(name) || name.split("/").includes("..")) { response.writeHead(404); response.end(); return; }
  void readFile(resolve(root, "apps/web/dist", name)).then(bytes => {
    response.writeHead(200, { "content-type": { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2" }[extname(name)] ?? "application/octet-stream" });
    response.end(bytes);
  }).catch(() => { response.writeHead(404); response.end(); });
});
let browser;
try {
  await mkdir(artifacts, { recursive: true });
  await new Promise(done => server.listen(0, "127.0.0.1", done));
  browser = await chromium.launch({ chromiumSandbox: false });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const reads = await installResultReplay(page, { mode: null, result, detail,
    extra: { meta: result.meta, findings: [] },
    session: { id, entryUrl: result.meta.entry_url, status: "succeeded", hasResult: true,
      startedAt: result.meta.started_at, finishedAt: result.meta.finished_at,
      progress: { sequence: 1, visitedPages: 211, failedPages: 0, queuedPages: 0, currentPages: [], recentActivity: [], framesInspected: 0, elementsAnalyzed: 1000, candidates: 617, confirmedFindings: 617, elapsedSec: result.meta.elapsed_sec, stage: "succeeded" } },
    caseReplay: (command, args) => {
      if (command === "case_open") return { manifest, review, directory: "/fixture/case" };
      if (command === "case_list") return { schemaVersion: 1, storageRoot: "/fixture", cases: [{ manifest, directory: "/fixture/case", reviewRevision: review.revision }], issues: [], limit: 20 };
      if (command === "case_save_review") {
        assert.equal(args.expectedRevision, review.revision);
        review = { schemaVersion: 1, revision: review.revision + 1, updatedAt: new Date().toISOString(), records: globalThis.structuredClone(args.records) };
        return review;
      }
      throw new Error(`Unexpected case command ${command}`);
    },
    workbookReplay: async args => { workbook = new Uint8Array(args.data); await writeFile(resolve(artifacts, "report.xlsx"), workbook); return "/fixture/report.xlsx"; },
    exportReplay: async () => { exported = original; await writeFile(resolve(artifacts, "result.json"), original); return { resultJson: "/fixture/result.json" }; },
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: resolve(artifacts, "mode-setup.png"), fullPage: true });
  assert.equal(await page.getByRole("radio", { name: /간단 모드/ }).isChecked(), true);
  await page.getByRole("button", { name: "시작하기" }).click();
  await page.getByLabel("점검할 웹사이트", { exact: false }).fill(result.meta.entry_url);
  assert.equal(await page.getByText("상세 설정", { exact: true }).count(), 0);
  await page.screenshot({ path: resolve(artifacts, "simple-start.png"), fullPage: true });
  await page.getByRole("button", { name: "점검 시작", exact: false }).click();
  await page.getByText("표시 중인 탐지 617건 / 전체 617건", { exact: true }).waitFor();
  await page.getByText("검토 기록 저장됨", { exact: true }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  const rows = page.locator(".review-row");
  const thirdRow = await rows.nth(2).boundingBox();
  await page.screenshot({ path: resolve(artifacts, "simple-results.png") });

  assert(thirdRow && thirdRow.y + thirdRow.height <= 768, `third complete row ends at ${thirdRow && thirdRow.y + thirdRow.height}`);
  assert.equal(await page.getByLabel("기법 필터").count(), 0);
  assert.equal(await page.getByRole("button", { name: "관계 보기", exact: true }).count(), 0);
  assert(!reads.some(read => /warp/i.test(read.command)), "ordinary flow read or registered WARP");
  await page.screenshot({ path: resolve(artifacts, "simple-results.png") });
  await page.getByLabel("검토 상태", { exact: true }).selectOption("needed");
  await rows.first().getByRole("button", { name: "근거 보기", exact: true }).click();
  await page.getByLabel("검토 메모").fill("모드 전환 후에도 보존할 검토 메모");
  await page.getByLabel("담당자의 판단").selectOption("needs-more-evidence");
  await page.getByLabel("화면 모드").selectOption("advanced");
  assert.equal(await page.getByLabel("검토 메모").inputValue(), "모드 전환 후에도 보존할 검토 메모");
  await page.getByLabel("화면 모드").selectOption("simple");
  await page.getByRole("button", { name: "검토 완료·다음", exact: true }).click();
  await page.waitForFunction((text) => { const raw = document.querySelector(".result-inspector .raw"); return !!raw && raw.textContent !== text; }, first.evidence_text);
  assert.equal(review.records.find(record => record.findingId === first.id)?.state, "reviewed");
  await page.getByRole("button", { name: "결과 목록으로", exact: true }).click();
  await page.getByLabel("화면 모드").selectOption("advanced");
  await page.getByRole("navigation", { name: "주요 업무" }).getByRole("button", { name: "인프라 분석", exact: true }).click();
  await page.getByRole("heading", { name: "광고 연관 인프라", exact: true }).waitFor();
  await page.getByLabel("도메인 검색", { exact: true }).fill("ads.example");
  await page.getByLabel("반복 관측만", { exact: true }).check();
  await page.getByRole("button", { name: "ads.example 근거 확인", exact: true }).click();
  await page.getByRole("button", { name: "관계 보기", exact: true }).click();
  await page.getByRole("button", { name: `원본 요소 ${first.id}`, exact: true }).click();
  await page.getByRole("button", { name: `원본 기록 ${first.id} 열기`, exact: true }).click();
  await page.getByRole("complementary", { name: "탐지 상세" }).waitFor();
  await page.getByRole("button", { name: "결과 목록으로", exact: true }).click();
  assert.equal(await page.getByLabel("도메인 검색", { exact: true }).inputValue(), "ads.example");
  await page.screenshot({ path: resolve(artifacts, "advanced-infrastructure.png"), fullPage: true });
  await page.getByLabel("화면 모드").selectOption("simple");
  await page.getByRole("button", { name: "엑셀 보고서 저장", exact: true }).click();
  await page.getByText("엑셀 보고서 저장 완료: /fixture/report.xlsx", { exact: true }).waitFor();
  const book = new ExcelJS.Workbook(); await book.xlsx.load(workbook);
  assert.equal(book.getWorksheet("탐지 상세").rowCount, 618);
  assert(JSON.stringify(book.getWorksheet("검토 기록").getSheetValues()).includes("모드 전환 후에도 보존할 검토 메모"));
  await page.locator(".result-files > summary").click();
  await page.getByRole("button", { name: "공식 JSON 저장", exact: true }).click();
  await page.getByRole("dialog", { name: "결과 저장" }).getByRole("button", { name: "저장", exact: true }).click();
  await page.getByText("저장 완료: /fixture/result.json", { exact: true }).waitFor();
  assert.equal(exported, original);
  await page.getByRole("dialog", { name: "결과 저장" }).getByRole("button", { name: "닫기", exact: true }).click();
  await page.setViewportSize({ width: 360, height: 800 });
  const narrow = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }));
  assert(narrow.document <= narrow.viewport, `narrow layout overflow: ${JSON.stringify(narrow)}`);
  await page.screenshot({ path: resolve(artifacts, "simple-results-360.png"), fullPage: true });
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.getByLabel("화면 모드").inputValue(), "simple");
  assert.equal(await page.getByRole("button", { name: "시작하기", exact: true }).count(), 0);
  assert(!reads.some(read => /warp|scan_start_batch/.test(read.command)));
  assert.equal(reads.filter(read => read.command === "scan_start").length, 1);
  assert.deepEqual(errors, []);
  const receipt = { evidence: "OBSERVED_BROWSER_TAURI_ADAPTER_REPLAY", viewport: { width: 1366, height: 768 },
    thirdRowBottom: thirdRow.y + thirdRow.height, narrowLayout: narrow, modeRememberedAfterReload: true, officialFindings: result.findings.length,
    storedReviewRevision: review.revision, workbookRows: 618, officialBytesUnchanged: exported === original,
    scanStarts: reads.filter(read => read.command === "scan_start").length, warpCalls: 0, pageErrors: errors };
  await writeFile(resolve(artifacts, "observed.json"), JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt, null, 2));
} finally {
  await browser?.close();
  await new Promise(done => server.close(done));
}
