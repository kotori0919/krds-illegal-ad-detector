/** Real scanner artifacts and filesystem errors through React browser IPC replay. */
import { createServer } from "node:http";
import { readFile, writeFile, mkdtemp, mkdir, chmod, rm } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Buffer } from "node:buffer";
import { performance } from "node:perf_hooks";
import { setTimeout } from "node:timers/promises";
import { chromium } from "playwright-core";
import { scanSite } from "../packages/detection/dist/scan.js";
import { resolveFixturePath } from "../packages/synth-eval/dist/serve.js";
import { validateOfficialResultText, validateExtraResult } from "../packages/contracts/dist/result.js";
import { validateScanDetailBundle } from "../packages/contracts/dist/detail.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const nativeZoom = process.argv.includes("--zoom");
const run = promisify(execFile);
let zoomWindow;
function serverFor(pathFor) {
  return createServer((request, response) => {
    const path = pathFor(request.url ?? "/");
    if (!path) { response.writeHead(404); response.end(); return; }
    void readFile(path).then((body) => {
      const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2" };
      response.writeHead(200, { "content-type": mime[extname(path)] ?? "application/octet-stream" }); response.end(body);
    }).catch(() => { response.writeHead(404); response.end("missing"); });
  });
}
const fixture = serverFor(resolveFixturePath);
const app = serverFor((url) => {
  const name = new URL(url, "http://local/").pathname.slice(1) || "index.html";
  return /^[\w./-]+$/.test(name) && !name.split("/").includes("..") ? resolve(root, "apps/web/dist", name) : undefined;
});
const temporary = await mkdtemp(join(tmpdir(), "illegal-ad-ui-states-"));
const readonly = join(temporary, "readonly");
let browser;
try {
  await Promise.all([fixture, app].map((server) => new Promise((done) => server.listen(0, "127.0.0.1", done))));
  const origin = `http://127.0.0.1:${fixture.address().port}`;
  async function scan(entryUrl, maxPages, settleMs) {
    let progress;
    const output = await scanSite({ entryUrl, topic: "state-gate",
      crawl: { concurrency: 2, settleMs, perPageMs: 20000, limits: { maxPages, maxDepth: 4, timeoutSec: 300 } },
      onEvent: (event) => { progress = event.progress; },
    });
    if (!validateOfficialResultText(output.json).ok || !validateExtraResult(output.extraResult).ok
      || !validateScanDetailBundle(output.detailBundle, output.result, output.extraResult).ok) throw new Error("invalid scanner artifacts");
    return { ...output, progress };
  }
  const positive = await scan(`${origin}/`, 30, 1800);
  const empty = await scan(`${origin}/negatives.html`, 1, 300);
  if (positive.result.findings.length !== 17 || empty.result.findings.length !== 0) throw new Error("fixture findings changed");
  const unavailable = positive.detailBundle.findings.find((finding) => finding.visual.state === "unavailable");
  if (!unavailable) throw new Error("fixture did not exercise the visual capture budget");
  let output = positive;
  let coverageMode = "normal";
  let resultRejected = false;
  let exportCalls = 0;
  const coverageWaiters = [];
  let pendingSave;
  browser = await chromium.launch({ headless: !nativeZoom, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: nativeZoom ? 720 : 360, height: 800 } });
  await page.exposeFunction("stateSmokeInvoke", (command) => {
    switch (command) {
      case "plugin:event|listen": return 1;
      case "plugin:event|unlisten": return;
      case "scan_start": case "scan_get_session": return { id: "states", entryUrl: output.result.meta.entry_url,
        topic: "", status: "succeeded", startedAt: output.result.meta.started_at,
        finishedAt: output.result.meta.finished_at, progress: output.progress };
      case "scan_get_result": if (resultRejected) throw new Error("private result read error"); return output.result;
      case "scan_get_detail_bundle":
        if (coverageMode === "hold") return new Promise((complete) => coverageWaiters.push(complete));
        if (coverageMode === "reject") throw new Error("private coverage read error");
        if (coverageMode === "missing") return undefined;
        return output.detailBundle;
      case "scan_get_extra_result": return output.extraResult;
      case "scan_export":
        exportCalls += 1;
        return new Promise((resolve, reject) => { pendingSave = { resolve, reject }; });
      default: throw new Error(`unexpected IPC command ${command}`);
    }
  });
  await page.addInitScript(() => {
    window.__TAURI_INTERNALS__ = { transformCallback: () => 1, unregisterCallback: () => {},
      invoke: (command) => window.stateSmokeInvoke(command) };
  });
  const appUrl = `http://127.0.0.1:${app.address().port}/`;
  async function start() {
    await page.goto(appUrl, { waitUntil: "networkidle" });
    await page.getByLabel("점검할 웹사이트").fill(output.result.meta.entry_url);
    await page.getByRole("button", { name: "점검 시작" }).click();
  }
  async function reflow() {
    const layout = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth,
      dpr: window.devicePixelRatio, overflow: [...document.querySelectorAll("*")].filter((element) =>
        !element.classList.contains("sr-only") && element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 2).map((element) => element.tagName) }));
    if (layout.document > layout.viewport || layout.overflow.length) throw new Error(`state overflow: ${JSON.stringify(layout)}`);
    return layout;
  }
  await page.goto(appUrl, { waitUntil: "networkidle" });
  if (nativeZoom) {
    const { stdout } = await run("xdotool", ["search", "--onlyvisible", "--class", "chromium"]);
    zoomWindow = stdout.trim().split("\n").at(-1);
    if (!zoomWindow) throw new Error("headed Chromium unavailable");
    await run("xdotool", ["windowfocus", "--sync", zoomWindow]);
    for (let index = 0; index < 5; index += 1) await run("xdotool", ["key", "--window", zoomWindow, "ctrl+plus"]);
    await page.waitForFunction(() => window.devicePixelRatio === 2 && innerWidth === 360);
  }

  coverageMode = "hold";
  await start();
  await page.getByText("표시 중인 탐지 17건 / 전체 17건").waitFor();
  await page.getByRole("button", { name: "점검 범위", exact: true }).click();
  await page.getByText("점검 범위를 불러오는 중입니다.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "결과 저장" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByText("공식 탐지 17건", { exact: true }).waitFor();
  if (await dialog.getByRole("button", { name: "저장", exact: true }).isEnabled()) throw new Error("save enabled before coverage");
  coverageMode = "normal";
  for (const complete of coverageWaiters.splice(0)) complete(output.detailBundle);
  await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"] button')].some((button) => button.textContent === "저장" && !button.disabled));
  async function beginSave() {
    const before = exportCalls;
    await dialog.getByRole("button", { name: /^(저장|다시 저장)$/ }).evaluate((button) => { button.click(); button.click(); });
    await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"] button')].every((button) => button.disabled));
    const expires = performance.now() + 5000;
    while (!pendingSave && performance.now() < expires) await setTimeout(10);
    if (!pendingSave) throw new Error("pending host save request unavailable");
    if (exportCalls !== before + 1) throw new Error("duplicate host save request");
    await page.keyboard.press("Escape");
    await dialog.waitFor();
    await page.keyboard.press("Tab");
    const titleFocused = await dialog.getByRole("heading").evaluate((heading) => document.activeElement === heading);
    if (!titleFocused) throw new Error("pending save focus escaped dialog");
  }
  async function saveFocus() {
    await page.waitForFunction(() => document.activeElement?.matches('[role="dialog"] button.primary') && !document.activeElement.disabled);
  }
  await beginSave();
  await reflow();
  pendingSave.resolve({ resultJson: null }); pendingSave = undefined;
  await saveFocus();
  if (await dialog.getByRole("alert").count() || await dialog.getByRole("status").count()) throw new Error("cancel did not settle silently");
  await beginSave();
  await mkdir(readonly); await chmod(readonly, 0o500);
  let writeError;
  try { await writeFile(join(readonly, "result.json"), output.json, "utf8"); }
  catch (error) { writeError = error; }
  finally { await chmod(readonly, 0o700); }
  if (writeError?.code !== "EACCES") throw new Error("readonly write did not reproduce EACCES");
  pendingSave.reject(writeError); pendingSave = undefined;
  await dialog.getByRole("alert").waitFor();
  await saveFocus();
  if ((await dialog.innerText()).includes(writeError.message)) throw new Error("private filesystem error exposed");
  const failedLayout = await reflow();
  const screenshot = `/tmp/illegal-ad-toolchain/save-failure-${nativeZoom ? "zoom" : "360"}.png`;
  // Browser full-page capture clips physical pixels after native zoom; capture
  // the isolated Xvfb window for the actual rendered operator view instead.
  if (nativeZoom) await run("import", ["-window", zoomWindow, screenshot]);
  else await page.screenshot({ path: screenshot, fullPage: true });
  await beginSave();
  const savedPath = join(temporary, "result.json");
  await writeFile(savedPath, output.json, "utf8");
  pendingSave.resolve({ resultJson: savedPath }); pendingSave = undefined;
  await dialog.getByText(`저장 완료: ${savedPath}`, { exact: true }).waitFor();
  await saveFocus();
  const savedText = await readFile(savedPath, "utf8");
  if (!validateOfficialResultText(savedText).ok || JSON.stringify(JSON.parse(savedText).findings) !== JSON.stringify(output.result.findings)) throw new Error("saved findings changed");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.activeElement?.id === "export-trigger");

  await page.getByRole("button", { name: "공식 탐지", exact: true }).click();
  await page.locator(`[data-finding-id="${unavailable.findingId}"]`).click();
  const inspector = page.getByRole("complementary", { name: "탐지 상세" });
  await inspector.getByText(/화면 캡처 없음/).waitFor();
  if (await inspector.locator("img").count()) throw new Error("unavailable evidence fabricated an image");
  await inspector.getByText(unavailable.rawText, { exact: true }).waitFor();
  await reflow();
  await inspector.getByRole("button", { name: "검토 완료로 표시" }).click();
  await inspector.getByRole("button", { name: "결과 목록으로" }).click();
  await page.waitForFunction((id) => document.activeElement?.getAttribute("data-finding-id") === id, unavailable.findingId);

  coverageMode = "reject";
  await start();
  await page.getByText("표시 중인 탐지 17건 / 전체 17건").waitFor();
  await page.getByRole("button", { name: "점검 범위", exact: true }).click();
  await page.getByRole("alert").waitFor();
  await page.getByRole("button", { name: "공식 탐지", exact: true }).click();
  await page.getByText("표시 중인 탐지 17건 / 전체 17건").waitFor();
  coverageMode = "missing";
  await start();
  await page.getByText("표시 중인 탐지 17건 / 전체 17건").waitFor();
  await page.getByRole("button", { name: "점검 범위", exact: true }).click();
  await page.getByText("점검 범위 기록 없음", { exact: true }).waitFor();
  await page.getByRole("button", { name: "결과 저장" }).click();
  await dialog.getByText("점검 범위 기록 없음", { exact: true }).waitFor();
  if (!await dialog.getByRole("button", { name: "저장", exact: true }).isEnabled()) throw new Error("missing coverage blocked validated findings");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.activeElement?.id === "export-trigger");
  resultRejected = true;
  await start();
  await page.getByRole("alert").waitFor();
  if (await page.getByText("결과를 불러오는 중입니다.", { exact: true }).count()) throw new Error("failed result read still loading");
  if (await page.getByRole("button", { name: "결과 저장" }).isEnabled()) throw new Error("failed result savable");
  await page.getByRole("button", { name: "새로 검사하기" }).click();
  await page.waitForFunction(() => document.activeElement?.id === "entry-url");
  resultRejected = false; coverageMode = "normal"; output = empty;
  await start();
  await page.getByText("표시 중인 탐지 0건 / 전체 0건").waitFor();
  if (await page.getByRole("list", { name: "확정된 탐지 목록" }).count()) throw new Error("empty result has stale findings");
  await page.getByRole("button", { name: "새로 검사하기" }).click();
  await page.waitForFunction(() => document.activeElement?.id === "entry-url");
  console.log(JSON.stringify({ scope: "actual scanner / browser IPC and filesystem replay", nativeZoom,
    positive: 17, empty: 0, unavailableFinding: unavailable.findingId, unavailableReason: unavailable.visual.reason,
    savedBytes: Buffer.byteLength(savedText), savedValidator: "passed", writeError: writeError.code,
    exportCalls, pendingGuard: true, cancelSettlement: true, coverageLoading: true,
    missingCoverage: true, readFailureSettlement: true, focusRestored: true, failedLayout }));
} finally {
  await browser?.close();
  await Promise.all([fixture, app].map((server) => new Promise((done) => server.close(done))));
  await rm(temporary, { recursive: true, force: true });
}
