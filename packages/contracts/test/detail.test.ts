import { expect, it } from "vitest";
import { validateScanDetailBundle, type ScanDetailBundle, type OfficialResult, type ExtraResult } from "../src/index.js";

const result: OfficialResult = { meta: { topic: "TOPIC", entry_url: "https://example.kr/",
  started_at: "2026-10-07T00:00:00Z", finished_at: "2026-10-07T00:00:01Z", elapsed_sec: 1, tool_version: "0.1.0" }, findings: [] };
const extra: ExtraResult = { meta: result.meta, findings: [] };
function bundle(): ScanDetailBundle {
  return { version: 2, findings: [], creativeImages: [],
    coverage: { checkedPages: 1, failedPages: [], timedOut: false },
    pageOutcomes: [{ url: result.meta.entry_url, finalUrl: result.meta.entry_url, status: 200, depth: 0, outcome: "checked" }],
    imageAnalysis: [{ sourceUrl: "https://example.kr/ad.png", pageUrls: [result.meta.entry_url],
      ocr: { state: "available", backend: "cpu", text: "카지노 가입", confidence: 0.96 }, matchedTerms: ["카지노"],
      normalizedText: "카지노가입", decision: { rule: "structured", score: 2, threshold: 2, passed: true, detail: "ad semantics and image text" } }] };
}

it("rejects page outcomes that overstate successfully checked coverage", () => {
  const data = bundle();
  data.pageOutcomes![0]!.status = 404;
  expect(validateScanDetailBundle(data, result, extra).ok).toBe(false);
  data.pageOutcomes![0]!.outcome = "failed";
  expect(validateScanDetailBundle(data, result, extra).ok).toBe(false);
  data.coverage = { checkedPages: 0, failedPages: [{ url: result.meta.entry_url, status: 404, reason: "HTTP 404" }], timedOut: false };
  expect(validateScanDetailBundle(data, result, extra).ok).toBe(true);
});

it("rejects invalid OCR confidence and inconsistent structured decisions", () => {
  const data = bundle();
  const recognition = data.imageAnalysis![0]!.ocr;
  if (recognition.state !== "available") throw new Error("fixture recognition unavailable");
  for (const invalid of [Number.NaN, -0.1, 1.1]) {
    recognition.confidence = invalid;
    expect(validateScanDetailBundle(data, result, extra).ok).toBe(false);
  }
  recognition.confidence = 0.96;
  data.imageAnalysis![0]!.decision.passed = false;
  expect(validateScanDetailBundle(data, result, extra).ok).toBe(false);
  data.imageAnalysis![0]!.decision.passed = true;
  expect(validateScanDetailBundle(data, result, extra).ok).toBe(true);
});
