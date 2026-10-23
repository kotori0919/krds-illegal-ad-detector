import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { validateScanDetailBundle, type ExtraResult, type OfficialResult, type ScanDetailBundle } from "../src/index.js";

const corpus = JSON.parse(readFileSync(new URL("./fixtures/detail-policy-conformance.json", import.meta.url), "utf8")) as {
  valid: Record<string, unknown>; invalid: { name: string; path: (string | number)[]; value: unknown }[];
};
function check(value: Record<string, unknown>): boolean {
  const official: OfficialResult = { meta: { topic: "TOPIC", entry_url: "https://example.kr/", started_at: "2026-10-09T00:00:00Z",
    finished_at: "2026-10-09T00:00:01Z", elapsed_sec: 1, tool_version: "0.2.0-policy2" }, findings: [{ id: "f1", url: "https://example.kr/",
    location: "#ad", is_violation: true, technique: "HOMOGLYPH", evidence_text: value.rawText as string }] };
  const extra: ExtraResult = { meta: official.meta, findings: [] };
  const detail = { version: 2, findings: [{ findingId: "f1", url: "https://example.kr/", location: "#ad", technique: "HOMOGLYPH",
    rawText: value.rawText, normalizedText: "casino가입", matchedTerms: ["casino"], techniqueReason: "width", textPolicy: value.textPolicy,
    observed: { renderingIssues: value.renderingIssues }, visual: { state: "unavailable", reason: "budget" } }],
    coverage: { checkedPages: 0, failedPages: [], timedOut: false }, creativeImages: [], timing: value.timing } as unknown as ScanDetailBundle;
  return validateScanDetailBundle(detail, official, extra).ok;
}

it("shares UTF16 source/span, rendering uncertainty and timing boundaries with the native validator", () => {
  expect(check(corpus.valid)).toBe(true);
  for (const sample of corpus.invalid) {
    const value = structuredClone(corpus.valid);
    let target: Record<string | number, unknown> = value;
    for (const key of sample.path.slice(0, -1)) target = target[key] as Record<string | number, unknown>;
    target[sample.path.at(-1)!] = sample.value;
    expect(check(value), sample.name).toBe(false);
  }
});

it("rejects oversized optional evidence without changing the original record", () => {
  for (const changes of [{ analysisText: "x".repeat(32769) }, { sourceMapping: Array(10001).fill({ analysisStart: 0, sourceStart: 0, length: 1 }) },
    { matches: Array(32769).fill({ term: "casino", start: 2, end: 8, raw: "ＣＡＳＩＮＯ", transforms: [] }) }]) {
    const value = structuredClone(corpus.valid);Object.assign(value.textPolicy as object, changes);expect(check(value)).toBe(false);
  }
  const value = structuredClone(corpus.valid);value.renderingIssues = Array(33).fill("unsupported");expect(check(value)).toBe(false);
});
