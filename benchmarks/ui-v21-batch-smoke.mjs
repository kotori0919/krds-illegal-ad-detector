/** Real scanSite + built UI; IPC transport and Save As are explicitly harnessed. */
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { setTimeout, clearTimeout } from "node:timers";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { chromium } from "playwright-core";
import ExcelJS from "exceljs";
import { scanSite } from "../packages/detection/dist/scan.js";
import { PublicNetworkPolicy } from "../packages/scanner/dist/index.js";
import { initialProgress, validateOfficialResultText } from "../packages/contracts/dist/index.js";
import { evidenceRead } from "./ui-evidence-ipc.mjs";

const { AbortController, structuredClone } = globalThis;

const output = process.env.V21_BATCH_EVIDENCE_DIR ?? "/tmp/illegal-ad-v21-batch";
await mkdir(output, { recursive: true });
const fixtures = [], sockets = new Set(), targetRequests = [];
const listen = (server) => new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const sessions = new Map();
let serial = 0, active = 0, maxActive = 0, browser;
const file = (name, buffer) => ({ name, buffer: Buffer.from(buffer), mimeType: "application/octet-stream" });
for (const name of ["first", "second"]) {
  let origin;
  const server = createServer((request, response) => {
    const path = new URL(request.url, "http://fixture.invalid").pathname;
    targetRequests.push({ site: name, path });
    let body;
    if (path === "/robots.txt") body = `User-agent: *\nDisallow: /excluded\nSitemap: ${origin}/index.xml\n`;
    else if (path === "/index.xml") body = `<sitemapindex><sitemap><loc>${origin}/pages.xml</loc></sitemap></sitemapindex>`;
    else if (path === "/pages.xml") body = `<urlset><url><loc>${origin}/detail</loc></url><url><loc>${origin}/excluded</loc></url></urlset>`;
    else if (path === "/sitemap.xml") { response.writeHead(404); response.end(); return; }
    else if (path === "/slow") {
      const timer = setTimeout(() => { if (!response.destroyed) response.end("<!doctype html><p>late</p>"); }, 15_000);
      request.once("close", () => clearTimeout(timer)); return;
    } else body = `<!doctype html><html lang="ko"><meta charset="utf-8"><title>Owned ${name}</title><body><a id="ad" href="/game/baccarat" style="opacity:0">카지노 첫충 보너스 지급</a><p>${name} service</p></body></html>`;
    response.writeHead(200, { "Content-Type": path.endsWith(".xml") ? "application/xml" : "text/html; charset=utf-8" }); response.end(body);
  });
  server.on("connection", (socket) => { sockets.add(socket); socket.once("close", () => sockets.delete(socket)); });
  await listen(server);
  origin = `http://${name}.fixture.invalid:${server.address().port}`;
  fixtures.push({ server, origin });
}
const policy = PublicNetworkPolicy.forFixtureTargets(fixtures.map(({ origin }) => ({ origin, address: "127.0.0.1" })));
const app = createServer((request, response) => {
  const name = new URL(request.url, "http://app.invalid").pathname.slice(1) || "index.html";
  if (!/^[a-zA-Z0-9._/-]+$/.test(name) || name.split("/").includes("..")) { response.writeHead(404); response.end(); return; }
  void readFile(resolve("apps/web/dist", name)).then((bytes) => {
    response.writeHead(200, { "Content-Type": { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" }[extname(name)] ?? "application/octet-stream" }); response.end(bytes);
  }).catch(() => { response.writeHead(404); response.end(); });
});
const start = (request) => {
  const id = `batch-real-${++serial}`;
  const controller = new AbortController();
  const session = { id, entryUrl: request.entryUrl, startedAt: new Date().toISOString(), status: "running", progress: initialProgress("running") };
  const record = { session, controller }; sessions.set(id, record);
  active++; maxActive = Math.max(maxActive, active);
  record.done = scanSite({ entryUrl: request.entryUrl, signal: controller.signal,
    crawl: { publicNetworkOnly: true, entryKind: request.kind, networkPolicy: policy,
      limits: request.limits, settleMs: 0, concurrency: 2 },
    onEvent: (event) => { session.progress = event.progress; },
  }).then(async (result) => {
    const dir = `${output}/${id}`; await mkdir(dir, { recursive: true });
    await writeFile(`${dir}/result.json`, result.json);
    await writeFile(`${dir}/result_extra.json`, result.extraJson);
    await writeFile(`${dir}/detail.json`, JSON.stringify(result.detailBundle));
    record.result = JSON.parse(await readFile(`${dir}/result.json`, "utf8"));
    record.detail = JSON.parse(await readFile(`${dir}/detail.json`, "utf8"));
    record.extra = JSON.parse(await readFile(`${dir}/result_extra.json`, "utf8"));
    session.status = controller.signal.aborted ? "cancelled" : "succeeded";
    session.hasResult = true; session.finishedAt = result.result.meta.finished_at;
  }).catch((error) => { session.status = "failed"; session.error = error.message; }).finally(() => { active--; });
  return structuredClone(session);
};
try {
  await listen(app);
  browser = await chromium.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [], remoteUiRequests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (route) => {
    if (new URL(route.request().url()).hostname !== "127.0.0.1") { remoteUiRequests.push(route.request().url()); return route.abort(); }
    return route.continue();
  });
  await page.exposeFunction("v21BatchInvoke", async (command, args = {}) => {
    if (command === "plugin:event|listen") return 1;
    if (command === "plugin:event|unlisten") return;
    if (command === "scan_start_batch") return start(args.request);
    if (command === "scan_export_workbook") {
      const path = `${output}/aggregate.xlsx`; await writeFile(path, new Uint8Array(args.data)); return path;
    }
    if (command === "scan_save_template") {
      const path = `${output}/template.csv`; await writeFile(path, "사이트명,시작 주소\n예시,https://example.kr/\n"); return path;
    }
    if (command === "scan_export_batch") {
      const root = `${output}/exported`; await mkdir(root, { recursive: true });
      for (const id of args.sessionIds) {
        const dir = `${root}/${id}`; await mkdir(dir, { recursive: true });
        await writeFile(`${dir}/result.json`, await readFile(`${output}/${id}/result.json`));
      }
      return root;
    }
    const record = sessions.get(args.sessionId);
    if (!record) throw new Error(`unknown session for ${command}`);
    if (command === "scan_cancel") { record.controller.abort(); return; }
    if (command === "scan_get_session") return structuredClone(record.session);
    if (command === "scan_get_result") return record.result;
    if (command === "scan_get_extra_result") return record.extra;
    return evidenceRead(record.detail, command, args);
  });
  await page.addInitScript(() => {
    window.__TAURI_INTERNALS__ = { transformCallback: () => 1, unregisterCallback: () => {},
      invoke: (command, args) => window.v21BatchInvoke(command, args) };
  });
  await page.addInitScript(() => window.localStorage.setItem("inspection.uiMode", "advanced"));
  await page.goto(`http://127.0.0.1:${app.address().port}`);
  await page.getByRole("button", { name: "여러 사이트 일괄 점검", exact: true }).click();
  const input = page.getByLabel("대상 파일 선택 또는 여기로 끌어 놓기");
  const [first, second] = fixtures.map((fixture) => `${fixture.origin}/`);
  const csv = `사이트명,시작 주소\n첫 사이트,${first}\n둘째 사이트,${second}\n중복,${first}#fragment\n내부,http://127.0.0.1/\n`;
  const workbook = new ExcelJS.Workbook(); workbook.addWorksheet("대상").addRows([["사이트명", "시작 주소"], ["첫 사이트", first], ["둘째 사이트", second]]);
  const previews = [file("targets.xlsx", await workbook.xlsx.writeBuffer()),
    file("targets.jsonl", `${JSON.stringify({ label: "첫 사이트", entryUrl: first })}\n${JSON.stringify({ label: "둘째 사이트", entryUrl: second })}`),
    file("targets.xml", `<urlset><url><loc>${first}</loc></url><url><loc>${second}</loc></url></urlset>`), file("targets.csv", csv)];
  for (const targetFile of previews) {
    const before = targetRequests.length;
    await input.setInputFiles(targetFile);
    await page.getByText(`${targetFile.name} · 점검 가능 2 · 오류 ${targetFile.name.endsWith("csv") ? 1 : 0} · 중복 ${targetFile.name.endsWith("csv") ? 1 : 0}`, { exact: true }).waitFor();
    assert.equal(targetRequests.length, before, "preview must not contact a target");
  }
  await page.screenshot({ path: `${output}/preview.png` });
  await page.setViewportSize({ width: 360, height: 800 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.screenshot({ path: `${output}/preview-360px.png` });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "점검 가능 2개 사이트 점검 시작" }).focus(); await page.keyboard.press("Enter");
  await page.getByText(/일괄 점검 종료 · 저장 가능한 결과 2\/2/).waitFor({ timeout: 45_000 });
  assert.equal(maxActive, 1);
  const original = await readFile(`${output}/batch-real-1/result.json`, "utf8");
  for (const id of ["batch-real-1", "batch-real-2"]) {
    const record = sessions.get(id); assert(record.result.findings.length > 0);
    assert.equal(record.detail.coverage.checkedPages, 3);
    assert(record.detail.pageOutcomes.some((page) => page.discoverySource === "sitemap"));
    assert.equal(validateOfficialResultText(await readFile(`${output}/${id}/result.json`, "utf8")).ok, true);
  }
  assert(!targetRequests.some((request) => request.path === "/excluded"));
  await page.getByRole("button", { name: "첫 사이트 결과 검토", exact: true }).click();
  await page.getByRole("heading", { name: "반복 항목 검토" }).waitFor();
  await page.getByRole("button", { name: "근거 보기", exact: true }).first().click();
  await page.getByLabel("검토 메모").fill("첫 사이트 검토 메모");
  await page.getByRole("button", { name: "일괄 점검 현황으로 돌아가기", exact: true }).click();
  await page.getByRole("button", { name: "둘째 사이트 결과 검토", exact: true }).click();
  await page.getByRole("button", { name: "근거 보기", exact: true }).first().click();
  assert.equal(await page.getByLabel("검토 메모").inputValue(), "");
  await page.getByRole("button", { name: "일괄 점검 현황으로 돌아가기", exact: true }).click();
  await page.getByRole("button", { name: "완료된 대상 통합 엑셀 저장" }).click();
  await page.getByText(`저장 완료: ${output}/aggregate.xlsx`, { exact: true }).waitFor();
  const aggregate = new ExcelJS.Workbook(); await aggregate.xlsx.readFile(`${output}/aggregate.xlsx`);
  assert.equal(aggregate.getWorksheet("대상 요약").rowCount, 3);
  assert.equal(aggregate.getWorksheet("탐지 상세").rowCount, 1 + [...sessions.values()].reduce((sum, record) => sum + record.result.findings.length, 0));
  assert.equal(aggregate.getWorksheet("검토 기록").getRow(2).getCell(4).value, "첫 사이트 검토 메모");
  await page.getByRole("button", { name: "사이트별 공식 JSON 저장" }).click();
  await page.getByText(`저장 완료: ${output}/exported`, { exact: true }).waitFor();
  assert.equal(await readFile(`${output}/exported/batch-real-1/result.json`, "utf8"), original);
  await page.screenshot({ path: `${output}/completed.png` });
  await page.getByRole("button", { name: "다른 대상 파일 가져오기" }).click();
  await input.setInputFiles(file("cancel.csv", `사이트명,시작 주소\n첫 사이트,${first}\n느린 사이트,${second}slow\n`));
  await page.getByRole("button", { name: "점검 가능 2개 사이트 점검 시작" }).click();
  await page.getByText("느린 사이트 · 점검 중", { exact: true }).waitFor({ timeout: 20_000 });
  const retained = await readFile(`${output}/batch-real-3/result.json`, "utf8");
  await page.getByRole("button", { name: "일괄 점검 중지", exact: true }).click();
  await page.getByText(/중지됨 · 완료된 결과 유지/).waitFor({ timeout: 15_000 });
  assert.equal(await readFile(`${output}/batch-real-3/result.json`, "utf8"), retained);
  assert.equal(sessions.get("batch-real-4").session.status, "cancelled");
  await page.getByRole("button", { name: "첫 사이트 결과 검토", exact: true }).waitFor();
  await page.screenshot({ path: `${output}/cancel-retained.png` });
  assert.deepEqual(errors, []); assert.deepEqual(remoteUiRequests, []);
  await writeFile(`${output}/observed.json`, JSON.stringify({ mode: "built product React/Tauri adapter; harness IPC transport/export; real canonical scanSite with exact owned origins pinned by programmatic test-only policy; not native Windows Save As",
    formats: ["xlsx", "csv", "jsonl", "xml"], previewTargetRequests: 0, maxActiveSites: maxActive,
    sites: [...sessions.values()].map(({ session, result, detail }) => ({ id: session.id, entry: session.entryUrl,
      status: session.status, findings: result?.findings.length, checked: detail?.coverage.checkedPages })),
    aggregateSheets: aggregate.worksheets.map((sheet) => sheet.name), cancelledSecondSiteRetainsFirst: true,
    officialUnchangedByReviewAndExport: true, errors, remoteUiRequests, targetRequests }, null, 2));
  console.log(JSON.stringify({ output, maxActiveSites: maxActive, formats: 4, independentSites: 2, aggregateSheets: aggregate.worksheets.length, cancellationRetainedFirst: true }));
} finally {
  for (const record of sessions.values()) record.controller.abort();
  await Promise.allSettled([...sessions.values()].map((record) => record.done));
  await browser?.close();
  for (const socket of sockets) socket.destroy();
  await Promise.all([app, ...fixtures.map((fixture) => fixture.server)].map((server) => new Promise((resolve) => server.close(resolve))));
}
