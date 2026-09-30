import { describe, expect, it } from "vitest";
import { chromium } from "playwright-core";
import { detectPageCandidates } from "../src/pipeline.js";
import { startFixtureServer } from "@krds-detector/synth-eval/serve.js";

describe("adversarial fixtures", () => {
  it("defeats none of the four detectors; legitimate cases stay silent", async () => {
    const started = startFixtureServer(4185);
    const browser = await chromium.launch();
    try {
      const check = async (path: string): Promise<string[]> => {
        const page = await browser.newPage();
        await page.goto(`${started.url}${path}`, { waitUntil: "commit" });
        await page.waitForTimeout(400);
        const found = await detectPageCandidates(page, { pageUrl: `${started.url}${path}` });
        await page.close();
        return found.map((c) => `${c.selector}:${c.technique.technique}`).sort();
      };
      const adv = await check("/adversarial.html");
      for (const expected of [
        "#adv-cyrillic:HOMOGLYPH",
        "#adv-punct:HOMOGLYPH",
        "#adv-digit:HOMOGLYPH",
        "#adv-mixed-jamo:JAMO",
        "#adv-ancestor-child:TRANSPARENT",
        "#adv-transform:OFFSCREEN",
        "#adv-clip:OFFSCREEN",
        "#adv-hidden-overflow:OFFSCREEN",
      ]) {
        expect(adv, expected).toContain(expected);
      }
      // Legitimate animation state + brand text: concealment or confusables
      // without ad semantics must not fire.
      expect(adv.filter((s) => s.startsWith("#adv-legit"))).toEqual([]);
      expect(await check("/negatives.html")).toEqual([]);
    } finally {
      await browser.close();
      await started.close();
    }
  }, 120000);
});
