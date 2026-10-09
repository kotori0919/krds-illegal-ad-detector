/**
 * OCR + decision/VLM adapter contracts (GOAL Phases 14–16).
 *
 * LocalOcrBackend implements candidate-image → text with bundled CPU WASM
 * and Korean/English data. Structured rules add corroborating evidence.
 * The decision model resolves ambiguity only — never the sole detector.
 * The multimodal fallback is disabled by default until benchmarked.
 */
import type { DecisionEvidence } from "@krds-detector/contracts";

export type AdapterIssueCode = "DISABLED" | "INVALID_INPUT" | "BUDGET" | "CANCELLED"
  | "CAPTURE_FAILED" | "PARTIAL_CAPTURE" | "PARTIAL_REPORT" | "REPORT_BOUNDS" | "REPORT_FAILED" | "SIMILARITY_FAILED";
export interface AdapterIssue { code: AdapterIssueCode; retryable: false }
export type AdapterAvailability = { state: "available" } | { state: "unavailable"; issue: AdapterIssue };
/** Available empty/negative observations differ from an unperformed operation. */
export type AdapterOutcome<T> = { state: "available"; value: T; degradation: readonly AdapterIssue[] }
  | { state: "unavailable"; issue: AdapterIssue };
export interface MaintainedAdapter {
  readonly id: string;
  readonly version: number;
  readonly availability: AdapterAvailability;
  readonly limits: Readonly<Record<string, number>>;
  readonly failurePolicy: "return-unavailable-no-retry";
}
/** Input ownership includes live handles, deadline and cancellation, where needed. */
export interface VisualSource<Input, Output> extends MaintainedAdapter {
  acquire(input: Input): Promise<AdapterOutcome<Output>>;
}
export interface ReportExporter<Input> extends MaintainedAdapter {
  readonly mediaType: string;
  readonly extension: string;
  export(input: Input): Promise<AdapterOutcome<Uint8Array>>;
}
/** A derived comparison is never identity, ownership or an official decision. */
export interface SimilarityProvider<Input> extends MaintainedAdapter {
  compare(left: Input, right: Input): AdapterOutcome<{ distance: number; metric: string }>;
}

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
  semanticMatch?: boolean;
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
    if (input.semanticMatch) { score += 1; reasons.push("ad-semantics"); }
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
  judge(crop: OcrCropRequest): Promise<AdapterOutcome<MultimodalVerdict>>;
}

/** Disabled-by-default fallback: refuses until a benchmarked backend plugs in. */
export class DisabledMultimodalFallback implements MultimodalFallback {
  readonly name = "disabled-vlm-v1";
  readonly enabled = false;
  async judge(crop: OcrCropRequest): Promise<AdapterOutcome<MultimodalVerdict>> {
    void crop;
    return { state: "unavailable", issue: { code: "DISABLED", retryable: false } };
  }
}
