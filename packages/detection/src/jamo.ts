/** JAMO requires a composed, vowel-bearing advertisement term with source alignment. */
import { AD_TERMS } from "./semantic.js";
import type { AlignedTechniqueEvidence } from "./homoglyph.js";
import { findTextMatches, restoreText, techniqueMatches, type TextRepresentation } from "./text-policy.js";

export function jamoSignal(rawText: string, representation: TextRepresentation = restoreText(rawText), matches = findTextMatches(representation, AD_TERMS)): AlignedTechniqueEvidence | undefined {
  const spans = techniqueMatches(representation, matches, "JAMO");
  if (!spans.length) return undefined;
  return { kind: "jamo-signal", technique: "JAMO", rawText,
    normalizedText: representation.matchText, policyVersion: representation.version, sourceSpans: spans,
    detail: `${representation.version}: Jamo reconstruction ${spans.map((span) => `${span.term}@${span.start}:${span.end}`).join("; ")}` };
}
