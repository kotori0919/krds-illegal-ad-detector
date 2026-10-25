import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { SCAN_POLICY, validateScanConfiguration, validateScanLimits } from "../src/config.js";
const corpus: { valid: unknown; invalid: { name: string; value: unknown }[] } = JSON.parse(readFileSync(new URL("./fixtures/config-conformance.json", import.meta.url), "utf8"));
it("accepts bounded operator preferences and resolves immutable safe defaults", () => {
  const result = validateScanConfiguration(corpus.valid);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("valid fixture rejected");
  expect(result.value).toEqual({ configVersion: 1, detectorPolicyVersion: 3, limits: { maxPages: 2000, maxDepth: 10, timeoutSec: 60, maxFrameDepth: 4 }, concurrency: 4, settleMs: 0 });
  expect(Object.isFrozen(SCAN_POLICY.visual)).toBe(true);
});
it.each(corpus.invalid)("rejects configuration boundary: $name", fixture => { expect(validateScanConfiguration(fixture.value).ok).toBe(false); });
it("allows bounded short fixture budgets only on the worker surface", () => {
  expect(validateScanLimits({ timeoutSec: 12 }, "worker")).toEqual({ ok: true, value: { ...SCAN_POLICY.scan.defaults, timeoutSec: 12 } });
  expect(validateScanLimits({ timeoutSec: 12 }, "operator").ok).toBe(false);
  expect(validateScanLimits({ timeoutSec: Number.NaN }, "worker").ok).toBe(false);
  expect(validateScanLimits({ maxPages: "200" }).ok).toBe(false);
});
