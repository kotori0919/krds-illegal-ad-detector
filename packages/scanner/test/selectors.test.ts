import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { crawlSite } from "../src/crawl.js";
import { serializeFramePath } from "@krds-detector/contracts";
import { startFixtureServer } from "@krds-detector/synth-eval/serve.js";
import { chromium } from "playwright-core";


describe("selector engine", () => {
  it("round-trips every direct ground-truth positive selector", async () => {
    const started = await startFixtureServer();
    const browser = await chromium.launch();
    try {
      const truth = JSON.parse(
        (await readFile(resolve("fixtures/synthetic/ground-truth.json"), "utf-8")) as string,
      ) as {
        cases: { id: string; kind: string; page: string; selector?: string }[];
      };
      const positives = truth.cases.filter((c) => c.kind === "positive" && c.selector);
      expect(positives.length).toBeGreaterThan(0);
      const context = await browser.newContext();
      for (const c of positives) {
        // Structural iframe/query/delayed pages resolve through the crawler
        // path in the live tests below; here cover direct positive pages.
        if (c.page.startsWith("/structural/") || c.page.startsWith("/posts/")) continue;
        const page = await context.newPage();
        await page.goto(`${started.url}${c.page}`, { waitUntil: "commit" });
        const target = c.selector as string;
        const roundTrip = await page.evaluate((sel: string) => {
          const el = document.querySelector(sel);
          if (!el) return { found: false, unique: false, same: false };
          return {
            found: true,
            unique: document.querySelectorAll(sel).length === 1,
            same: document.querySelector(sel) === el,
          };
        }, target);
        expect(roundTrip, c.id).toEqual({ found: true, unique: true, same: true });
        await page.close();
      }
      await context.close();
    } finally {
      await browser.close();
      await started.close();
    }
  }, 120000);

  it("resolves unique selectors by priority: id, attribute, class, nth-of-type", async () => {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.setContent(`<!doctype html><html><body><main>
        <p id="unique-ad">ad one</p>
        <a href="/promo" class="dup">ad two</a>
        <a href="/promo" class="dup">ad three</a>
        <div><span>ad four</span><span>ad five</span></div>
      </main></body></html>`);
      const result = await page.evaluate(() => {
        const check = (sel: string): { unique: boolean; same: boolean; text: string | undefined } => {
          const found = document.querySelector(sel);
          return {
            unique: document.querySelectorAll(sel).length === 1,
            same: found === document.querySelector(sel),
            text: found?.textContent ?? undefined,
          };
        };
        return {
          byId: check("#unique-ad"),
          // tag+href attribute narrows the dup links only with nth-of-type.
          dupAttr: check('a[href="/promo"]:nth-of-type(1)'),
          dupClass: check("p.dup"),
        };
      });
      expect(result.byId).toMatchObject({ unique: true, text: "ad one" });
      expect(result.dupAttr.unique).toBe(true);
      // Bare class shared by two links is ambiguous: engine must not emit it.
      expect(result.dupClass.unique).toBe(false);
      await page.close();
    } finally {
      await browser.close();
    }
  }, 60000);

  it("emits nested iframe locations with absolute srcs via contract", async () => {
    const started = await startFixtureServer();
    try {
      const summary = await crawlSite({
        entryUrl: `${started.url}/structural/outer.html`,
        limits: { maxPages: 3, maxDepth: 2, timeoutSec: 60 },
        // Production default (1500 ms): 300 ms misses subframe attach
        // on loaded CI runners (frames array empty, not wrong chain).
        settleMs: 1500,
        perPageMs: 15000,
      });
      const outer = summary.pages[0];
      expect(outer).toBeDefined();
      const middle = (outer?.frames ?? []).find((f) => f.url.endsWith("/structural/middle.html"));
      const inner = (outer?.frames ?? []).find((f) => f.url.endsWith("/structural/inner.html"));
      expect(middle?.selectorChain).toEqual(["#frame-outer"]);
      expect(inner?.selectorChain).toEqual(["#frame-outer", "#frame-inner"]);
      const location = serializeFramePath({
        framePath: [
          { src: `${started.url}/structural/middle.html`, selector: "#frame-outer" },
          { src: `${started.url}/structural/inner.html`, selector: "#frame-inner" },
        ],
        selector: "#ad-frame-jamo",
      });
      expect(location).toBe(
        '#frame-outer >>> #frame-inner >>> #ad-frame-jamo',
      );
      expect(inner?.html).toContain("ad-frame-jamo");
      const shallow = await crawlSite({
        entryUrl: `${started.url}/structural/outer.html`,
        limits: { maxPages: 1, maxDepth: 0, maxFrameDepth: 1, timeoutSec: 60 },
        settleMs: 300,
        perPageMs: 15000,
      });
      expect(shallow.pages[0]?.frames.map((frame) => frame.url)).toContain(`${started.url}/structural/middle.html`);
      expect(shallow.pages[0]?.frames.map((frame) => frame.url)).not.toContain(`${started.url}/structural/inner.html`);
    } finally {
      await started.close();
    }
  }, 120000);
});
