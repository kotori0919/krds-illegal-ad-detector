import { expect, it } from "vitest";
import { SCAN_POLICY } from "@krds-detector/contracts";
import { CandidateAccumulator } from "../src/candidate-accumulator.js";
import type { DecidedCandidate } from "../src/pipeline.js";

function candidate(index: number, rawText = "카지노 가입"): DecidedCandidate {
  return { url: `https://fixture.invalid/page-${String(index).padStart(3, "0")}`, selector: "#ad", location: "#ad",
    technique: { kind: "transparent-signal", technique: "TRANSPARENT", rawText, detail: "alpha zero" },
    illegalAd: { rawText, matchedTerms: ["카지노", "가입"], detail: "advertisement context" },
    decision: { rule: "fixture", score: 1, threshold: 1, passed: true, detail: "both axes confirmed" },
    observed: { box: { x: 0, y: 0, width: 100, height: 20 }, css: { color: "transparent", backgroundColor: "white", opacity: "1", display: "block", fontSize: "16px", position: "static" } } };
}

it("bounds aggregate raw evidence before retaining whole candidates and identifies excluded pages", () => {
  const raw = `카지노 가입${"가".repeat(30_000)}`;
  const inputs = Array.from({ length: 80 }, (_, index) => candidate(index, raw));
  const selections: string[][] = [];
  for (const ordered of [inputs, [...inputs].reverse()]) {
    const accumulator = new CandidateAccumulator();
    for (const item of ordered) accumulator.offer([item], item.url);
    const coverage = accumulator.coverage();
    selections.push(accumulator.values().map((item) => item.url));
    expect(coverage.retainedEvidenceBytes).toBeLessThanOrEqual(SCAN_POLICY.evidence.retainedBytes);
    expect(coverage.retainedFindings).toBeGreaterThan(0);
    expect(coverage.retainedFindings).toBeLessThan(inputs.length);
    expect(coverage.limitedPages).toContain(inputs.at(-1)!.url);
    for (const item of accumulator.values()) {
      expect(item.technique.rawText).toBe(raw);
      expect(item.illegalAd.rawText).toBe(raw);
      expect(accumulator.contains(item)).toBe(true);
      expect(accumulator.pageOf(item)).toBe(item.url);
    }
  }
  expect(selections[1]).toEqual(selections[0]);
});

it("deduplicates canonical occurrence identity without merging distinct source locations", () => {
  const first = candidate(0, "카지노 가입 나");
  const preferred = candidate(0, "카지노 가입 가");
  const distinct = { ...candidate(0), selector: "#other", location: "#other" };
  for (const ordered of [[first, preferred, distinct], [distinct, preferred, first]]) {
    const accumulator = new CandidateAccumulator();
    accumulator.offer(ordered, first.url);
    expect(accumulator.values().map((item) => [item.location, item.technique.rawText])).toEqual([
      ["#ad", preferred.technique.rawText], ["#other", distinct.technique.rawText],
    ]);
    expect(accumulator.contains(first)).toBe(false);
  }
});
