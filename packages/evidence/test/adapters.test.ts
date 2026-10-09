import { expect, it } from "vitest";
import ExcelJS from "exceljs";
import { chromium } from "playwright-core";
import { ScanDeadline } from "@krds-detector/scanner";
import type { OfficialResult } from "@krds-detector/contracts";
import { livePageVisualSource } from "../../detection/src/creative.js";
import { blockHashSimilarity, groupSimilarCreatives, type CreativeFingerprint } from "../src/fingerprint.js";
import { operationalWorkbookExporter } from "../src/report.js";
import type { AdapterIssue } from "../src/adapters.js";

it("distinguishes real live visual capture, no candidates, exhausted work and a closed source", async () => {
  const browser = await chromium.launch({ chromiumSandbox: true });
  try {
    const page = await browser.newPage();
    const request = { page, frames: [], responses: [], deadline: new ScanDeadline(30), maxBytes: 250_000 };
    await page.setContent('<svg id="ad" width="60" height="20"><rect width="60" height="20" fill="red"/></svg>');
    const captured = await livePageVisualSource.acquire(request);
    expect(captured.state).toBe("available");
    if (captured.state !== "available") throw new Error(captured.issue.code);
    expect(captured.value.images[0]?.candidate.location).toBe("#ad");
    expect(captured.value.images[0]?.mimeType).toBe("image/png");
    await page.setContent("<p>ordinary text</p>");
    const empty = await livePageVisualSource.acquire(request);
    expect(empty.state === "available" && empty.value.images).toEqual([]);
    expect(await livePageVisualSource.acquire({ ...request, maxBytes: 0 })).toEqual({ state: "unavailable", issue: { code: "BUDGET", retryable: false } });
    expect(await livePageVisualSource.acquire({ ...request, maxBytes: Number.NaN })).toEqual({ state: "unavailable", issue: { code: "INVALID_INPUT", retryable: false } });
    const controller = new AbortController(); controller.abort();
    expect(await livePageVisualSource.acquire({ ...request, signal: controller.signal })).toEqual({ state: "unavailable", issue: { code: "CANCELLED", retryable: false } });
    await page.close();
    expect(await livePageVisualSource.acquire(request)).toEqual({ state: "unavailable", issue: { code: "CAPTURE_FAILED", retryable: false } });
  } finally { await browser.close(); }
});

it("exports a real workbook through the typed exporter and keeps missing coverage explicit", async () => {
  const official: OfficialResult = { meta: { topic: "TOPIC", entry_url: "https://fixture.invalid/", started_at: "2026-10-09T00:00:00Z", finished_at: "2026-10-09T00:00:00Z", elapsed_sec: 0, tool_version: "test" },
    findings: [{ id: "f1", url: "https://fixture.invalid/", is_violation: true, technique: "TRANSPARENT", location: "#ad", evidence_text: "원문 카지노 가입" }] };
  const before = JSON.stringify(official);
  const outcome = await operationalWorkbookExporter.export({ sessions: [{ sessionId: "s1", official }] });
  if (outcome.state !== "available") throw new Error(outcome.issue.code);
  expect(outcome.degradation).toEqual([{ code: "PARTIAL_REPORT", retryable: false }]);
  const book = new ExcelJS.Workbook(); await book.xlsx.load(outcome.value as unknown as ExcelJS.Buffer);
  expect(book.getWorksheet("탐지 상세")?.getRow(2).getCell(4).value).toBe("원문 카지노 가입");
  expect(book.getWorksheet("페이지·점검 범위")?.getRow(2).values).toContain("알 수 없음");
  expect(JSON.stringify(official)).toBe(before);
  expect(await operationalWorkbookExporter.export({ sessions: [] })).toEqual({ state: "unavailable", issue: { code: "REPORT_BOUNDS", retryable: false } });
  const unreadableSession = { sessionId: "s1", official, get reviews(): never { throw new Error("source unavailable"); } };
  expect(await operationalWorkbookExporter.export({ sessions: [unreadableSession] })).toEqual({ state: "unavailable", issue: { code: "REPORT_FAILED", retryable: false } });
});

it("separates a measured dissimilar hash from unavailable or failed comparisons", () => {
  expect(blockHashSimilarity.compare("0".repeat(16), "f".repeat(16))).toEqual({ state: "available", value: { distance: 64, metric: "hamming-64" }, degradation: [] });
  expect(blockHashSimilarity.compare("invalid", "0".repeat(16))).toEqual({ state: "unavailable", issue: { code: "INVALID_INPUT", retryable: false } });
  const print = (hash: string): CreativeFingerprint => ({ sha256: "a".repeat(64), perceptualHash: hash, width: 8, height: 8, mediaType: "image/png", sourceUrl: "https://fixture.invalid/a", sourceHost: "fixture.invalid" });
  const issues: AdapterIssue[] = [];
  expect(groupSimilarCreatives([print("0".repeat(16)), print("f".repeat(16))], 5, { onIssue: issue => issues.push(issue) })).toEqual([]);
  expect(issues).toEqual([]);
  expect(groupSimilarCreatives([print("0".repeat(16)), print("invalid")], 5, { onIssue: issue => issues.push(issue) })).toEqual([]);
  expect(issues).toEqual([{ code: "INVALID_INPUT", retryable: false }]);
  expect(groupSimilarCreatives([print("0".repeat(16)), print("0".repeat(16))], 5, { provider: { ...blockHashSimilarity, compare() { throw new Error("failed"); } }, onIssue: issue => issues.push(issue) })).toEqual([]);
  expect(issues.at(-1)).toEqual({ code: "SIMILARITY_FAILED", retryable: false });
});
