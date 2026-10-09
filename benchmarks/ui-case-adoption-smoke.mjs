/** Built UI smoke with a file-backed, test-only IPC replay. This does not certify native/Windows storage. */
import { createServer } from "node:http";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";
import { chromium } from "playwright-core";
import { evidenceRead } from "./ui-evidence-ipc.mjs";
import { createHash } from "node:crypto";

const directory = await mkdtemp(join(tmpdir(), "krds-case-ui-replay-"));
const caseId = "b350d0d4-cbac-4561-a43c-02f519e68664";
const now = "2026-10-09T00:00:00Z";
const result = { meta: { topic: "TOPIC", entry_url: "https://fixture.invalid/", started_at: now, finished_at: now, elapsed_sec: 0, tool_version: "test-replay" },
  findings: [{ id: "f1", url: "https://fixture.invalid/", is_violation: true, location: "#ad", technique: "HOMOGLYPH", evidence_text: "ＣＡＳＩＮＯ 가입" }] };
const manifest = { schemaVersion: 1, caseId, entryUrl: result.meta.entry_url, startedAt: now, finishedAt: now, exportableAt: now, status: "succeeded", toolVersion: "test-replay", policyVersion: 2, officialSha256: createHash("sha256").update(JSON.stringify(result)).digest("hex"), findings: 1, issues: [], settings: {} };
const detail = { version: 2, findings: [{ findingId: "f1", url: result.findings[0].url, location: "#ad", technique: "HOMOGLYPH", rawText: result.findings[0].evidence_text, normalizedText: "casino가입", matchedTerms: ["casino"], techniqueReason: "test-only replay", observed: { box: { x: 0, y: 0, width: 100, height: 20 }, css: { color: "black", backgroundColor: "white", opacity: "1", display: "block", fontSize: "17px", position: "static" } }, visual: { state: "unavailable", reason: "budget" } }], creativeImages: [], coverage: { checkedPages: 1, failedPages: [], timedOut: false }, pageOutcomes: [] };
detail.evidenceGraph = { nodes: [
  { id: "page", kind: "Page", label: result.meta.entry_url, url: result.meta.entry_url },
  { id: "ad", kind: "Element", label: "#ad", findingId: "f1", adRelated: true },
  { id: "domain", kind: "Domain", label: "ads.fixture.invalid", adRelated: true }], edges: [
  { from: "page", to: "ad", kind: "CONTAINS", adRelated: true, evidenceKinds: ["official-finding"] },
  { from: "ad", to: "domain", kind: "LINKS_TO", adRelated: true, evidenceKinds: ["ad-destination"] }] };
