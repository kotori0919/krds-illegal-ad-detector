/** HOMOGLYPH requires a transformed advertisement span, not a script anywhere. */
import type { TechniqueEvidence } from "@krds-detector/contracts";
import { AD_TERMS } from "./semantic.js";
import { findTextMatches, restoreText, techniqueMatches, type TextMatch, type TextRepresentation } from "./text-policy.js";

export interface AlignedTechniqueEvidence extends TechniqueEvidence {
  sourceSpans: TextMatch[];
  policyVersion: string;
}

export function homoglyphSignal(rawText: string, representation: TextRepresentation = restoreText(rawText), matches = findTextMatches(representation, AD_TERMS)): AlignedTechniqueEvidence | undefined {
  const spans = techniqueMatches(representation, matches, "HOMOGLYPH");
  if (!spans.length) return undefined;
  return { kind: "homoglyph-signal", technique: "HOMOGLYPH", rawText,
    normalizedText: representation.matchText, policyVersion: representation.version, sourceSpans: spans,
    detail: `${representation.version}: transformed advertisement span ${spans.map((span) => `${span.term}@${span.start}:${span.end} [${span.transforms.join(",")}]`).join("; ")}` };
}
