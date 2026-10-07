/**
 * Contract v0 (frozen 2026-10-01): official + extra result shapes.
 *
 * Identity rule: one finding per (url, location, technique). One element
 * carrying two official techniques emits two findings; several strings with
 * the same technique on one element collapse to one finding.
 */

import { EXTRA_TECHNIQUE, type OfficialTechnique } from "./technique.js";

export const TOOL_VERSION = "0.1.0";
export const EXTRA_FINDING_TYPES = ["IMAGE_ONLY_ILLEGAL_AD", "REUSED_AD_CREATIVE",
  "AD_INFRASTRUCTURE_CORRELATION", "ZERO_WIDTH_OBFUSCATION"] as const;

export interface OfficialMeta {
  topic: string;
  entry_url: string;
  started_at: string;
  finished_at: string;
  elapsed_sec: number;
  tool_version: string;
}

export interface OfficialFinding {
  id: string;
  url: string;
  is_violation: boolean;
  location: string;
  evidence_text: string;
  technique: OfficialTechnique;
}

export interface OfficialResult {
  meta: OfficialMeta;
  findings: OfficialFinding[];
}

/** Short alias: an official result.json entry. */
export type Finding = OfficialFinding;

/**
 * Extended intelligence finding. Serialized per the competition extra-result
 * convention: technique is always "ETC"; the project-defined detector kind
 * goes in `extra_finding`.
 */
export interface ExtraFinding {
  id: string;
  url: string;
  is_violation: boolean;
  location: string;
  evidence_text: string;
  technique: typeof EXTRA_TECHNIQUE;
  extra_finding: string;
}

export interface ExtraResult {
  meta: OfficialMeta;
  findings: ExtraFinding[];
}

/** Canonical dedup key: url + location + technique. */
export function findingIdentityKey(finding: {
  url: string;
  location: string;
  technique: string;
}): string {
  return `${finding.url}\u0000${finding.location}\u0000${finding.technique}`;
}

export interface ValidationOutcome {
  ok: boolean;
  errors: string[];
}

interface LooseMeta {
  topic?: unknown;
  entry_url?: unknown;
  started_at?: unknown;
  finished_at?: unknown;
  elapsed_sec?: unknown;
  tool_version?: unknown;
}

function validateMetaShape(meta: unknown): string[] {
  const errors: string[] = [];
  if (typeof meta !== "object" || meta === null || Array.isArray(meta)) {
    return ["meta must be an object"];
  }
  const m = meta as LooseMeta;
  if (m.topic === undefined) errors.push("meta.topic is required");
  if (m.entry_url === undefined) errors.push("meta.entry_url is required");
  if (m.started_at === undefined) errors.push("meta.started_at is required");
  if (m.finished_at === undefined) errors.push("meta.finished_at is required");
  if (m.elapsed_sec === undefined) errors.push("meta.elapsed_sec is required");
  if (m.tool_version === undefined) errors.push("meta.tool_version is required");
  if (m.entry_url !== undefined && typeof m.entry_url !== "string") {
    errors.push("meta.entry_url must be a string");
  }
  if (m.elapsed_sec !== undefined && typeof m.elapsed_sec !== "number") {
    errors.push("meta.elapsed_sec must be a number");
  }
  if (
    m.started_at !== undefined &&
    (typeof m.started_at !== "string" || Number.isNaN(Date.parse(m.started_at)))
  ) {
    errors.push("meta.started_at must be an ISO-8601 datetime string");
  }
  if (
    m.finished_at !== undefined &&
    (typeof m.finished_at !== "string" ||
      Number.isNaN(Date.parse(m.finished_at)))
  ) {
    errors.push("meta.finished_at must be an ISO-8601 datetime string");
  }
  return errors;
}

interface LooseFinding {
  id?: unknown;
  url?: unknown;
  is_violation?: unknown;
  location?: unknown;
  evidence_text?: unknown;
  technique?: unknown;
}

/**
 * Validate a parsed result.json value. Pure structural check; selector
 * uniqueness / round-trip validation happens at emission time (Phase 4/10).
 */
