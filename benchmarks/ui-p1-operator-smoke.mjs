/** Actual scan output; explicit IPC replay exercises P1 operator recovery. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { setTimeout } from "node:timers";
import { chromium } from "playwright-core";
import { scanSite } from "../packages/detection/dist/scan.js";
import { serializeOfficialResult, validateOfficialResultText } from "../packages/contracts/dist/result.js";
import { validateScanDetailBundle } from "../packages/contracts/dist/detail.js";
import { initialProgress } from "../packages/contracts/dist/scan.js";
import { startOperatorFixture } from "./p1-operator-fixture.mjs";
import { installResultReplay } from "./ui-evidence-ipc.mjs";

const fixture = await startOperatorFixture();
const app = createServer((request, response) => {
  const path = new URL(request.url ?? "/", "http://app.invalid").pathname;
  const name = path === "/" ? "index.html" : path.slice(1);
  if (!/^[a-zA-Z0-9._/-]+$/.test(name) || name.split("/").includes("..")) { response.writeHead(404); response.end(); return; }
  void readFile(resolve("apps/web/dist", name)).then((bytes) => {
    response.writeHead(200, { "content-type": { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" }[extname(name)] ?? "application/octet-stream" }); response.end(bytes);
  }).catch(() => { response.writeHead(404); response.end(); });
});
let browser;
try {
  const output = await scanSite({ entryUrl: fixture.entryUrl,
    crawl: { concurrency: 1, settleMs: 40, limits: { maxPages: 9, timeoutSec: 90 } } });
  assert(validateScanDetailBundle(output.detailBundle, output.result, output.extraResult).ok);
  const measured = output.detailBundle.visualAnalysisCoverage;
  assert.equal(output.detailBundle.coverage.checkedPages, 9);
  assert.equal(measured.pagesConsidered, 8); assert.equal(measured.pagesNotConsidered, 1);
  assert.equal(measured.candidateTotal, null); assert.equal(measured.ocrImagesCompleted, 6);
  assert(measured.limitsReached.includes("ocr-image-limit") && measured.limitsReached.includes("page-limit"));
  const analyses = output.detailBundle.imageAnalysis;
  assert(analyses.some((item) => item.extraFindingId));
  assert(analyses.some((item) => item.ocr.state === "available" && !item.decision.passed));
  for (const path of ["/frame-main-caption", "/frame-image-caption"]) {
    assert(analyses.filter((item) => item.pageUrls.some((url) => new URL(url).pathname === path)).every((item) => item.visibleDomEquivalent && !item.extraFindingId));
  }
  const resourceNodes = output.detailBundle.evidenceGraph.nodes.filter((node) => node.kind === "Resource" && fixture.resources.includes(node.url));
  assert.equal(resourceNodes.length, 2); assert.notEqual(resourceNodes[0].id, resourceNodes[1].id);
  const officialText = serializeOfficialResult(output.result);
  const first = output.result.findings.find((item) => item.location === "#first-ad");
  const second = output.result.findings.find((item) => item.location === "#second-ad");
  assert(first && second);
  await new Promise((done) => app.listen(0, "127.0.0.1", done));
  browser = await chromium.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on("pageerror", (error) => console.error("UI error:", error.message));
  let summaryFailed = false;
  const reads = await installResultReplay(page, { result: output.result, detail: output.detailBundle, extra: output.extraResult,
    exportReplay: async () => {
      await writeFile("/tmp/illegal-ad-p1-focused-result.json", serializeOfficialResult(output.result));
      return { resultJson: "/tmp/illegal-ad-p1-focused-result.json" };
    },
    session: { id: "p1-operator", entryUrl: fixture.entryUrl, status: "succeeded", hasResult: true,
      startedAt: output.result.meta.started_at, finishedAt: output.result.meta.finished_at, progress: initialProgress("succeeded") },
    beforeRead: async (command, args) => {
      if (command === "scan_get_evidence_summary" && !summaryFailed) { summaryFailed = true; throw new Error("controlled optional summary read failure"); }
      if (command === "scan_get_finding_detail" && args.findingId === first.id) await new Promise((done) => setTimeout(done, 300));
    } });
  await page.goto(`http://127.0.0.1:${app.address().port}/`);
  await page.getByLabel("점검할 웹사이트").fill(fixture.entryUrl);
  await page.getByRole("button", { name: "점검 시작", exact: true }).click();
  await page.getByRole("button", { name: "근거 요약 다시 불러오기" }).waitFor();
  const countsBefore = new Map(reads.map(({ command }) => [command, reads.filter((item) => item.command === command).length]));
  await page.getByRole("button", { name: "근거 요약 다시 불러오기" }).click();
  await page.getByText("시도 6개 · 완료 6개 · 분석 불가 0개", { exact: true }).waitFor();
  for (const command of ["scan_start", "scan_get_result", "scan_get_coverage"]) assert.equal(reads.filter((item) => item.command === command).length, countsBefore.get(command));
  await page.locator(`button[data-finding-id="${first.id}"]`).click();
  await page.locator(`button[data-finding-id="${second.id}"]`).click();
  const inspector = page.locator(".result-inspector");
  await inspector.getByText(second.location, { exact: true }).waitFor({ state: "attached" });
  await page.waitForTimeout(350);
  assert.equal(await inspector.locator("code").first().textContent(), second.location);
  await inspector.getByRole("button", { name: "검토 완료로 표시" }).click();
  assert.equal(await inspector.getByRole("button", { name: "검토 완료 취소" }).count(), 1);
  await inspector.getByRole("button", { name: "결과 목록으로" }).click();
  await page.getByRole("button", { name: "추가 분석", exact: true }).click();
  const infrastructure = page.getByRole("region", { name: "관련 광고 인프라" });
  await infrastructure.getByRole("button", { name: "관계 보기", exact: true }).first().click();
  const relation = infrastructure.getByRole("region", { name: "근거 관계" }).first();
  await relation.getByText(/연결 기록은 공동 소유/).waitFor();
  const primary = await relation.locator("ul").first().textContent();
  assert(primary.includes("자료 호스트")); assert(!primary.includes("resource-") && !/[a-f0-9]{64}/.test(primary));
  await page.getByRole("button", { name: "이미지 분석 더 보기" }).click();
  await page.getByRole("region", { name: "이미지 문자 분석" }).getByText("광고 표현 미확인", { exact: true }).first().waitFor();
  await page.getByRole("button", { name: "공식 탐지", exact: true }).click();
  await page.getByRole("button", { name: "결과 저장", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"] button')].some((button) => button.textContent === "저장" && !button.disabled));
  await dialog.getByRole("button", { name: "저장", exact: true }).click();
  await dialog.getByText(/저장 완료:/).waitFor();
  const savedText = await readFile("/tmp/illegal-ad-p1-focused-result.json", "utf8");
  assert.equal(savedText, officialText); assert(validateOfficialResultText(savedText).ok);
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  await page.waitForFunction(() => document.activeElement?.id === "export-trigger");
  await page.setViewportSize({ width: 360, height: 800 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  const report = { fixture: "actual scan to explicit IPC replay", checkedPages: 9, visualAnalysisCoverage: measured,
    imageFinding: true, imageNoFinding: true, isolatedReadRetry: true, rapidSelection: true, readableRelations: true,
    reviewExportUnchanged: true, exportMode: "explicit IPC replay writes canonical worker JSON", focusRestored: true, narrowReflow: true, frameCaptionRegression: true, resourceCollisionRegression: true };
  await writeFile("/tmp/illegal-ad-p1-operator-smoke.json", JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} finally { await browser?.close(); if (app.listening) await new Promise((done) => app.close(done)); await fixture.close(); }
