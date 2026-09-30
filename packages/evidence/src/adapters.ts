/**
 * OCR + decision/VLM adapter contracts (GOAL Phases 14–16).
 *
 * No OCR backend is bundled in this slice: the interfaces freeze the
 * candidate-crop → text → semantic-evidence pipeline and the structured
 * decision record so a benchmarked backend (CPU, Windows-packaging-feasible,
 * no GPU, Korean ad-text quality) can plug in without reshaping callers.
 * The decision model resolves ambiguity only — never the sole detector.
 * The multimodal fallback is disabled by default until benchmarked.
 */
import type { DecisionEvidence } from "@krds-detector/contracts";

export interface OcrCropRequest {
  /** Source identifier (element selector, creative URL, or crop id). */
  sourceId: string;
  /** PNG/JPEG bytes of the candidate crop (never a full page). */
  imageBytes: Uint8Array;
  width: number;
  height: number;
  mediaType: string;
}

export interface OcrResult {
  sourceId: string;
  text: string;
  confidence: number;
  backend: string;
}

export interface OcrBackend {
  readonly name: string;
  /** CPU-only OCR over a single candidate crop. */
  recognize(crop: OcrCropRequest): Promise<OcrResult>;
}

export interface DecisionInput {
  rawText: string;
  normalizedText?: string;
  ocrText?: string;
  technique: string;
  destinationUrl?: string;
  infrastructureRefs: number;
  creativeSimilarity: number;
}

export interface DecisionModel {
  readonly name: string;
  resolveAmbiguity(input: DecisionInput): DecisionEvidence;
}

/** Deterministic structured fallback: threshold on corroborating axes. */
export class RuleDecisionModel implements DecisionModel {
  readonly name = "rule-structured-v1";
  resolveAmbiguity(input: DecisionInput): DecisionEvidence {
    let score = 0;
    const reasons: string[] = [];
    if (input.rawText.trim().length > 0) {
      score += 1;
      reasons.push("has-text");
    }
    if (input.ocrText && input.ocrText.trim().length > 0) {
      score += 1;
      reasons.push("ocr-corroborates");
    }
    if (input.destinationUrl) {
      score += 1;
      reasons.push("has-destination");
    }
    if (input.infrastructureRefs >= 2) {
      score += 1;
      reasons.push("correlated-infrastructure");
    }
    if (input.creativeSimilarity <= 5 && input.creativeSimilarity >= 0 && input.ocrText) {
      score += 1;
      reasons.push("creative-family");
    }
    const threshold = 2;
    return {
      rule: this.name,
      score,
      threshold,
      passed: score >= threshold,
      detail: `${input.technique}: ${reasons.join(",") || "no corroboration"}`,
    };
  }
}

export interface MultimodalVerdict {
  isAd: boolean;
  confidence: number;
  rationale: string;
}

export interface MultimodalFallback {
  readonly name: string;
  readonly enabled: boolean;
  /** Aggressively gated: ambiguous visual candidates only, never per element. */
  judge(crop: OcrCropRequest): Promise<MultimodalVerdict>;
}

/** Disabled-by-default fallback: refuses until a benchmarked backend plugs in. */
export class DisabledMultimodalFallback implements MultimodalFallback {
  readonly name = "disabled-vlm-v1";
  readonly enabled = false;
  async judge(crop: OcrCropRequest): Promise<MultimodalVerdict> {
    void crop;
    return { isAd: false, confidence: 0, rationale: "multimodal fallback disabled by default (unbenchmarked)" };
  }
}
