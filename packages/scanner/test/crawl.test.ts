import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crawlSite } from "../src/crawl.js";
import { startFixtureServer } from "@krds-detector/synth-eval/serve.js";

const PORT = 4161;
let base = "";
let closeServer: () => Promise<void> = async () => undefined;

beforeAll(async () => {
  const started = startFixtureServer(PORT);
  base = started.url;
  closeServer = started.close;
  for (let i = 0; i < 50; i += 1) {
    try {
      const res = await fetch(`${base}/`);
      if (res.ok) break;
    } catch {
      /* server not ready yet; readiness poll, not a timing assumption */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
});

afterAll(async () => {
  await closeServer();
});

describe("crawlSite on synthetic fixtures", () => {
  it("discovers all hub-linked pages with query values kept distinct", async () => {
    const summary = await crawlSite({
      entryUrl: `${base}/`,
      limits: { maxPages: 30, maxDepth: 4, timeoutSec: 120 },
      settleMs: 300,
      perPageMs: 15000,
    });
    const urls = summary.pages.map((p) => p.url);
    for (const expected of [
      `${base}/positives/homoglyph.html`,
      `${base}/positives/jamo.html`,
      `${base}/structural/outer.html`,
      `${base}/structural/board.html?id=101`,
      `${base}/structural/board.html?id=102`,
      `${base}/negatives.html`,
    ]) {
      expect(urls, expected).toContain(expected);
    }
    expect(summary.timedOut).toBe(false);
  }, 120000);

  it("captures nested iframe chain with absolute srcs", async () => {
    const summary = await crawlSite({
      entryUrl: `${base}/structural/outer.html`,
      limits: { maxPages: 5, maxDepth: 4, timeoutSec: 60 },
      settleMs: 300,
      perPageMs: 15000,
    });
    const outer = summary.pages[0];
    expect(outer).toBeDefined();
    const frameUrls = outer?.frames.map((f) => f.url) ?? [];
    expect(frameUrls).toContain(`${base}/structural/middle.html`);
    expect(frameUrls).toContain(`${base}/structural/inner.html`);
    const inner = outer?.frames.find((f) => f.url.endsWith("/structural/inner.html"));
    expect(inner?.html).toContain("ad-frame-jamo");
  }, 120000);

  it("observes delayed injection only after settle", async () => {
    const settled = await crawlSite({
      entryUrl: `${base}/structural/delayed.html`,
      limits: { maxPages: 2, maxDepth: 0, timeoutSec: 60 },
      settleMs: 1800,
      perPageMs: 20000,
    });
    expect(settled.pages[0]?.html).toContain('id="ad-delayed-injected"');
    const immediate = await crawlSite({
      entryUrl: `${base}/structural/delayed.html`,
      limits: { maxPages: 2, maxDepth: 0, timeoutSec: 60 },
      settleMs: 0,
      perPageMs: 20000,
    });
    expect(immediate.pages[0]?.html).not.toContain('id="ad-delayed-injected"');
  }, 120000);

  it("flags duplicate content for ref-linked post", async () => {
    const summary = await crawlSite({
      entryUrl: `${base}/`,
      limits: { maxPages: 30, maxDepth: 4, timeoutSec: 120 },
      settleMs: 300,
      perPageMs: 15000,
    });
    const ref = summary.pages.find((p) => p.url.includes("notice.html?ref=main"));
    expect(ref).toBeDefined();
    expect(ref?.duplicateContent).toBe(true);
  }, 120000);

  it("executes query-param page content in the live DOM", async () => {
    const summary = await crawlSite({
      entryUrl: `${base}/structural/board.html?id=101`,
      limits: { maxPages: 2, maxDepth: 0, timeoutSec: 60 },
      settleMs: 500,
      perPageMs: 15000,
    });
    expect(summary.pages[0]?.html).toContain("ad-query-hg");
  }, 120000);
}, 300000);
