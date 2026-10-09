import { describe, expect, it } from "vitest";
import { ScanDeadline } from "../src/deadline.js";
import { crawlSite } from "../src/crawl.js";

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

  it("settles without launching a browser when the shared deadline cannot admit a page", async () => {
    const summary = await crawlSite({
      entryUrl: "http://127.0.0.1:9/",
      deadline: new ScanDeadline(1),
      executablePath: "/no-browser-should-start",
    });
    expect(summary.pages).toEqual([]);
    expect(summary.timedOut).toBe(true);
  });
});
