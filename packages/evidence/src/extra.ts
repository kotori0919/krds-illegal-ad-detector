/**
 * Extra-result engine (GOAL Phase 17): result_extra.json.
 *
 * Only proven detectors feed extras:
 * - REUSED_AD_CREATIVE: perceptual-hash creative family seen >= 2 times.
 * - AD_INFRASTRUCTURE_CORRELATION: exact advertisement witnesses on >= 2 pages.
 * - IMAGE_ONLY_ILLEGAL_AD: caller-approved OCR, semantics and corroboration,
 *   without equivalent visible DOM advertisement text.
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
import { zeroWidthContribution, type ContributionIssue } from "./contributions.js";
export { zeroWidthSignals } from "./contributions.js";

export interface ExtraBuildInput {
  topic: string;
  entryUrl: string;
  startedAt: string;
  finishedAt: string;
  creatives: CreativeFingerprint[];
  graph: EvidenceGraph;
  zeroWidthCases: { url: string; location: string; evidenceText: string }[];
  /** Detection owns semantic, corroboration and visible-DOM exclusion gates. */
  imageOnlyCases?: { url: string; location: string; evidenceText: string }[];
  /** The caller may record typed degradation without changing official JSON. */
  onIssue?: (issue: ContributionIssue) => void;
}

export function buildExtraResult(input: ExtraBuildInput): ExtraResult {
  const findings: ExtraFinding[] = [];
  let n = 0;
  const nextId = (): string => {
    n += 1;
    return `x${String(n)}`;
  };
  const imageCases = new Map((input.imageOnlyCases ?? []).map((image) => [
    `${image.url}\0${image.location}\0${image.evidenceText}`, image,
  ]));
  for (const [, image] of [...imageCases].sort(([a], [b]) => a.localeCompare(b))) {
    findings.push({ id: nextId(), url: image.url, location: image.location,
      is_violation: true, evidence_text: image.evidenceText,
      technique: "ETC", extra_finding: "IMAGE_ONLY_ILLEGAL_AD" });
  }
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
  const observedEntry = input.graph.nodes.find((node) => node.kind === "Page")?.url ?? input.entryUrl;
  let entryHost = "";
  try { entryHost = new URL(observedEntry).host; } catch { /* relative fixture entry */ }
  for (const summary of summarizeCorrelatedInfrastructure(input.graph, entryHost ? [entryHost] : [])) {
    findings.push({
      id: nextId(),
      url: observedEntry,
      is_violation: true,
      location: observedEntry,
      evidence_text: summary,
      technique: "ETC",
      extra_finding: "AD_INFRASTRUCTURE_CORRELATION",
    });
  }
  for (const z of input.zeroWidthCases) {
    const outcome = zeroWidthContribution.evaluate({ ...z, semanticAdContext: true });
    if (outcome.state === "unavailable") {
      if (!input.onIssue) throw new Error(`${outcome.issue.code}: ${outcome.issue.scope}`);
      input.onIssue(outcome.issue);
    } else if (outcome.state === "matched") {
      findings.push({ id: nextId(), technique: "ETC", ...outcome.finding });
    }
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
