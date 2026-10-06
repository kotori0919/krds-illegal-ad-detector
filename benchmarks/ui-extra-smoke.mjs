/** Real observed ad images through the React extra-analysis workspace via IPC replay. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { scanSite } from "../packages/detection/dist/scan.js";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const assetRoot = resolve(root, "fixtures/realistic/ads");
const distRoot = resolve(root, "apps/web/dist");
const allowedAssets = new Set(["creative.png", "resized.png"]);
const assets = createServer((request, response) => {
  const name = new URL(request.url ?? "/", "http://asset.local").pathname.slice(1);
  if (!allowedAssets.has(name)) { response.writeHead(404); response.end(); return; }
  void readFile(resolve(assetRoot, name)).then((body) => {
    response.writeHead(200, { "content-type": "image/png", "content-length": body.length }); response.end(body);
  }).catch(() => { response.writeHead(404); response.end(); });
});
let assetOrigin = "";
const site = createServer((request, response) => {
  const path = new URL(request.url ?? "/", "http://site.local").pathname;
  if (path !== "/" && path !== "/second") { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(`<!doctype html><html lang="ko"><body><a href="/second">다음</a>
    <a href="${assetOrigin}/landing"><img alt="광고 배너" src="${assetOrigin}/${path === "/" ? "creative.png" : "resized.png"}"></a>
    </body></html>`);
});
const app = createServer((request, response) => {
  const pathname = new URL(request.url ?? "/", "http://app.local").pathname;
  const name = pathname === "/" ? "index.html" : pathname.slice(1);
  if (!/^[a-zA-Z0-9._/-]+$/.test(name) || name.split("/").includes("..")) {
    response.writeHead(404); response.end(); return;
  }
  const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2" };
  void readFile(resolve(distRoot, name)).then((body) => {
    response.writeHead(200, { "content-type": mime[extname(name)] ?? "application/octet-stream" });
    response.end(body);
  }).catch(() => { response.writeHead(404); response.end(); });
});

let browser;
try {
  await new Promise((done) => assets.listen(0, "127.0.0.1", done));
  assetOrigin = `http://127.0.0.1:${assets.address().port}`;
  await new Promise((done) => site.listen(0, "127.0.0.1", done));
  const entryUrl = `http://127.0.0.1:${site.address().port}/`;
  let progress;
  const output = await scanSite({ entryUrl, topic: "ad-fixture", onEvent: (event) => { progress = event.progress; }, crawl: {
    concurrency: 2, settleMs: 300, perPageMs: 7000,
    limits: { maxPages: 2, maxDepth: 1, timeoutSec: 45 },
  } });
  if (output.result.findings.length !== 0 || output.extraResult.findings.length !== 2) {
    throw new Error("real scan did not yield the expected separate extra findings");
  }
  await new Promise((done) => app.listen(0, "127.0.0.1", done));
  browser = await chromium.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.addInitScript(({ result, detail, extra, entryUrl, progress }) => {
    const session = { id: "extra-ui", entryUrl, topic: "ad-fixture", status: "succeeded",
      startedAt: result.meta.started_at, finishedAt: result.meta.finished_at, progress };
    window.__TAURI_INTERNALS__ = {
      transformCallback: () => 1,
      unregisterCallback: () => {},
      invoke: async (command) => {
        switch (command) {
          case "plugin:event|listen": return 1;
          case "scan_start": case "scan_get_session": return session;
          case "scan_get_result": return result;
          case "scan_get_detail_bundle": return detail;
          case "scan_get_extra_result": return extra;
          default: throw new Error(`unexpected IPC command ${command}`);
        }
      },
    };
  }, { result: output.result, detail: output.detailBundle, extra: output.extraResult, entryUrl, progress });
  await page.goto(`http://127.0.0.1:${app.address().port}/`, { waitUntil: "networkidle" });
  await page.getByLabel("점검할 웹사이트").fill(entryUrl);
  await page.getByRole("button", { name: "점검 시작" }).click();
  await page.getByText("표시 중인 탐지 0건 / 전체 0건").waitFor();
  await page.setViewportSize({ width: 360, height: 800 });
  await page.getByRole("button", { name: "추가 분석" }).focus();
  await page.keyboard.press("Enter");
  await page.getByText("추가 분석 2건").waitFor();
  await page.getByRole("heading", { name: "반복 광고 소재" }).waitFor();
  await page.getByRole("heading", { name: "연관 광고 인프라" }).waitFor();
  if (await page.getByLabel("추가 분석 목록").locator("li").count() !== 2) {
    throw new Error("extra list did not display both observed findings");
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (overflow) throw new Error("extra results overflow at 360px");
  await page.getByRole("button", { name: "공식 탐지" }).click();
  await page.getByText("확정된 탐지가 없습니다.", { exact: false }).waitFor();
  console.log(JSON.stringify({ fixture: "observed images to React extra results via IPC replay",
    officialFindings: 0, extraFindings: 2, separateList: true,
    keyboardNavigation: true, reflow360px: true }, null, 2));
} finally {
  await browser?.close();
  if (app.listening) await new Promise((done) => app.close(done));
  if (site.listening) await new Promise((done) => site.close(done));
  if (assets.listening) await new Promise((done) => assets.close(done));
}
