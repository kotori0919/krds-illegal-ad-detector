import policy from "./policy.json" with { type: "json" };
import type { ScanLimits } from "./scan.js";

/** Shipped, reviewed build input, not an operator-editable remote rule pack. */
function freeze<T extends object>(value: T): Readonly<T> {
  for (const child of Object.values(value)) if (child && typeof child === "object") freeze(child);
  return Object.freeze(value);
}
if (policy.configVersion !== 1 || policy.detectorPolicyVersion !== 2 || policy.optionalModels.enabled !== false) {
  throw new Error("Unsupported or unsafe shipped configuration");
}
export const CONFIG_VERSION = 1 as const;
export const SCAN_POLICY = freeze(policy);
export type LimitsAudience = "operator" | "worker";
export type ConfigValidation<T> = { ok: true; value: T } | { ok: false; errors: string[] };
const limitKeys = ["maxPages", "maxDepth", "timeoutSec", "maxFrameDepth"] as const;
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

/** UI bounds protect the operator ceiling. Short fixture deadlines belong only to the worker/test surface. */
export function validateScanLimits(input: unknown, audience: LimitsAudience = "operator"): ConfigValidation<ScanLimits> {
  if (!isRecord(input)) return { ok: false, errors: ["limits must be an object"] };
  const errors: string[] = [];
  for (const key of Object.keys(input)) if (!limitKeys.includes(key as typeof limitKeys[number])) errors.push(`unknown limit: ${key}`);
  const bounds = audience === "operator" ? SCAN_POLICY.scan.operatorBounds : SCAN_POLICY.scan.workerBounds;
  const value: ScanLimits = { ...SCAN_POLICY.scan.defaults };
  for (const key of limitKeys) {
    if (!(key in input)) continue;
    const candidate = input[key];
    const [minimum, maximum] = bounds[key];
    if (typeof candidate !== "number" || !Number.isSafeInteger(candidate) || candidate < minimum! || candidate > maximum!) {
      errors.push(`${key} must be an integer in ${minimum}..${maximum}`);
    } else value[key] = candidate;
  }
  return errors.length ? { ok: false, errors } : { ok: true, value };
}

export interface EffectiveScanConfiguration {
  configVersion: 1;
  detectorPolicyVersion: 2;
  limits: ScanLimits;
  concurrency: number;
  settleMs: number;
}
/** Versioned safe preferences; internal memory/network/model policy is never caller-controlled. */
export function validateScanConfiguration(input: unknown, audience: LimitsAudience = "operator"): ConfigValidation<EffectiveScanConfiguration> {
  if (!isRecord(input) || input.configVersion !== CONFIG_VERSION) return { ok: false, errors: ["unsupported configVersion"] };
  const errors = Object.keys(input).filter(key => !["configVersion", "limits", "concurrency", "settleMs"].includes(key)).map(key => `unknown configuration: ${key}`);
  const limits = validateScanLimits(input.limits ?? {}, audience);
  if (!limits.ok) errors.push(...limits.errors);
  const number = (name: "concurrency" | "settleMs"): number => {
    const bound = SCAN_POLICY.scan[name];
    const value = input[name] ?? bound.default;
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < bound.min || value > bound.max) {
      errors.push(`${name} is outside supported bounds`); return bound.default;
    }
    return value;
  };
  const concurrency = number("concurrency");
  const settleMs = number("settleMs");
  if (errors.length || !limits.ok) return { ok: false, errors };
  return { ok: true, value: { configVersion: CONFIG_VERSION, detectorPolicyVersion: 2, limits: limits.value, concurrency, settleMs } };
}
