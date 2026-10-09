import type { ExtraFinding } from "@krds-detector/contracts";

export interface ExtraObservation {
  readonly url: string;
  readonly location: string;
  readonly evidenceText: string;
  /** Owned by detection policy; a text marker alone is not an advertisement. */
  readonly semanticAdContext: boolean;
}
export interface ContributionIssue {
  code: string;
  scope: string;
  retryable: boolean;
}
export type ExtraContributionResult =
  | { state: "matched"; finding: Omit<ExtraFinding, "id" | "technique">; reasons: readonly string[]; spans: readonly { start: number; end: number }[] }
  | { state: "excluded"; reason: string }
  | { state: "unavailable"; issue: ContributionIssue };

/** Maintained, synchronous in-process code. No downloads, dynamic loading or I/O. */
export interface ExtraDetectorContribution {
  readonly id: string;
  readonly version: number;
  readonly extraType: string;
  readonly observations: readonly ["raw-text", "semantic-ad-context"];
  readonly reasonCodes: readonly string[];
  readonly limits: { maxTextCodeUnits: number; maxSpans: number };
  readonly fixtures: readonly string[];
  evaluate(input: ExtraObservation): ExtraContributionResult;
}

const ZERO_WIDTH_RE = /[\u200B-\u200D\uFEFF]/;
export function zeroWidthSignals(text: string): boolean { return ZERO_WIDTH_RE.test(text); }

export const zeroWidthContribution: ExtraDetectorContribution = {
  id: "zero-width", version: 1, extraType: "ZERO_WIDTH_OBFUSCATION",
  observations: ["raw-text", "semantic-ad-context"],
  reasonCodes: ["ZERO_WIDTH_IN_AD_TEXT", "SEMANTIC_AD_CONTEXT_FROM_CALLER"],
  limits: { maxTextCodeUnits: 65_536, maxSpans: 256 },
  fixtures: ["packages/evidence/test/contributions.test.ts"],
  evaluate(input) {
    if (!input.semanticAdContext) return { state: "excluded", reason: "NO_AD_CONTEXT" };
    if (input.evidenceText.length > this.limits.maxTextCodeUnits) return { state: "unavailable",
      issue: { code: "EXTRA_TEXT_LIMIT", scope: this.id, retryable: false } };
    const spans: { start: number; end: number }[] = [];
    for (const match of input.evidenceText.matchAll(/[\u200B-\u200D\uFEFF]/g)) {
      if (spans.length >= this.limits.maxSpans) break;
      spans.push({ start: match.index, end: match.index + match[0].length });
    }
    if (!spans.length) return { state: "excluded", reason: "NO_ZERO_WIDTH" };
    return { state: "matched", finding: { url: input.url, location: input.location,
      evidence_text: input.evidenceText, is_violation: true, extra_finding: this.extraType },
      reasons: this.reasonCodes, spans };
  },
};
