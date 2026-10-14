/** Stored readiness describes validated resources, never a live tunnel. */
export type WarpFailureCode = "config-permission" | "config-invalid" | "binary-missing" | "binary-integrity" | "registration-failed" | "preparation-failed" | "tunnel-exited";
export type WarpStatus = { state: "unsupported" | "unregistered" | "registering" }
  | { state: "ready"; backend: "usque"; version: "4.2.1" }
  | { state: "unavailable"; reason: WarpFailureCode };
export type TransportProvenance = { kind: "direct"; reason: "owned-origin" | "source-cli" }
  | { kind: "warp"; backend: "usque"; version: "4.2.1" };
export interface TransportFailure { code: WarpFailureCode; scope: "incomplete" }
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: readonly string[]): boolean => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
export const isWarpFailureCode = (value: unknown): value is WarpFailureCode => typeof value === "string" && ["config-permission", "config-invalid", "binary-missing", "binary-integrity", "registration-failed", "preparation-failed", "tunnel-exited"].includes(value);
export function isWarpStatus(value: unknown): value is WarpStatus {
  if (!record(value)) return false;
  if (value.state === "unsupported" || value.state === "unregistered" || value.state === "registering") return exact(value, ["state"]);
  if (value.state === "ready") return exact(value, ["state", "backend", "version"]) && value.backend === "usque" && value.version === "4.2.1";
  return value.state === "unavailable" && exact(value, ["state", "reason"]) && isWarpFailureCode(value.reason);
}
export function isTransportProvenance(value: unknown): value is TransportProvenance {
  return record(value) && (value.kind === "direct" && exact(value, ["kind", "reason"]) && (value.reason === "owned-origin" || value.reason === "source-cli")
    || value.kind === "warp" && exact(value, ["kind", "backend", "version"]) && value.backend === "usque" && value.version === "4.2.1");
}
export function isTransportFailure(value: unknown): value is TransportFailure {
  return record(value) && exact(value, ["code", "scope"]) && isWarpFailureCode(value.code) && value.scope === "incomplete";
}
