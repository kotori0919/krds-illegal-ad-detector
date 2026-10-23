import type { OfficialResult } from "./result.js";
import { isTransportProvenance, isTransportFailure } from "./warp.js";
/** Internal case schema 1. Official output schema and review are independent. */
export const CASE_SCHEMA_VERSION = 1 as const;
export const DETECTION_POLICY_VERSION = 2 as const;
export type OperatorJudgment = "unjudged" | "suspected" | "judged-normal" | "needs-more-evidence";
export interface CaseIssue { code: string; scope: string; retryable: boolean }
export interface CaseManifest {
  schemaVersion: 1; caseId: string; entryUrl: string; startedAt: string; finishedAt: string;
  status: "succeeded" | "cancelled" | "failed"; toolVersion: string; policyVersion: number; exportableAt: string; evidenceSha256?: string;
  officialSha256: string; findings: number; issues: CaseIssue[]; settings: Record<string, unknown>;
}
export interface ReviewRecord {
  findingId: string; state: "needed" | "reviewed"; judgment?: OperatorJudgment; note: string; at: string;
}
export interface CaseReview { schemaVersion: 1; revision: number; updatedAt: string; records: ReviewRecord[] }
export interface SavedCase { manifest: CaseManifest; directory: string; reviewRevision?: number }
export interface CaseList { schemaVersion: 1; storageRoot: string; cases: SavedCase[]; issues: { code: string; caseId: string; retryable: boolean }[]; limit: number }
export interface OpenCase { manifest: CaseManifest; review: CaseReview; directory: string }
export interface SupportDiagnostics { toolVersion: string; policyVersion: number; caseSchema: number; storageRoot: string; network: string; model: string; signing: string }

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const keys = (value: Record<string, unknown>, allowed: readonly string[]): boolean => Object.keys(value).every(key => allowed.includes(key));
const text = (value: unknown, maximum = 4096): value is string => typeof value === "string" && value.length <= maximum && !value.includes("\0");
const integer = (value: unknown, maximum = Number.MAX_SAFE_INTEGER): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= maximum;
const hash = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
export const isCaseId = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const timestamp = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]!
    && Number(match[4]) <= 23 && Number(match[5]) <= 59 && Number(match[6]) <= 59
    && Number(match[7] ?? 0) <= 23 && Number(match[8] ?? 0) <= 59;
};
const caseIssue = (value: unknown): value is CaseIssue => record(value) && keys(value, ["code", "scope", "retryable"])
  && text(value.code, 128) && value.code.length > 0 && text(value.scope, 64) && value.scope.length > 0 && typeof value.retryable === "boolean";

export function isCaseManifest(value: unknown, official?: OfficialResult): value is CaseManifest {
  return record(value) && keys(value, ["schemaVersion", "caseId", "entryUrl", "startedAt", "finishedAt", "exportableAt", "status", "toolVersion", "policyVersion", "officialSha256", "evidenceSha256", "findings", "issues", "settings"])
    && value.schemaVersion === CASE_SCHEMA_VERSION && isCaseId(value.caseId) && text(value.entryUrl, 8192)
    && (() => { try { const url = new URL(value.entryUrl); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password; } catch { return false; } })()
    && timestamp(value.startedAt) && timestamp(value.finishedAt) && timestamp(value.exportableAt)
    && text(value.status, 32) && ["succeeded", "cancelled", "failed"].includes(value.status) && text(value.toolVersion, 128) && value.toolVersion.length > 0
    && value.policyVersion === DETECTION_POLICY_VERSION && hash(value.officialSha256) && (value.evidenceSha256 === undefined || hash(value.evidenceSha256))
    && integer(value.findings, 20_000) && Array.isArray(value.issues) && value.issues.length <= 1000 && value.issues.every(caseIssue) && record(value.settings)
    && (value.settings.connection === undefined || value.settings.connection === "direct" || value.settings.connection === "warp")
    && (value.settings.transport === undefined || isTransportProvenance(value.settings.transport))
    && (value.settings.transportFailure === undefined || value.status === "failed" && isTransportFailure(value.settings.transportFailure))
    && (!official || value.findings === official.findings.length && value.startedAt === official.meta.started_at
      && value.finishedAt === official.meta.finished_at && value.toolVersion === official.meta.tool_version);
}

export function isReviewRecord(value: unknown): value is ReviewRecord {
  return record(value) && keys(value, ["findingId", "state", "judgment", "note", "at"])
    && text(value.findingId, 128) && value.findingId.length > 0 && text(value.state, 32) && ["needed", "reviewed"].includes(value.state)
    && text(value.judgment, 32) && ["unjudged", "suspected", "judged-normal", "needs-more-evidence"].includes(value.judgment)
    && text(value.note, 4000) && Array.from(value.note).length <= 2000 && timestamp(value.at);
}
export function isCaseReview(value: unknown, official?: OfficialResult): value is CaseReview {
  if (!record(value) || !keys(value, ["schemaVersion", "revision", "updatedAt", "records"]) || value.schemaVersion !== CASE_SCHEMA_VERSION
    || !integer(value.revision) || !Array.isArray(value.records) || value.records.length > 20_000 || !value.records.every(isReviewRecord)) return false;
  const findingIds = official && new Set(official.findings.map(finding => finding.id));
  return (timestamp(value.updatedAt) || (value.revision === 0 && value.records.length === 0 && value.updatedAt === ""))
    && new Set(value.records.map(item => item.findingId)).size === value.records.length
    && (!findingIds || value.records.every(item => findingIds.has(item.findingId)));
}
export function isCaseList(value: unknown): value is CaseList {
  if (!record(value) || !keys(value, ["schemaVersion", "storageRoot", "cases", "issues", "limit"]) || value.schemaVersion !== CASE_SCHEMA_VERSION
    || !text(value.storageRoot) || !integer(value.limit, 2000) || value.limit === 0 || !Array.isArray(value.cases) || value.cases.length > value.limit
    || !value.cases.every(item => record(item) && keys(item, ["manifest", "directory", "reviewRevision"]) && isCaseManifest(item.manifest)
      && text(item.directory) && (item.reviewRevision === undefined || integer(item.reviewRevision))) || !Array.isArray(value.issues) || value.issues.length > 2001) return false;
  const ids = value.cases.map(item => item.manifest.caseId);
  return new Set(ids).size === ids.length && value.issues.every(item => record(item) && keys(item, ["code", "caseId", "retryable"])
    && text(item.code, 128) && text(item.caseId, 256) && typeof item.retryable === "boolean");
}
export function isOpenCase(value: unknown): value is OpenCase {
  return record(value) && keys(value, ["manifest", "review", "directory"]) && isCaseManifest(value.manifest) && isCaseReview(value.review)
    && value.review.records.length <= value.manifest.findings && text(value.directory);
}
export function isSupportDiagnostics(value: unknown): value is SupportDiagnostics {
  return record(value) && keys(value, ["toolVersion", "policyVersion", "caseSchema", "storageRoot", "network", "model", "signing"])
    && text(value.toolVersion, 128) && value.policyVersion === DETECTION_POLICY_VERSION && value.caseSchema === CASE_SCHEMA_VERSION
    && text(value.storageRoot) && text(value.network, 128) && text(value.model, 128) && text(value.signing, 128);
}

export function parseCaseValue<T>(value: unknown, guard: (value: unknown) => value is T): T {
  if (!guard(value)) throw new Error("INVALID_CASE_CONTRACT: unsupported or malformed case data");
  return value;
}
