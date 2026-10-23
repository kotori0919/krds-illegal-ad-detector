import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { serializeOfficialResult, type OfficialResult } from "@krds-detector/contracts";
import { groupReviewPatterns } from "../src/review-patterns.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/sample_result_617_sanitized.json", import.meta.url), "utf8")) as OfficialResult;
describe("operator patterns preserve original occurrences", () => {
  it("reduces the real 617 records to conservative patterns with separate page counts", () => {
    const before = serializeOfficialResult(fixture);
    const groups = groupReviewPatterns(fixture.findings);
    expect(groups).toHaveLength(19);
    expect(groups.flatMap((group) => group.findings).map((f) => f.id).sort()).toEqual(fixture.findings.map((f) => f.id).sort());
    expect(new Set(groups.flatMap((group) => group.pageUrls)).size).toBe(211);
    const repeated = groups.find((group) => group.findings.length === 197)!;
    expect(repeated.pageUrls).toHaveLength(197);
    expect(repeated.destination).toBe("https://sample.invalid/game/baccarat");
    expect(groups.find((group) => group.technique === "JAMO")?.findings.map((f) => f.id)).toEqual(["f372"]);
    expect(serializeOfficialResult(fixture)).toBe(before);
    expect(groupReviewPatterns([...fixture.findings].reverse())).toEqual(groups);
  });
  it("separates destinations, selector context, frame context and sites even with identical wording", () => {
    const f = fixture.findings[0]!;
    const findings = [f, { ...f, id: "other-page", url: "https://sample.invalid/another" },
      { ...f, id: "other-destination", location: f.location.replace("/game/baccarat", "/different") },
      { ...f, id: "other-context", location: `nav > ${f.location}` },
      { ...f, id: "other-frame", location: `iframe[src='/frame'] >>> ${f.location}` },
      { ...f, id: "other-site", url: "https://another.invalid/" }];
    const groups = groupReviewPatterns(findings);
    expect(groups).toHaveLength(5);
    const repeated = groups.find((g) => g.findings.length === 2)!;
    expect(repeated.pageUrls).toHaveLength(2);
    const samePage = groupReviewPatterns([f, { ...f, id: "same-page", evidence_text: `\n ${f.evidence_text} \n` }]);
    expect(samePage[0]?.findings).toHaveLength(2);
    expect(samePage[0]?.pageUrls).toHaveLength(1);
  });
});
