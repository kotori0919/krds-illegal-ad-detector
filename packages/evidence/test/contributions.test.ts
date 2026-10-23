import { describe, expect, it } from "vitest";
import { zeroWidthContribution } from "../src/contributions.js";
import { buildExtraResult } from "../src/extra.js";
import { buildEvidenceGraph } from "../src/graph.js";

describe("maintained extra detector contribution", () => {
  const observation = { url: "https://example.test/", location: "#offer", evidenceText: "카\u200B지노 신규가입", semanticAdContext: true };
  it("attributes actual original characters and preserves caller-owned semantic rejection", () => {
    const matched = zeroWidthContribution.evaluate(observation);
    expect(matched.state).toBe("matched");
    if (matched.state !== "matched") throw new Error("expected match");
    expect(matched.finding.evidence_text).toBe(observation.evidenceText);
    expect(matched.spans.map(span => observation.evidenceText.slice(span.start, span.end))).toEqual(["\u200B"]);
    expect(zeroWidthContribution.evaluate({ ...observation, semanticAdContext: false })).toEqual({ state: "excluded", reason: "NO_AD_CONTEXT" });
    expect(zeroWidthContribution.evaluate({ ...observation, evidenceText: "일반 문장" })).toEqual({ state: "excluded", reason: "NO_ZERO_WIDTH" });
  });
  it("executes the contribution through the actual extra serializer, leaving official techniques closed", () => {
    const extra = buildExtraResult({ topic: "TOPIC", entryUrl: observation.url, startedAt: "2026-10-09T00:00:00Z", finishedAt: "2026-10-09T00:00:01Z",
      creatives: [], graph: buildEvidenceGraph([]), zeroWidthCases: [observation] });
    expect(extra.findings).toEqual([{ id: "x1", url: observation.url, location: observation.location,
      is_violation: true, evidence_text: observation.evidenceText, technique: "ETC", extra_finding: "ZERO_WIDTH_OBFUSCATION" }]);
  });
  it("reports unsupported size as an explicit issue without claiming a negative", () => {
    expect(zeroWidthContribution.evaluate({ ...observation, evidenceText: "카".repeat(65_537) })).toEqual({ state: "unavailable",
      issue: { code: "EXTRA_TEXT_LIMIT", scope: "zero-width", retryable: false } });
  });
});
