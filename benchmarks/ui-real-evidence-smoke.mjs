/** Real scanner output through the React results workspace via Tauri IPC replay. */
import { createServer as createHttpServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { scanSite } from "../packages/detection/dist/scan.js";
import { validateExtraResult, validateOfficialResultText } from "../packages/contracts/dist/result.js";
import { validateScanDetailBundle } from "../packages/contracts/dist/detail.js";

const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const fixtureRoot = resolve(repoRoot, "fixtures/realistic");
const distRoot = resolve(repoRoot, "apps/web/dist");
const fixture = createHttpServer((request, response) => {
  const name = new URL(request.url ?? "/", "http://fixture.local").pathname.replace(/^\//, "") || "index.html";
  if (!/^[a-z-]+\.html$/.test(name)) {
    response.writeHead(404);
    response.end("missing");
    return;
  }
  void readFile(resolve(fixtureRoot, name)).then((body) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(body);
  }).catch(() => {
    response.writeHead(404);
    response.end("missing");
  });
});
const appServer = createHttpServer((request, response) => {
  const pathname = new URL(request.url ?? "/", "http://app.local").pathname;
  const name = pathname === "/" ? "index.html" : pathname.slice(1);
  if (!/^[a-zA-Z0-9._/-]+$/.test(name) || name.split("/").includes("..")) {
    response.writeHead(404);
    response.end("missing");
    return;
  }
  const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2" };
  void readFile(resolve(distRoot, name)).then((body) => {
    response.writeHead(200, { "content-type": mime[extname(name)] ?? "application/octet-stream" });
    response.end(body);
  }).catch(() => {
    response.writeHead(404);
    response.end("missing");
  });
});

let browser;
try {
  await new Promise((done) => fixture.listen(0, "127.0.0.1", done));
  const entryUrl = `http://127.0.0.1:${fixture.address().port}/`;
  const output = await scanSite({
    entryUrl,
    topic: "municipal-style-fixture",
    crawl: { concurrency: 2, limits: { maxPages: 6, maxDepth: 2, timeoutSec: 90 }, settleMs: 1400, perPageMs: 10000 },
  });
  const result = output.result;
  const detail = output.detailBundle;
  if (!validateOfficialResultText(output.json).ok || !validateScanDetailBundle(detail, result).ok
    || !validateExtraResult(output.extraResult).ok) {
    throw new Error("real scanner output failed contract validation");
  }
  const truth = JSON.parse(await readFile(resolve(fixtureRoot, "ground-truth.json"), "utf8"));
  const key = (finding) => {
    const boundary = finding.location.lastIndexOf(">>>");
    const selector = boundary < 0 ? finding.location : finding.location.slice(boundary + 3).trim();
    return `${new URL(finding.url).pathname}\0${selector}\0${finding.technique}`;
  };
  const expected = truth.positive.map((finding) => `${finding.page}\0${finding.selector}\0${finding.technique}`).sort();
  const actual = result.findings.map(key).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)
    || detail.coverage.checkedPages !== truth.expectedCheckedPages
    || detail.coverage.failedPages.length !== truth.expectedFailedPages) {
    throw new Error("real scanner output differs from fixture ground truth");
  }

  await new Promise((done) => appServer.listen(0, "127.0.0.1", done));
  const appUrl = `http://127.0.0.1:${appServer.address().port}/`;
  browser = await chromium.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.addInitScript(({ result, detail, extra, entryUrl }) => {
    const session = { id: "real-evidence-ui", entryUrl, topic: "municipal-style-fixture",
      status: "succeeded", startedAt: result.meta.started_at, finishedAt: result.meta.finished_at };
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
  }, { result, detail, extra: output.extraResult, entryUrl });
  await page.goto(appUrl, { waitUntil: "networkidle" });
  await page.getByLabel("점검할 웹사이트").fill(entryUrl);
  await page.getByRole("button", { name: "점검 시작" }).click();
  await page.getByText(`표시 중인 탐지 ${String(result.findings.length)}건 / 전체 ${String(result.findings.length)}건`).waitFor({ timeout: 10000 });

  let renderedJpegs = 0;
  let transformedTexts = 0;
  for (const finding of result.findings) {
    await page.locator(`button[data-finding-id="${finding.id}"]`).click();
    const inspector = page.locator(".result-inspector");
    await inspector.locator(".raw").waitFor();
    if (await inspector.locator(".raw").textContent() !== finding.evidence_text) {
      throw new Error(`inspector raw text differs for ${finding.id}`);
    }
    const expected = detail.findings.find((item) => item.findingId === finding.id);
    if (!expected || expected.visual.state !== "available") throw new Error(`real JPEG missing for ${finding.id}`);
    if (["HOMOGLYPH", "JAMO"].includes(finding.technique)
      && await inspector.locator(".normalized").textContent() !== expected.normalizedText) {
      throw new Error(`inspector normalized text differs for ${finding.id}`);
    }
    if (["HOMOGLYPH", "JAMO"].includes(finding.technique)) transformedTexts += 1;
    if (finding.technique === "OFFSCREEN") {
      await inspector.getByText(`가로 ${Math.round(expected.observed.box.x)}px · 세로 ${Math.round(expected.observed.box.y)}px`, { exact: true }).waitFor();
    }
    const rendered = await inspector.locator(".visual-evidence img").evaluate((image) => ({
      src: image.getAttribute("src"), decoded: image.complete && image.naturalWidth > 0,
    }));
    if (rendered.src !== expected.visual.dataUrl || !rendered.decoded) {
      throw new Error(`inspector did not render the scanner JPEG for ${finding.id}`);
    }
    renderedJpegs += 1;
    await inspector.getByRole("button", { name: "결과 목록으로" }).click();
  }

  await page.getByRole("button", { name: "페이지별", exact: true }).click();
  const post = page.locator(".page-group").filter({ hasText: "/post.html" });
  await post.getByText("유사 문자 1건 · 자모 분리 1건 · 투명 처리 1건 · 화면 밖 배치 1건", { exact: true }).waitFor();
  await page.getByRole("button", { name: "점검 범위" }).click();
  await page.getByText(`확인한 페이지 ${String(detail.coverage.checkedPages)}개 · 실패한 페이지 ${String(detail.coverage.failedPages.length)}개`).last().waitFor();
  await page.getByRole("button", { name: "추가 분석" }).click();
  if (output.extraResult.findings.length === 0) {
    await page.getByText("추가 분석에서 확인된 항목이 없습니다.").waitFor();
  } else {
    await page.getByText(`추가 분석 ${String(output.extraResult.findings.length)}건`).waitFor();
  }
  await page.getByRole("button", { name: "공식 탐지" }).click();
  await page.getByRole("button", { name: "결과 저장" }).click();
  const dialog = page.getByRole("dialog", { name: "결과 저장" });
  await dialog.getByRole("button", { name: "저장" }).waitFor();
  if (await dialog.getByRole("button", { name: "저장" }).isDisabled()) {
    throw new Error("valid real result blocked from export");
  }
  await dialog.getByText(`공식 탐지 ${String(result.findings.length)}건`).waitFor();
  const partial = await dialog.getByRole("note").textContent();
  if (!partial?.includes(`확인 실패 ${String(detail.coverage.failedPages.length)}페이지`)) {
    throw new Error("real failed-page warning missing from export dialog");
  }
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.activeElement?.id === "export-trigger");
  console.log(JSON.stringify({ fixture: "real scanner to React results via IPC replay",
    officialFindings: result.findings.length, renderedJpegs, transformedTexts, pageTechniqueCounts: true,
    checkedPages: detail.coverage.checkedPages, failedPages: detail.coverage.failedPages.length,
    extraFindings: output.extraResult.findings.length,
    exportValidationPassed: true, focusRestored: true }, null, 2));
} finally {
  await browser?.close();
  if (appServer.listening) await new Promise((done) => appServer.close(done));
  if (fixture.listening) await new Promise((done) => fixture.close(done));
}
