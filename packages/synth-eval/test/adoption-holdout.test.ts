import { expect, it } from "vitest";
import { chromium } from "playwright-core";
import { scanSite } from "../../detection/src/scan.js";
import { resolveFrameLocation } from "../../scanner/src/frame-location.js";

// Explicit, heavyweight evaluation; ordinary unit/check runs do not repeat it.
it.skipIf(process.env.KRDS_RUN_HOLDOUT !== "1")("evaluates authored holdout through live canonical scan and actual locator resolution", async () => {
  const harnessPath = "../../../benchmarks/adoption-holdout.mjs";
  const harness = await import(harnessPath);
  const report = await harness.runHoldout({ scanSite, chromium, resolveFrameLocation,
    outputPath: process.env.KRDS_HOLDOUT_REPORT,
    testSandboxException: process.env.KRDS_TEST_UNSANDBOXED === "1" });
  expect(report.equivalent).toBe(true);
  expect(report.passed).toBe(true);
}, 180_000);
