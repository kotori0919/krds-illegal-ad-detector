/**
 * Result engine (GOAL Phase 10): candidates → validated OfficialResult.
 *
 * - Dedups by identity url + location + technique (KODEX §6).
 * - Assigns stable finding ids after canonical deduplication and sorting.
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
import { normalizeUrlKey } from "@krds-detector/scanner";
import type { DecidedCandidate } from "./pipeline.js";

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

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
  const seen = new Map<string, DecidedCandidate>();
  const findings: OfficialFinding[] = [];
  for (const c of candidates) {
    const key = findingIdentityKey({ url: c.url, location: c.location, technique: c.technique.technique });
    const previous = seen.get(key);
    // Dynamic DOM can yield more than one text for the same official identity.
    // Pick a stable representative rather than the first worker to finish.
    if (!previous || compare(c.technique.rawText, previous.technique.rawText) < 0) seen.set(key, c);
  }
  const ordered = [...seen.values()].sort((a, b) => {
    return compare(normalizeUrlKey(a.url), normalizeUrlKey(b.url))
      || compare(a.location, b.location)
      || compare(a.technique.technique, b.technique.technique)
      || compare(a.technique.rawText, b.technique.rawText);
  });
  for (const [index, c] of ordered.entries()) {
    findings.push({
      id: `f${String(index + 1)}`,
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
