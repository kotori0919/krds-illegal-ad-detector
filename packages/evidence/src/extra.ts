/**
 * Extra-result engine (GOAL Phase 17): result_extra.json.
 *
 * Only proven detectors feed extras. This slice ships two:
 * - REUSED_AD_CREATIVE: perceptual-hash creative family seen >= 2 times.
 * - AD_INFRASTRUCTURE_CORRELATION: domain referenced >= 2 times in the graph.
 * - ZERO_WIDTH_OBFUSCATION: zero-width chars (U+200B-U+200D, U+FEFF) inside
 *   ad-semantic text — extended intelligence, never an official technique.
 *
 * Serialized per the competition extra convention: technique "ETC" +
 * project extra_finding. Validated separately from result.json.
 */
import {
  TOOL_VERSION,
  validateExtraResult,
  type ExtraFinding,
  type ExtraResult,
} from "@krds-detector/contracts";
import { groupSimilarCreatives, type CreativeFingerprint } from "./fingerprint.js";
import { summarizeCorrelatedInfrastructure, type EvidenceGraph } from "./graph.js";

export const EXTRA_FINDING_TYPES = [
  "REUSED_AD_CREATIVE",
  "AD_INFRASTRUCTURE_CORRELATION",
  "ZERO_WIDTH_OBFUSCATION",
] as const;

export type ExtraFindingType = (typeof EXTRA_FINDING_TYPES)[number];

const ZERO_WIDTH_RE = /[\u200B-\u200D\uFEFF]/;

export function zeroWidthSignals(text: string): boolean {
  return ZERO_WIDTH_RE.test(text);
}

export interface ExtraBuildInput {
  topic: string;
  entryUrl: string;
  startedAt: string;
  finishedAt: string;
  creatives: CreativeFingerprint[];
  graph: EvidenceGraph;
  zeroWidthCases: { url: string; location: string; evidenceText: string }[];
}

export function buildExtraResult(input: ExtraBuildInput): ExtraResult {
  const findings: ExtraFinding[] = [];
  let n = 0;
  const nextId = (): string => {
    n += 1;
    return `x${String(n)}`;
  };
  for (const group of groupSimilarCreatives(input.creatives)) {
    const first = group[0];
    if (!first) continue;
    findings.push({
      id: nextId(),
      url: first.sourceUrl,
      is_violation: true,
      location: first.sourceUrl,
      evidence_text: `recurring advertisement creative: perceptual hash ${first.perceptualHash} seen ${String(group.length)} times`,
      technique: "ETC",
      extra_finding: "REUSED_AD_CREATIVE",
    });
  }
  for (const summary of summarizeCorrelatedInfrastructure(input.graph, [new URL(input.entryUrl).host])) {
    findings.push({
      id: nextId(),
      url: input.entryUrl,
      is_violation: true,
      location: input.entryUrl,
      evidence_text: summary,
      technique: "ETC",
      extra_finding: "AD_INFRASTRUCTURE_CORRELATION",
    });
  }
  for (const z of input.zeroWidthCases) {
    if (!zeroWidthSignals(z.evidenceText)) continue;
    findings.push({
      id: nextId(),
      url: z.url,
      is_violation: true,
      location: z.location,
      evidence_text: z.evidenceText,
      technique: "ETC",
      extra_finding: "ZERO_WIDTH_OBFUSCATION",
    });
  }
  const result: ExtraResult = {
    meta: {
      topic: input.topic,
      entry_url: input.entryUrl,
      started_at: input.startedAt,
      finished_at: input.finishedAt,
      elapsed_sec: Math.max(0, (Date.parse(input.finishedAt) - Date.parse(input.startedAt)) / 1000),
      tool_version: TOOL_VERSION,
    },
    findings,
  };
  const verdict = validateExtraResult(result);
  if (!verdict.ok) throw new Error(`extra result invalid: ${verdict.errors.join("; ")}`);
  return result;
}