export function validateOfficialResult(value: unknown): ValidationOutcome {
  const errors: string[] = [];
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, errors: ["root must be an object"] };
  }
  const root = value as { meta?: unknown; findings?: unknown };
  errors.push(...validateMetaShape(root.meta));
  if (!Array.isArray(root.findings)) {
    errors.push("findings must be an array");
    return { ok: false, errors };
  }
  const seen = new Set<string>();
  const ids = new Set<string>();
  for (const [index, item] of root.findings.entries()) {
    const where = `findings[${index}]`;
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      errors.push(`${where} must be an object`);
      continue;
    }
    const f = item as LooseFinding;
    if (f.id === undefined) errors.push(`${where}.id is required`);
    if (f.url === undefined) errors.push(`${where}.url is required`);
    if (f.is_violation === undefined)
      errors.push(`${where}.is_violation is required`);
    if (f.location === undefined) errors.push(`${where}.location is required`);
    if (f.evidence_text === undefined)
      errors.push(`${where}.evidence_text is required`);
    if (f.technique === undefined) errors.push(`${where}.technique is required`);
    if (typeof f.id === "string") {
      if (ids.has(f.id)) errors.push(`${where}.id is duplicated`);
      ids.add(f.id);
    } else if (f.id !== undefined) {
      errors.push(`${where}.id must be a string`);
    }
    if (f.is_violation !== undefined && typeof f.is_violation !== "boolean") {
      errors.push(`${where}.is_violation must be a boolean`);
    }
    if (f.location !== undefined && typeof f.location !== "string") {
      errors.push(`${where}.location must be a string`);
    }
    if (f.evidence_text !== undefined && typeof f.evidence_text !== "string") {
      errors.push(`${where}.evidence_text must be a string`);
    }
    if (f.technique !== undefined) {
      if (
        f.technique !== "HOMOGLYPH" &&
        f.technique !== "JAMO" &&
        f.technique !== "TRANSPARENT" &&
        f.technique !== "OFFSCREEN"
      ) {
        errors.push(
          `${where}.technique must be one of HOMOGLYPH, JAMO, TRANSPARENT, OFFSCREEN`,
        );
      }
    }
    if (
      typeof f.url === "string" &&
      typeof f.location === "string" &&
      typeof f.technique === "string"
    ) {
      const key = findingIdentityKey({
        url: f.url,
        location: f.location,
        technique: f.technique,
      });
      if (seen.has(key))
        errors.push(`${where} duplicates url+location+technique`);
      seen.add(key);
    }
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Validate raw file text: rejects BOM, rejects invalid JSON, then validates
 * the parsed official shape.
 */
export function validateOfficialResultText(text: string): ValidationOutcome {
  if (text.charCodeAt(0) === 0xfeff) {
    return { ok: false, errors: ["result.json must not contain a BOM"] };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, errors: ["result.json must be valid JSON"] };
  }
  return validateOfficialResult(parsed);
}

/** Serialize without BOM; JSON.stringify never emits one — enforced by test. */
export function serializeOfficialResult(result: OfficialResult): string {
  return `${JSON.stringify(result, null, 2)}\n`;
}

export function validateExtraResult(value: unknown): ValidationOutcome {
  const errors: string[] = [];
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, errors: ["root must be an object"] };
  }
  const root = value as { meta?: unknown; findings?: unknown };
  errors.push(...validateMetaShape(root.meta));
  if (!Array.isArray(root.findings)) {
    errors.push("findings must be an array");
    return { ok: false, errors };
  }
  for (const [index, item] of root.findings.entries()) {
    const where = `findings[${index}]`;
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      errors.push(`${where} must be an object`);
      continue;
    }
    const f = item as LooseFinding & { extra_finding?: unknown };
    if (f.technique !== EXTRA_TECHNIQUE) {
      errors.push(`${where}.technique must be "ETC"`);
    }
    if (!(EXTRA_FINDING_TYPES as readonly unknown[]).includes(f.extra_finding)) {
      errors.push(`${where}.extra_finding must be a supported detector`);
    }
  }
  return { ok: errors.length === 0, errors };
}
