import { expect, it } from "vitest";
import { demoMarkerContribution } from "./demo-contribution.js";
it("demonstrates a harmless, non-production contribution with exact marker attribution", () => {
  const input = { url: "https://example.test/", location: "#note", evidenceText: "operator [DEMO] note", semanticAdContext: false };
  const result = demoMarkerContribution.evaluate(input);
  expect(result.state).toBe("matched");
  if (result.state !== "matched") throw new Error("expected demo marker");
  expect(result.finding.is_violation).toBe(false);
  expect(input.evidenceText.slice(result.spans[0]!.start, result.spans[0]!.end)).toBe("[DEMO]");
  expect(demoMarkerContribution.evaluate({ ...input, evidenceText: "ordinary note" })).toEqual({ state: "excluded", reason: "NO_DEMO_MARKER" });
});
