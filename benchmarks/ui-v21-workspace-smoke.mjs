/** Built React/Tauri adapter with explicit, network-free offline result replay. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { chromium } from "playwright-core";
import ExcelJS from "exceljs";
import { initialProgress } from "../packages/contracts/dist/scan.js";
import { serializeOfficialResult } from "../packages/contracts/dist/result.js";
import { installResultReplay } from "./ui-evidence-ipc.mjs";

const outputDir = process.env.V21_EVIDENCE_DIR ?? "/tmp/illegal-ad-v21-m1";
await mkdir(outputDir, { recursive: true });
const result = JSON.parse(await readFile("packages/evidence/test/fixtures/sample_result_617_sanitized.json", "utf8"));
const officialBefore = serializeOfficialResult(result);
const app = createServer((request, response) => {
  const name = new URL(request.url, "http://app.invalid").pathname.slice(1) || "index.html";
  if (!/^[a-zA-Z0-9._/-]+$/.test(name) || name.split("/").includes("..")) { response.writeHead(404); response.end(); return; }
  void readFile(resolve("apps/web/dist", name)).then((bytes) => {
    response.writeHead(200, { "content-type": { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" }[extname(name)] ?? "application/octet-stream" }); response.end(bytes);
  }).catch(() => { response.writeHead(404); response.end(); });
});
let browser;
try {
  await new Promise((done) => app.listen(0, "127.0.0.1", done));
  browser = await chromium.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = [], remoteRequests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (route) => {
    if (new URL(route.request().url()).hostname !== "127.0.0.1") { remoteRequests.push(route.request().url()); return route.abort(); }
    return route.continue();
  });
  const reads = await installResultReplay(page, { result,
    session: { id: "offline-617", entryUrl: result.meta.entry_url, status: "succeeded", hasResult: true,
      startedAt: result.meta.started_at, finishedAt: result.meta.finished_at, progress: initialProgress("succeeded") },
    exportReplay: async () => { await writeFile(`${outputDir}/result.json`, serializeOfficialResult(result)); return { resultJson: `${outputDir}/result.json` }; },
    workbookReplay: async (args) => { assert.deepEqual(args.sessionIds, ["offline-617"]); await writeFile(`${outputDir}/report.xlsx`, new Uint8Array(args.data)); return `${outputDir}/report.xlsx`; } });
  await page.goto(`http://127.0.0.1:${app.address().port}`);
  await page.getByLabel("점검할 웹사이트").fill(result.meta.entry_url);
  await page.getByRole("button", { name: "점검 시작", exact: true }).click();
  await page.getByRole("heading", { name: "반복 항목 검토" }).waitFor();
  await page.evaluate(async () => { await document.fonts.ready; window.scrollTo(0, 0); });
  const initialGeometry = await page.evaluate(() => ({
    bodyFontSize: getComputedStyle(document.body).fontSize,
    search: document.getElementById("result-search").getBoundingClientRect().toJSON(),
    rows: [...document.querySelectorAll(".review-row")].slice(0, 3).map((row) => row.getBoundingClientRect().toJSON()),
    height: window.innerHeight,
  }));
  await page.screenshot({ path: `${outputDir}/workspace-1366x768.png` });
  assert(initialGeometry.search.bottom <= initialGeometry.height, JSON.stringify(initialGeometry));
  assert(initialGeometry.rows.every((row) => row.bottom <= initialGeometry.height), JSON.stringify(initialGeometry));
  assert.equal(await page.getByRole("navigation", { name: "목록 페이지" }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "근거 보기", exact: true }).count(), 19);
  assert.equal(reads.filter((r) => r.command === "scan_get_evidence_asset").length, 0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: `${outputDir}/grouped-desktop.png` });
  await page.getByLabel("결과 검색").fill("/game/baccarat");
  await page.screenshot({ path: `${outputDir}/followup-aggregate-and-ids.png` });
  await page.getByRole("button", { name: "검색·필터 초기화" }).click();
  const first = page.locator(".review-row").first();
  await first.getByText("기록 197건 · 영향 페이지 197개", { exact: false }).waitFor();
  await first.getByRole("button", { name: "근거 보기", exact: true }).focus();
  await page.keyboard.press("Enter");
  const inspector = page.getByRole("complementary", { name: "탐지 상세" });
  await inspector.getByText(/현재 검토 범위 1 \/ 197건/).waitFor();
  await inspector.getByText(/이 결과에 저장된 상세 판단 기록이 없습니다/).waitFor();
  assert.equal(await inspector.getByRole("button", { name: /다시 불러오기/ }).count(), 0);
  await inspector.getByRole("button", { name: "다음 기록" }).click();
  await inspector.getByText(/현재 검토 범위 2 \/ 197건/).waitFor();
  await inspector.getByRole("button", { name: "결과 목록으로" }).click();
  await page.waitForFunction(() => document.activeElement?.dataset.findingId !== undefined);
  await page.getByLabel("결과 검색").fill("f372");
  await page.getByRole("button", { name: "근거 보기", exact: true }).click();
  await inspector.getByText("원피스는 ㄹㅇ 재미가보장되있네 ㅋㅋㅋ", { exact: true }).waitFor();
  await inspector.getByRole("button", { name: "검토 완료로 표시" }).click();
  await inspector.getByLabel("검토 메모").fill("자연스러운 댓글인지 추가 확인 필요");
  await page.screenshot({ path: `${outputDir}/f372-inspector.png` });
  await inspector.getByRole("button", { name: "결과 목록으로" }).click();
  await page.getByRole("button", { name: "검색·필터 초기화" }).click();
  await page.getByRole("button", { name: "전체 기록", exact: true }).click();
  assert.equal(await page.getByRole("navigation", { name: "목록 페이지" }).count(), 1);
  assert.equal(await page.getByRole("button", { name: "근거 보기", exact: true }).count(), 20);
  await page.getByRole("button", { name: "다음 목록" }).click();
  await page.getByText("2 / 31 페이지", { exact: true }).waitFor();
  await page.getByLabel("목록 표시 개수").selectOption("50");
  assert.equal(await page.getByRole("button", { name: "근거 보기", exact: true }).count(), 50);
  await page.getByRole("button", { name: "현재 목록 50건 검토 완료", exact: true }).click();
  const confirm = page.getByRole("dialog", { name: "검토 범위 확인" });
  await confirm.getByRole("button", { name: "검토 완료로 표시", exact: true }).click();
  await page.getByLabel("검토 상태").selectOption("needed");
  assert.equal(await page.locator('.review-list button[data-finding-id="f372"]').count(), 0);
  await page.getByRole("button", { name: "검색·필터 초기화" }).click();
  await page.getByRole("button", { name: "반복 항목별", exact: true }).click();
  await page.setViewportSize({ width: 360, height: 800 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.locator(".review-row-details").first().getByText("묶음의 관측 위치와 구분 기준", { exact: true }).click();
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${outputDir}/workspace-360px.png`, fullPage: true });
  await page.getByLabel("결과 검색").fill("f372");
  await page.getByRole("button", { name: "근거 보기", exact: true }).click();
  await inspector.getByText(/현재 검토 범위/).waitFor();
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.screenshot({ path: `${outputDir}/f372-360px.png` });
  await inspector.getByRole("button", { name: "결과 목록으로" }).click();
  assert.equal(await page.getByLabel("결과 검색").inputValue(), "f372");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => { document.documentElement.style.zoom = "2"; window.scrollTo(0, 0); });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.screenshot({ path: `${outputDir}/workspace-200-percent.png` });
  await page.evaluate(() => { document.documentElement.style.zoom = "1"; });
  await page.getByRole("button", { name: "엑셀 보고서 저장", exact: true }).click();
  await page.getByText(/엑셀 보고서 저장 완료:/).waitFor();
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile(`${outputDir}/report.xlsx`);
  assert.equal(workbook.getWorksheet("탐지 상세").rowCount, 618);
  assert.equal(workbook.getWorksheet("탐지 상세").getRow(373).getCell(9).value, "자연스러운 댓글인지 추가 확인 필요");
  for (const sheet of workbook.worksheets) sheet.eachRow((row) => row.eachCell((cell) => assert.notEqual(cell.type, ExcelJS.ValueType.Formula)));
  await page.getByRole("button", { name: "공식 JSON 저장", exact: true }).click();
  const exportDialog = page.getByRole("dialog");
  await exportDialog.getByRole("button", { name: "저장", exact: true }).click();
  await exportDialog.getByText(/저장 완료:/).waitFor();
  assert.equal(await readFile(`${outputDir}/result.json`, "utf8"), officialBefore);
  assert.equal(serializeOfficialResult(result), officialBefore);
  assert.deepEqual(errors, []); assert.deepEqual(remoteRequests, []);
  const report = { mode: "offline fixture through production React and Tauri adapter; explicit IPC replay, not native scanner/export",
    officialRecords: 617, affectedPages: 211, reviewPatterns: 19, repeatedRecords: 197, repeatedPages: 197, initialGeometry,
    f372: "found and reviewed; original retained", recordPagination: "20/50", bulkConfirmation: true,
    narrowReflow: true, zoom200: true, keyboardEntryAndFocusReturn: true, officialCanonicalBytesUnchanged: true,
    xlsx: { sheets: workbook.worksheets.map((sheet) => sheet.name), officialRows: 617, filteredExportStillFull: true, note: true, formulas: false, mode: "real workbook; native Save As replay only" },
    remoteRequests, errors, nativeWindows: "NOT_RUN in this M1 smoke", uninstructedTester: "NOT_RUN" };
  await writeFile(`${outputDir}/observed.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} finally { await browser?.close(); if (app.listening) await new Promise((done) => app.close(done)); }
