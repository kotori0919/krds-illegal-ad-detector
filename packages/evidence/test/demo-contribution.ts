import type { ExtraDetectorContribution } from "../src/contributions.js";

/** Compile-only authoring example; not imported by production registration. */
export const demoMarkerContribution: ExtraDetectorContribution = {
  id: "demo-marker", version: 1, extraType: "DEMO_MARKER",
  observations: ["raw-text", "semantic-ad-context"], reasonCodes: ["DEMO_MARKER_SEEN"],
  limits: { maxTextCodeUnits: 1000, maxSpans: 1 }, fixtures: ["packages/evidence/test/demo-contribution.test.ts"],
  evaluate(input) {
    if (input.evidenceText.length > this.limits.maxTextCodeUnits) return { state: "unavailable",
      issue: { code: "DEMO_TEXT_LIMIT", scope: this.id, retryable: false } };
    const start = input.evidenceText.indexOf("[DEMO]");
    if (start < 0) return { state: "excluded", reason: "NO_DEMO_MARKER" };
    return { state: "matched", finding: { url: input.url, location: input.location, evidence_text: input.evidenceText,
      is_violation: false, extra_finding: this.extraType }, reasons: this.reasonCodes, spans: [{ start, end: start + 6 }] };
  },
};
