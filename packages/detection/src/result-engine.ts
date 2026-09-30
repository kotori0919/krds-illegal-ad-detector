/**
 * Result engine (GOAL Phase 10): candidates → validated OfficialResult.
 *
 * - Dedups by identity url + location + technique (KODEX §6).
 * - Assigns stable finding ids (f1, f2, … in first-seen order).
 * - Serializes BOM-free UTF-8 JSON; validates via the frozen contract
 *   validator. Any validation failure throws — release blocked.
 */
import {
  findingIdentityKey,
  serializeOfficialResult,
  TOOL_VERSION,
  validateOfficialResult,
  type OfficialFinding,
  type OfficialResult,
} from "@krds-detector/contracts";
import type { DecidedCandidate } from "./pipeline.js";

export interface ResultMetaInput {
  topic: string;
  entryUrl: string;
  startedAt: string;
  finishedAt: string;
}

function elapsedSec(startedAt: string, finishedAt: string): number {
  return Math.max(0, (Date.parse(finishedAt) - Date.parse(startedAt)) / 1000);
}

export function buildOfficialResult(
  meta: ResultMetaInput,
  candidates: DecidedCandidate[],
): OfficialResult {
  const seen = new Set<string>();
  const findings: OfficialFinding[] = [];
  let n = 0;
  for (const c of candidates) {
    const key = findingIdentityKey({ url: c.url, location: c.location, technique: c.technique.technique });
    if (seen.has(key)) continue;
    seen.add(key);
    n += 1;
    findings.push({
      id: `f${String(n)}`,
      url: c.url,
      is_violation: true,
      location: c.location,
      evidence_text: c.technique.rawText,
      technique: c.technique.technique,
    });
  }
  const result: OfficialResult = {
    meta: {
      topic: meta.topic,
      entry_url: meta.entryUrl,
      started_at: meta.startedAt,
      finished_at: meta.finishedAt,
      elapsed_sec: elapsedSec(meta.startedAt, meta.finishedAt),
      tool_version: TOOL_VERSION,
    },
    findings,
  };
  const verdict = validateOfficialResult(result);
  if (!verdict.ok) {
    throw new Error(`result validation failed: ${verdict.errors.join("; ")}`);
  }
  return result;
}

/** Serialize + re-validate the exact bytes (BOM/JSON gate). */
export function serializeValidatedResult(result: OfficialResult): string {
  const text = serializeOfficialResult(result);
  const parsed: unknown = JSON.parse(text);
  const verdict = validateOfficialResult(parsed);
  if (!verdict.ok) {
    throw new Error(`serialized result invalid: ${verdict.errors.join("; ")}`);
  }
  if (text.charCodeAt(0) === 0xfeff) throw new Error("serializer emitted a BOM");
  return text;
}
