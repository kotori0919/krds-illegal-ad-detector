/** Owned-loopback UI replay from a retained real-banner scan; never navigates to the source site. */
import assert from "node:assert/strict";
import process from "node:process";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { chromium } from "playwright-core";
import { initialProgress, validateScanDetailBundle } from "../packages/contracts/dist/index.js";
import { installResultReplay } from "./ui-evidence-ipc.mjs";

const variant = process.argv[2] ?? "after";
assert.ok(["before", "after"].includes(variant));
const base = process.env.UI_POLISH_EVIDENCE_DIR ?? "artifacts/ui-polish-20261022";
const layoutGoal = process.env.UI_POLISH_LAYOUT_GOAL ?? "reduce";
const out = `${base}/${variant}-banner`;
await mkdir(out, { recursive: true });
const receipt = JSON.parse(await readFile(process.env.UI_POLISH_SCAN_RECEIPT ?? "artifacts/embedding-precompute-20261022/runs/latestPositive-1-after.json", "utf8"));
const inputs = JSON.parse(await readFile(process.env.UI_POLISH_INPUTS ?? "artifacts/embedding-precompute-20261022/inputs.json", "utf8"));
const detail = { version: 2, findings: [], creativeImages: [],
  coverage: { checkedPages: 1, failedPages: [], timedOut: false },
  imageAnalysis: receipt.rows.flatMap(row => row.analyses), visualAssets: [],
  visualAnalysisCoverage: receipt.coverage, analysisIssues: receipt.analysisIssues };
for (const row of receipt.rows) {
  const item = inputs.find(item => item.id === row.id);
  const bytes = await readFile(item.path);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), row.inputSha256);
  assert.equal(row.analyses[0].assetId, `visual-${row.inputSha256}`);
  detail.visualAssets.push({ assetId: row.analyses[0].assetId, mimeType: "image/png", dataUrl: `data:image/png;base64,${bytes.toString("base64")}` });
}
assert.deepEqual(validateScanDetailBundle(detail, receipt.official, receipt.extra), { ok: true, errors: [] });
const id = "00000000-0000-4000-8000-000000000022";
const original = JSON.stringify(receipt.official);
const manifest = { schemaVersion: 1, caseId: id, entryUrl: receipt.official.meta.entry_url,
  startedAt: receipt.official.meta.started_at, finishedAt: receipt.official.meta.finished_at,
  exportableAt: receipt.official.meta.finished_at, status: "succeeded", toolVersion: receipt.official.meta.tool_version,
  policyVersion: 2, findings: 0, issues: [], officialSha256: createHash("sha256").update(original).digest("hex"),
  settings: { connection: "direct", transport: { kind: "direct", reason: "operator" } } };
