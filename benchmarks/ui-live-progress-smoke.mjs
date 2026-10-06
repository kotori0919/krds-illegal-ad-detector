/** Real scanner -> polled React progress through browser IPC replay, no events. */
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { initialProgress } from "../packages/contracts/dist/scan.js";
import { validateOfficialResultText, validateExtraResult } from "../packages/contracts/dist/result.js";
import { validateScanDetailBundle } from "../packages/contracts/dist/detail.js";
import { scanSite } from "../packages/detection/dist/scan.js";

const root = fileURLToPath(new URL("../", import.meta.url));
function files(directory, fallback) {
  return createServer((request, response) => {
    const name = new URL(request.url ?? "/", "http://local/").pathname.slice(1) || fallback;
    if (!/^[\w./-]+$/.test(name) || name.split("/").includes("..")) {
      response.writeHead(404); response.end(); return;
    }
    void readFile(resolve(root, directory, name)).then((body) => {
      const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2" };
      response.writeHead(200, { "content-type": mime[extname(name)] ?? "application/octet-stream" }); response.end(body);
    }).catch(() => { response.writeHead(404); response.end("missing"); });
  });
}
const fixture = files("fixtures/realistic", "index.html");
const app = files("apps/web/dist", "index.html");
let browser;
let scanning;
let output;
let session;
const events = [];
const nativeZoom = process.argv.includes("--zoom");
try {
  await Promise.all([fixture, app].map((server) => new Promise((done) => server.listen(0, "127.0.0.1", done))));
  const entryUrl = `http://127.0.0.1:${fixture.address().port}/`;
  browser = await chromium.launch({ headless: !nativeZoom, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: nativeZoom ? 720 : 360, height: 800 } });
  await page.exposeFunction("progressSmokeInvoke", async (command, args) => {
    switch (command) {
      case "plugin:event|listen": return 1;
      case "plugin:event|unlisten": return;
      case "scan_start": {
        session = { id: "live-progress", entryUrl, topic: "", status: "running",
          startedAt: new Date().toISOString(), progress: initialProgress("running") };
        scanning = scanSite({ entryUrl: args.request.entryUrl,
          crawl: { concurrency: 2, settleMs: 2200, perPageMs: 10000,
            limits: { maxPages: 6, maxDepth: 2, timeoutSec: 90 } },
          onEvent: (event) => {
            events.push(event);
            session.progress = event.progress;
            if (event.progress.stage === "finalizing") session.status = "finalizing";
          },
        }).then((result) => {
          if (!validateOfficialResultText(result.json).ok || !validateExtraResult(result.extraResult).ok
            || !validateScanDetailBundle(result.detailBundle, result.result).ok) throw new Error("invalid persisted result");
          output = result;
          session.status = "succeeded";
          session.finishedAt = result.result.meta.finished_at;
        }).catch((error) => { session.status = "failed"; session.error = String(error); });
        return session;
      }
      case "scan_get_session": return session;
      case "scan_get_result": return output?.result;
      case "scan_get_detail_bundle": return output?.detailBundle;
      case "scan_get_extra_result": return output?.extraResult;
      default: throw new Error(`unexpected IPC command ${command}`);
    }
  });
  await page.addInitScript(() => {
    window.__TAURI_INTERNALS__ = { transformCallback: () => 1, unregisterCallback: () => {},
      invoke: (command, args) => window.progressSmokeInvoke(command, args) };
  });
  await page.goto(`http://127.0.0.1:${app.address().port}/`, { waitUntil: "networkidle" });
  if (nativeZoom) {
    const run = promisify(execFile);
    const { stdout } = await run("xdotool", ["search", "--onlyvisible", "--class", "chromium"]);
    const windowId = stdout.trim().split("\n").at(-1);
    if (!windowId) throw new Error("headed Chromium window unavailable");
    await run("xdotool", ["windowfocus", "--sync", windowId]);
    for (let index = 0; index < 5; index += 1) await run("xdotool", ["key", "--window", windowId, "ctrl+plus"]);
    await page.waitForFunction(() => window.devicePixelRatio === 2 && innerWidth === 360);
  }
  await page.getByLabel("점검할 웹사이트").fill(entryUrl);
  await page.getByRole("button", { name: "점검 시작" }).click();
  const current = page.getByRole("region", { name: "현재 확인 중" });
  await current.waitFor();
  const activeUrls = await current.getByRole("listitem").allTextContents();
  if (activeUrls.length < 1 || activeUrls.length > 2 || !activeUrls.every((url) => url.startsWith(entryUrl))) {
    throw new Error(`unexpected polled active work: ${JSON.stringify(activeUrls)}`);
  }
  const activity = page.getByRole("region", { name: "최근 활동" });
  const spinner = page.locator(".krds-spinner");
  await spinner.waitFor();
  if (await spinner.getAttribute("aria-hidden") !== "true") throw new Error("decorative spinner adds speech noise");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await spinner.waitFor({ state: "hidden" });
  await page.getByRole("status").waitFor();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await spinner.waitFor();
  const layout = await page.evaluate(() => ({
    viewport: innerWidth, document: document.documentElement.scrollWidth,
    bodyFont: getComputedStyle(document.body).fontSize,
    devicePixelRatio: window.devicePixelRatio,
    nestedOverflow: [...document.querySelectorAll("*")].filter((element) => !element.classList.contains("sr-only")
      && element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 2).map((element) => element.tagName),
    clock: [...document.querySelectorAll("dt")].find((node) => node.textContent === "경과 시간")?.nextElementSibling?.textContent,
  }));
  if (layout.document > layout.viewport || layout.nestedOverflow.length || !/^\d{2}:\d{2}$/.test(layout.clock) || layout.bodyFont !== "17px") {
    throw new Error(`invalid progress layout: ${JSON.stringify(layout)}`);
  }
  await page.screenshot({ path: `/tmp/illegal-ad-toolchain/live-progress-${nativeZoom ? "zoom" : "360"}.png`, fullPage: true });
  await page.getByRole("button", { name: "점검 중지", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.activeElement?.textContent === "점검 중지");
  const activityCount = await activity.getByRole("listitem").count();
  if (activityCount > 5) throw new Error("unbounded activity list");
  await page.getByText("표시 중인 탐지 5건 / 전체 5건").waitFor({ timeout: 30000 });
  await scanning;
  if (output?.pagesVisited !== 6 || output.failedPages !== 1 || output.result.findings.length !== 5) {
    throw new Error("scanner coverage differs from fixture");
  }
  const failureEvent = events.find((event) => event.kind === "page-failed");
  if (!failureEvent || !failureEvent.pageUrl.endsWith("/missing.html") || failureEvent.progress.failedPages !== 1) {
    throw new Error("typed failure feedback missing");
  }
  await page.getByText(/점검 완료 — 일부 페이지 확인 실패/).waitFor();
  console.log(JSON.stringify({ scope: "real scanner / browser IPC replay", events: events.length,
    eventDelivery: false, activeUrls, activityCount, layout, checked: 6, failed: 1, findings: 5,
    validators: "passed", cancelFocusRestored: true, partialStatus: true, reducedMotion: true, nativeZoom }));
} finally {
  await scanning;
  await browser?.close();
  await Promise.all([fixture, app].map((server) => new Promise((done) => server.close(done))));
}
