/**
 * Durable operator batch group (D08). A group is the *identity and target
 * list* of one multi-site run; it never duplicates official output or review
 * data. Each completed target points at its own case (`caseId`), whose
 * result.json/review.json stay the single source of truth. Groups live in a
 * separate store namespace so older cases and their manifests need no
 * migration.
 */
export const BATCH_GROUP_SCHEMA_VERSION = 1 as const;
/** More targets than one import can produce would be an attack, not a batch. */
export const BATCH_GROUP_TARGET_LIMIT = 100;
export const BATCH_GROUP_LIST_LIMIT = 200;
export const BATCH_GROUP_LABEL_LIMIT = 512;
export const BATCH_GROUP_ERROR_LIMIT = 2000;
export const BATCH_GROUP_URL_LIMIT = 8192;

export type BatchGroupTargetStatus =
  | "pending" | "running" | "complete" | "partial" | "blocked" | "failed" | "cancelled";
export type BatchGroupPhase = "ready" | "running" | "paused" | "stopped" | "complete";
export type BatchGroupScope = "entry" | "quick" | "automatic";

export interface BatchGroupTarget {
  key: number;
  label: string;
  entryUrl: string;
  kind: "site" | "sitemap";
  status: BatchGroupTargetStatus;
  /** Durable case identity, present only when a validated result exists. */
  caseId?: string;
  error?: string;
}

export interface BatchGroup {
  schemaVersion: 1;
  groupId: string;
  createdAt: string;
  updatedAt: string;
  phase: BatchGroupPhase;
  scope: BatchGroupScope;
  connection: "direct" | "warp";
  targets: BatchGroupTarget[];
}

export interface BatchGroupListIssue { code: string; groupId: string }
export interface BatchGroupList {
  schemaVersion: 1;
  groups: BatchGroup[];
  issues: BatchGroupListIssue[];
}

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const keys = (value: Record<string, unknown>, allowed: readonly string[]): boolean =>
  Object.keys(value).every(key => allowed.includes(key));
const text = (value: unknown, maximum: number): value is string =>
  typeof value === "string" && Array.from(value).length <= maximum && !value.includes("\0");
const integer = (value: unknown, maximum: number): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= maximum;
const timestamp = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value);
export const isBatchGroupId = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const statuses: readonly BatchGroupTargetStatus[] = ["pending", "running", "complete", "partial", "blocked", "failed", "cancelled"];
const phases: readonly BatchGroupPhase[] = ["ready", "running", "paused", "stopped", "complete"];
const scopes: readonly BatchGroupScope[] = ["entry", "quick", "automatic"];

/** Public http(s) target identity, matching the manifest entry-URL rule. */
export function isBatchGroupEntryUrl(value: unknown): value is string {
  if (!text(value, BATCH_GROUP_URL_LIMIT) || /\s/.test(value)) return false;
  const parts = /^(https?):\/\/([^/?#]+)/i.exec(value);
  return !!parts && parts[2]!.length > 0 && !parts[2]!.includes("@");
}

export function isBatchGroupTarget(value: unknown): value is BatchGroupTarget {
  return record(value)
    && keys(value, ["key", "label", "entryUrl", "kind", "status", "caseId", "error"])
    && integer(value.key, BATCH_GROUP_TARGET_LIMIT - 1)
    && text(value.label, BATCH_GROUP_LABEL_LIMIT)
    && isBatchGroupEntryUrl(value.entryUrl)
    && (value.kind === "site" || value.kind === "sitemap")
    && typeof value.status === "string" && (statuses as readonly string[]).includes(value.status)
    && (value.caseId === undefined || isBatchGroupId(value.caseId))
    && (value.error === undefined || text(value.error, BATCH_GROUP_ERROR_LIMIT));
}

export function isBatchGroup(value: unknown): value is BatchGroup {
  if (!record(value) || !keys(value, ["schemaVersion", "groupId", "createdAt", "updatedAt", "phase", "scope", "connection", "targets"])
    || value.schemaVersion !== BATCH_GROUP_SCHEMA_VERSION || !isBatchGroupId(value.groupId)
    || !timestamp(value.createdAt) || !timestamp(value.updatedAt)
    || typeof value.phase !== "string" || !(phases as readonly string[]).includes(value.phase)
    || typeof value.scope !== "string" || !(scopes as readonly string[]).includes(value.scope)
    || (value.connection !== "direct" && value.connection !== "warp")
    || !Array.isArray(value.targets) || value.targets.length < 1 || value.targets.length > BATCH_GROUP_TARGET_LIMIT) return false;
  return value.targets.every((target, index) => isBatchGroupTarget(target) && target.key === index);
}

export function isBatchGroupList(value: unknown): value is BatchGroupList {
  return record(value) && keys(value, ["schemaVersion", "groups", "issues"])
    && value.schemaVersion === BATCH_GROUP_SCHEMA_VERSION
    && Array.isArray(value.groups) && value.groups.length <= BATCH_GROUP_LIST_LIMIT && value.groups.every(isBatchGroup)
    && new Set(value.groups.map(group => group.groupId)).size === value.groups.length
    && Array.isArray(value.issues) && value.issues.length <= BATCH_GROUP_LIST_LIMIT + 1
    && value.issues.every(issue => record(issue) && keys(issue, ["code", "groupId"])
      && text(issue.code, 128) && issue.code.length > 0 && text(issue.groupId, 256));
}

export interface BatchGroupProgress { completed: number; total: number; incomplete: number }

/** Honest coverage: a target counts only when it owns a durable case. */
export function batchGroupProgress(group: BatchGroup): BatchGroupProgress {
  const completed = group.targets.filter(target => target.caseId !== undefined).length;
  return { completed, total: group.targets.length, incomplete: group.targets.length - completed };
}
