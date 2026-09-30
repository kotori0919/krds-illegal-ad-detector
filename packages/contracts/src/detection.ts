/**
 * Contract v0 (draft): detection evidence vocabulary.
 *
 * Two-axis decision: TechniqueEvidence + IllegalAdvertisementEvidence ->
 * OfficialFinding. Concealment alone never proves an illegal ad.
 */

import type { OfficialTechnique } from "./technique.js";

export type TechniqueEvidenceKind =
  | "homoglyph-signal"
  | "jamo-signal"
  | "transparent-signal"
  | "offscreen-signal";

export interface TechniqueEvidence {
  kind: TechniqueEvidenceKind;
  technique: OfficialTechnique;
  /** Raw source text before any normalization (never a summary). */
  rawText: string;
  /** Normalized/derived form used for matching (kept separate). */
  normalizedText?: string;
  detail: string;
}

export interface IllegalAdEvidence {
  /** Raw source text before any normalization (never a summary). */
  rawText: string;
  normalizedText?: string;
  /** Matched ad / illegal-content vocabulary terms. */
  matchedTerms: string[];
  /** Landing / destination URL where the ad points, if any. */
  destinationUrl?: string;
  detail: string;
}

export interface CandidateEvidence {
  technique: TechniqueEvidence;
  illegalAd: IllegalAdEvidence;
}

export interface DecisionEvidence {
  rule: string;
  score: number;
  threshold: number;
  passed: boolean;
  detail: string;
}
