import { describe, expect, it } from "vitest";
import { ScanDeadline, pageConcurrency } from "../src/deadline.js";

describe("shared scan deadline", () => {
  it("caps the internal budget and stops admitting work before finalization reserve", () => {
    let now = 100;
    const deadline = new ScanDeadline(1800, () => now);
    expect(deadline.remainingMs()).toBe(1_650_000);
    now += 1_620_000;
    expect(deadline.canStartPage()).toBe(false);
    expect(deadline.operationTimeoutMs(20_000)).toBe(0);
    now += 30_000;
    expect(deadline.expired()).toBe(true);
  });

  it("uses a proportionate reserve for short configured scans", () => {
    let now = 0;
    const deadline = new ScanDeadline(20, () => now);
    expect(deadline.canStartPage()).toBe(true);
    now = 16_001;
    expect(deadline.canStartPage()).toBe(false);
    expect(deadline.operationTimeoutMs(10_000)).toBe(1_999);
  });

  it("starts conservatively on four CPUs and never exceeds four workers", () => {
    expect([1, 4, 5, 8, 9, 64].map(pageConcurrency)).toEqual([2, 2, 3, 3, 4, 4]);
  });
});