detail.infrastructure = [{ domain: "ads.fixture.invalid", nodeId: "domain", pageUrls: [result.meta.entry_url], evidenceKinds: ["ad-destination"] }];
const officialText = JSON.stringify(result);
await writeFile(join(directory, "result.json"), officialText);
await writeFile(join(directory, "review.json"), JSON.stringify({ schemaVersion: 1, revision: 0, updatedAt: now, records: [] }));
const readReview = async () => JSON.parse(await readFile(join(directory, "review.json"), "utf8"));
const commands = []; let bytes;
const dist = resolve("apps/web/dist");
const server = createServer((request, response) => {
  const relative = new URL(request.url, "http://app.invalid").pathname.slice(1) || "index.html";
  if (!/^[A-Za-z0-9._/-]+$/.test(relative) || relative.split("/").includes("..")) { response.writeHead(404); response.end(); return; }
  void readFile(join(dist, relative)).then((body) => {
    response.writeHead(200, { "Content-Type": ({ ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2" })[extname(relative)] ?? "application/octet-stream" }); response.end(body);
  }).catch(() => { response.writeHead(404); response.end(); });
});
let browser;
try {
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  // Controlled local replay only; production browser sandbox is tested separately.
  browser = await chromium.launch({ chromiumSandbox: false });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = []; page.on("pageerror", (error) => errors.push(error.message));
  await page.exposeFunction("caseReplayInvoke", async (command, args = {}) => {
    commands.push(command);
    switch (command) {
      case "case_list": return { schemaVersion: 1, storageRoot: directory, limit: 2000, issues: [], cases: [{ manifest, directory, reviewRevision: (await readReview()).revision }] };
      case "case_open": return { manifest, directory, review: await readReview() };
      case "case_save_review": {
        const previous = await readReview();
        if (args.expectedRevision !== previous.revision) throw new Error("REVIEW_CONFLICT");
        const next = { schemaVersion: 1, revision: previous.revision + 1, updatedAt: new Date().toISOString(), records: args.records };
        await writeFile(join(directory, "review.json"), JSON.stringify(next)); return next;
      }
      case "scan_get_session": return { id: caseId, entryUrl: manifest.entryUrl, status: "succeeded", startedAt: now, finishedAt: now, hasResult: true };
      case "scan_get_result": return JSON.parse(await readFile(join(directory, "result.json"), "utf8"));
      case "scan_get_extra_result": return { meta: result.meta, findings: [] };
      case "scan_export_workbook": bytes = args.data; return join(directory, "review.xlsx");
      case "scan_start": throw new Error("Reopening must never start a crawl");
      default: return evidenceRead(detail, command, args);
    }
  });
  await page.addInitScript(() => { window.__TAURI_INTERNALS__ = { transformCallback: () => 1, unregisterCallback: () => {}, invoke: (command, args) => window.caseReplayInvoke(command, args) }; });
  await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /^케이스 다시 열기/ }).click();
  await page.getByRole("button", { name: "근거 보기" }).click();
  await page.getByLabel("검토 메모", { exact: true }).fill("전달받은 담당자의 메모 =1+1");
  await page.getByLabel("담당자의 판단", { exact: true }).selectOption("needs-more-evidence");
  await page.getByRole("button", { name: "검토 완료로 표시" }).click();
  await page.getByText(/검토 기록 저장됨/).waitFor();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: /^케이스 다시 열기/ }).click();
  await page.getByRole("button", { name: "근거 보기" }).click();
  if (await page.getByLabel("검토 메모", { exact: true }).inputValue() !== "전달받은 담당자의 메모 =1+1") throw new Error("memo not restored");
  if (await page.getByLabel("담당자의 판단", { exact: true }).inputValue() !== "needs-more-evidence") throw new Error("judgment not restored");
  await page.getByRole("button", { name: "검토 완료 취소" }).waitFor();
  await page.getByRole("button", { name: "엑셀 보고서 저장" }).click();
  await page.getByText(/엑셀 보고서 저장 완료:/).waitFor();
  if (!bytes?.length) throw new Error("workbook missing");
  await writeFile(join(directory, "review.xlsx"), new Uint8Array(bytes));
  await page.getByRole("button", { name: "결과 목록으로", exact: true }).click();
  await page.getByLabel("결과 검색", { exact: true }).fill("retained hidden query");
  await page.getByLabel("기법 필터", { exact: true }).selectOption("JAMO");
  await page.getByRole("button", { name: "추가 분석", exact: true }).click();
  const infrastructure = page.getByRole("region", { name: "관련 광고 인프라", exact: true });
  await infrastructure.getByRole("button", { name: "관계 보기", exact: true }).click();
  await infrastructure.getByRole("button", { name: "원본 요소 f1", exact: true }).press("Enter");
  const graphInvoker = infrastructure.getByRole("button", { name: "원본 기록 f1 열기", exact: true });
  await graphInvoker.focus(); await graphInvoker.press("Enter");
  await page.getByRole("heading", { name: "탐지 상세", exact: true }).waitFor();
  await page.getByRole("button", { name: "결과 목록으로", exact: true }).click();
  await page.evaluate(() => new Promise((done) => window.requestAnimationFrame(() => window.requestAnimationFrame(done))));
  if (!await graphInvoker.evaluate((element) => document.activeElement === element)) throw new Error("graph inspector back did not restore invoker focus");
  if (await page.getByLabel("결과 검색", { exact: true }).inputValue() !== "retained hidden query"
    || await page.getByLabel("기법 필터", { exact: true }).inputValue() !== "JAMO"
    || await page.getByRole("button", { name: "추가 분석", exact: true }).getAttribute("aria-pressed") !== "true") throw new Error("graph inspection changed the operator's filters or tab");
  await graphInvoker.press("Enter");
  await page.getByRole("heading", { name: "탐지 상세", exact: true }).waitFor();
  await infrastructure.getByRole("button", { name: "관계 닫기", exact: true }).click();
  await page.getByRole("button", { name: "결과 목록으로", exact: true }).click();
  await page.evaluate(() => new Promise((done) => window.requestAnimationFrame(() => window.requestAnimationFrame(done))));
  if (!await page.getByRole("button", { name: "추가 분석", exact: true }).evaluate((element) => document.activeElement === element)) throw new Error("removed graph invoker did not restore selected tab focus");
  if (await readFile(join(directory, "result.json"), "utf8") !== officialText) throw new Error("official source changed");
  if (commands.includes("scan_start") || errors.length) throw new Error(`unexpected crawl or UI error: ${errors.join(", ")}`);
  await page.screenshot({ path: join(directory, "workspace-1366.png"), fullPage: true });
  console.log(JSON.stringify({ evidence: "OBSERVED", scope: "built React UI + file-backed test-only IPC replay; not native or Windows acceptance", caseDirectory: directory, officialUnchanged: true, reopenedAfterReload: true, memoRestored: true, judgmentRestored: true, readingStateRestored: true, graphOriginalOpened: true, graphBackFocusRestored: true, graphRemovedInvokerFallback: true, graphFiltersPreserved: true, workbookBytes: bytes.length, scanStartCalls: 0, consoleErrors: errors, reviewRevision: (await readReview()).revision }));
} finally {
  await browser?.close(); await new Promise((done) => server.close(done));
}