const buildRoot = resolve(variant === "before" ? `${base}/before-build` : "apps/web/dist");
const server = createServer((req, res) => {
  const pathname = new URL(req.url, "http://fixture.local").pathname;
  const name = pathname === "/" ? "index.html" : pathname.slice(1);
  if (!/^[\w./-]+$/.test(name) || name.split("/").includes("..")) { res.writeHead(404); res.end(); return; }
  void readFile(resolve(buildRoot, name)).then(bytes => {
    res.writeHead(200, { "content-type": { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2" }[extname(name)] ?? "application/octet-stream" }); res.end(bytes);
  }).catch(() => { res.writeHead(404); res.end(); });
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const browser = await chromium.launch({ chromiumSandbox: false });
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = [], external = [];
  page.on("pageerror", error => errors.push(error.message));
  const origin = `http://127.0.0.1:${server.address().port}`;
  await page.route("**/*", route => {
    if (route.request().url().startsWith(origin) || route.request().url().startsWith("data:")) return route.continue();
    external.push(route.request().url()); return route.abort();
  });
  const session = { id, entryUrl: manifest.entryUrl, status: "finalizing", hasResult: true,
    startedAt: manifest.startedAt, finishedAt: manifest.finishedAt,
    progress: { ...initialProgress("finalizing"), sequence: 1, visitedPages: 1, elapsedSec: Math.floor(receipt.elapsedMs / 1000) } };
  const reads = await installResultReplay(page, { mode: "simple", result: receipt.official, detail, extra: receipt.extra,
    session,
    caseReplay: command => {
      if (command === "case_open") return { manifest, directory: "/fixture/banner-case", review: { schemaVersion: 1, revision: 0, updatedAt: "", records: [] } };
      if (command === "case_list") return { schemaVersion: 1, storageRoot: "/fixture", cases: [], issues: [], limit: 20 };
      throw new Error(`Unexpected case command ${command}`);
    } });
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.getByLabel("점검할 웹사이트", { exact: false }).fill(manifest.entryUrl);
  await page.getByRole("button", { name: /점검 시작/ }).click();
  await page.getByRole("heading", { name: "사이트 점검", exact: true }).waitFor();
  if (variant === "after") await page.getByText("배너 등 추가 단서 확인과 결과 저장이 끝나면 결과 화면으로 이동합니다.").waitFor();
  await page.screenshot({ path: `${out}/00-additional-analysis.png` });
  session.status = "succeeded";
  session.progress = { ...session.progress, sequence: 2, stage: "succeeded" };
  const extraTab = page.getByRole("button", { name: "추가 단서 6건", exact: true });
  await extraTab.waitFor();
  await page.evaluate(() => document.fonts.ready);
  const extraInitiallyVisible = await page.getByRole("heading", { name: "추가 분석", exact: true }).isVisible();
  const displayedElapsedLine = await page.locator(".result-completion").textContent();
  const totalSeconds = Math.floor(receipt.elapsedMs / 1000);
  const expectedElapsed = `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}`;
  if (variant === "after") assert.ok(displayedElapsedLine.includes(expectedElapsed), "Result time must include the retained scan's additional analysis");
  await page.screenshot({ path: `${out}/01-initial-result.png` });
  if (variant === "after") assert.ok(extraInitiallyVisible, "Image-only review candidates must appear on the first result screen");
  if (!extraInitiallyVisible) await extraTab.click();
  const firstEvidenceToggle = page.getByRole("button", { name: /^(?:1번 )?이미지 근거 보기$/ }).first();
  await firstEvidenceToggle.waitFor();
  const analysisReadsBeforeOpen = reads.filter(row => row.command === "scan_get_image_analysis").length;
  const candidateCards = page.locator('ol[aria-label="추가 분석 목록"] > li');
  const cardLayout = await candidateCards.evaluateAll(cards => ({ height: document.documentElement.scrollHeight, firstThreeBottom: cards[2]?.getBoundingClientRect().bottom }));
  if (variant === "after") {
    const beforeLayout = JSON.parse(await readFile(`${base}/before-banner/observed.json`, "utf8")).cardLayout;
    assert.ok(layoutGoal === "preserve" ? cardLayout.firstThreeBottom <= beforeLayout.firstThreeBottom + 1 : cardLayout.firstThreeBottom < beforeLayout.firstThreeBottom - 200, JSON.stringify({ beforeLayout, cardLayout, layoutGoal }));
    const rawIndex = receipt.extra.findings.findIndex(row => row.evidence_text.length > 240 || row.evidence_text.split("\n").length > 4);
    assert.ok(rawIndex >= 0);
    const rawDisclosure = candidateCards.nth(rawIndex).locator("details").first();
    assert.equal(await rawDisclosure.getAttribute("open"), null);
    await rawDisclosure.locator("summary").click();
    const raw = receipt.extra.findings[rawIndex].evidence_text;
    assert.equal(await rawDisclosure.locator(".raw").textContent(), raw);
    await rawDisclosure.locator("summary").click();
  }
  await page.screenshot({ path: `${out}/02-review-candidates.png`, fullPage: true });
  if (variant === "after") assert.equal(analysisReadsBeforeOpen, 0, "Simple mode must not fetch duplicate full OCR records before opening evidence");
  await firstEvidenceToggle.focus();
  await page.keyboard.press("Enter");
  if (variant === "after") {
    const toggle = page.getByRole("button", { name: "1번 이미지 근거 닫기", exact: true });
    assert.equal(await toggle.getAttribute("aria-expanded"), "true");
    const panelId = await toggle.getAttribute("aria-controls");
    assert.ok(panelId);
    assert.equal(await page.locator(`[id="${panelId}"]`).count(), 1);
    assert.equal(await page.getByRole("button", { name: "2번 이미지 근거 보기", exact: true }).getAttribute("aria-expanded"), "false");
  }
  const image = page.getByRole("img", { name: "문자를 분석한 수집 이미지", exact: true }).first();
  await image.waitFor();
  const analysis = detail.imageAnalysis.find(item => item.extraFindingId === receipt.extra.findings[0].id);
  assert.equal(await image.getAttribute("src"), detail.visualAssets.find(asset => asset.assetId === analysis.assetId).dataUrl);
  if (variant === "after") {
    const destination = page.locator(".finding-card .evidence dd").filter({ hasText: analysis.destinationUrl });
    assert.equal(await destination.locator(":scope > span").first().textContent(), analysis.destinationUrl);
    assert.equal(await destination.locator("a").count(), 0);
    assert.equal(await destination.locator("..").locator("dt").textContent(), "관측한 연결 주소");
    await page.evaluate(() => {
      Object.defineProperty(globalThis.navigator, "clipboard", { configurable: true, value: {
        writeText: async text => { window.__copiedDestination = text; },
      } });
    });
    await page.getByRole("button", { name: "관측한 연결 주소 복사", exact: true }).click();
    assert.equal(await page.evaluate(() => window.__copiedDestination), analysis.destinationUrl);
    await page.getByText("연결 주소를 복사했습니다.", { exact: true }).waitFor();
    const alternatives = analysis.ocrAlternatives?.filter(item => item.state === "available") ?? [];
    if (alternatives.length) {
      const toggle = page.getByText(`다른 인식 원문 ${alternatives.length}건 보기`, { exact: true });
      await toggle.focus(); await page.keyboard.press("Enter");
      const disclosure = toggle.locator("..");
      assert.notEqual(await disclosure.getAttribute("open"), null);
      const texts = await disclosure.locator(".raw").allTextContents();
      assert.deepEqual(texts, alternatives.map(item => item.text || "인식된 문자가 없습니다."));
      await toggle.focus(); await page.keyboard.press("Enter");
      assert.equal(await disclosure.getAttribute("open"), null);
    }
  }
  await page.screenshot({ path: `${out}/03-image-evidence.png`, fullPage: true });
  const evidenceWidths = [];
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    const sizes = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
    assert.ok(sizes.document <= sizes.viewport, `overflow at ${width}: ${JSON.stringify(sizes)}`);
    const widths = await page.locator(".finding-card .evidence dd").evaluateAll(items => items.map(item => item.getBoundingClientRect().width));
    evidenceWidths.push({ viewport: width, minValueWidth: Math.min(...widths) });
    if (variant === "after" && width === 320) assert.ok(Math.min(...widths) >= 180, "Narrow evidence values must retain readable line lengths");
    await page.screenshot({ path: `${out}/width-${width}.png`, fullPage: true });
    if (width === 320) {
      await page.getByRole("img", { name: "문자를 분석한 수집 이미지", exact: true }).first().scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${out}/width-320-evidence.png` });
    }
  }
  if (variant === "after") {
    const toggle = page.getByRole("button", { name: "1번 이미지 근거 닫기", exact: true });
    const controlledPanel = await toggle.getAttribute("aria-controls");
    await toggle.focus(); await page.keyboard.press("Enter");
    assert.equal(await page.locator(`button[aria-controls="${controlledPanel}"]`).getAttribute("aria-expanded"), "false");
    assert.equal(await page.getByRole("img", { name: "문자를 분석한 수집 이미지", exact: true }).count(), 0);
  }
  assert.equal(JSON.stringify(receipt.official), original);
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  assert.ok(!reads.some(row => /warp/i.test(row.command)));
  const advanced = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const advancedReads = await installResultReplay(advanced, { mode: "advanced", result: receipt.official, detail, extra: receipt.extra, session });
  await advanced.goto(origin, { waitUntil: "networkidle" });
  await advanced.getByText("상세 설정", { exact: true }).click();
  await advanced.getByRole("radio", { name: /자동 점검/ }).waitFor();
  await advanced.screenshot({ path: `${out}/04-advanced-start.png`, fullPage: true });
  await advanced.setViewportSize({ width: 320, height: 800 });
  assert.ok(await advanced.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await advanced.screenshot({ path: `${out}/05-advanced-start-320.png`, fullPage: true });
  assert.ok(!advancedReads.some(row => /warp/i.test(row.command)));
  await writeFile(`${out}/observed.json`, JSON.stringify({ evidence: "BROWSER_TAURI_ADAPTER_REPLAY", source: "retained actual6-banner scan; graph/creative index omitted; exact raw analyses/asset pixels retained",
    sourceReceiptSha256: createHash("sha256").update(JSON.stringify(receipt)).digest("hex"),
    observedModelIds: [...new Set(detail.imageAnalysis.flatMap(row => [row.textEmbedding?.model, row.visualEmbedding?.model]).filter(Boolean))],
    official: 0, extra: 6, extraInitiallyVisible, displayedElapsedLine, openedAssetByteIdentical: true,
    analysisReadsBeforeOpen, cardLayout, layoutGoal, evidenceWidths, alternateReadingsAccessible: variant === "after" && !!analysis.ocrAlternatives?.some(item => item.state === "available"), observedDestination: variant === "after" ? analysis.destinationUrl : undefined,
    destinationDisplayedAsPlainText: variant === "after", destinationCopyVerified: variant === "after", clipboardBoundary: "Test-only stub; system clipboard not modified", errors, external, warpCalls: 0, reads }, null, 2) + "\n");
  console.log(JSON.stringify({ variant, extraInitiallyVisible, analysisReadsBeforeOpen, errors, external }));
} finally { await browser.close(); server.closeAllConnections(); await new Promise(done => server.close(done)); }
