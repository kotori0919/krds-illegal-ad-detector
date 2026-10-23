import { createServer } from "node:http";
import { once } from "node:events";
import { chromium } from "playwright-core";
import { describe, expect, it } from "vitest";
import { detectPageCandidates } from "../src/pipeline.js";

async function onServedPage(html: string, check: (page: import("playwright-core").Page, url: string) => Promise<void>): Promise<void> {
  const server = createServer((_request, response) => {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end(`<!doctype html><html><body>${html}</body></html>`);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing server address");
  const url = `http://127.0.0.1:${address.port}/`;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(url);
    await check(page, url);
  } finally {
    await browser.close();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

describe("general source text detection", () => {
  it("rejects changed text instead of using replacement text as evidence for earlier analysis", async () => {
    const adText = "Ｋ카지노 신규가입";
    await onServedPage(`<p id="ad">${adText}</p><p id="control">공공시설 이용 안내</p>`, async (page, url) => {
      let mutation: Promise<unknown> | undefined;
      const observed: { evidenceText: string; analysisText: string }[] = [];
      const found = await detectPageCandidates(page, { pageUrl: url,
        onElementsAnalyzed: () => {
          mutation = page.evaluate(() => {
            document.getElementById("ad")!.textContent = "공공시설 이용 안내";
            document.getElementById("control")!.textContent = "Ｋ카지노 신규가입";
          });
        },
        onAdText: (source) => observed.push(source),
      });
      await mutation;
      expect(await page.locator("#ad").textContent()).toBe("공공시설 이용 안내");
      expect(found).toEqual([]);
      expect(observed).toEqual([]);
    });
  }, 60000);

  it("keeps owned analysis text separate from descendant source for additional finding deduplication", async () => {
    const parentText = "카지노 신규가입 parent";
    const childText = "카\u200b지\u200b노 신규가입 child";
    await onServedPage(`<div>${parentText}<p>${childText}</p></div>`, async (page, url) => {
      const observed: { url: string; location: string; evidenceText: string; analysisText: string }[] = [];
      const found = await detectPageCandidates(page, { pageUrl: url, onAdText: (source) => observed.push(source) });
      expect(found).toEqual([]);
      expect(observed).toEqual([
        { url, location: "div", evidenceText: parentText + childText, analysisText: parentText },
        { url, location: "p", evidenceText: childText, analysisText: childText },
      ]);
      expect(observed.filter((source) => /[\u200B-\u200D\uFEFF]/.test(source.analysisText)).map((source) => source.location)).toEqual(["p"]);
      for (const source of observed) expect(await page.locator(source.location).textContent()).toBe(source.evidenceText);
    });
  }, 60000);

  it("reports semantic source owners for pure zero-width ads before the official technique gate", async () => {
    const adText = "  카\u200b지\u200b노 신규가입\n";
    await onServedPage(`<main><p>${adText}</p><p>카\u200b지\u200b노 피해 신고 안내</p></main>`, async (page, url) => {
      const observed: { url: string; location: string; evidenceText: string }[] = [];
      const found = await detectPageCandidates(page, {
        pageUrl: url,
        onAdText: (source: { url: string; location: string; evidenceText: string }) => observed.push(source),
      });
      expect(found).toEqual([]);
      expect(observed).toEqual([{ url, location: "p:nth-of-type(1)", evidenceText: adText, analysisText: adText }]);
      expect(await page.locator(observed[0]!.location).count()).toBe(1);
      expect(await page.locator(observed[0]!.location).textContent()).toBe(adText);
    });
  }, 60000);

  it("reports one source owner when several official techniques pass on that owner", async () => {
    const adText = "Ｃ카지노\u200b 신규가입";
    await onServedPage(`<p style="opacity:0">${adText}</p>`, async (page, url) => {
      const observed: { url: string; location: string; evidenceText: string }[] = [];
      const found = await detectPageCandidates(page, { pageUrl: url, onAdText: (source) => observed.push(source) });
      expect(found.map((candidate) => candidate.technique.technique).sort()).toEqual(["HOMOGLYPH", "TRANSPARENT"]);
      expect(observed).toEqual([{ url, location: "p", evidenceText: adText, analysisText: adText }]);
    });
  }, 60000);

  it("detects hidden ordinary blocks and standalone inline leaves without collecting unrelated body source", async () => {
    await onServedPage(`<div style="display:none"><span>카</span><span>지노 신규가입</span></div>
      <span>Ｋ카지노 신규가입 leaf</span><script>"unrelated source"</script>`, async (page, url) => {
      const found = await detectPageCandidates(page, { pageUrl: url });
      expect(found.map((candidate) => [candidate.technique.technique, candidate.technique.rawText]).sort()).toEqual([
        ["HOMOGLYPH", "Ｋ카지노 신규가입 leaf"], ["OFFSCREEN", "카지노 신규가입"],
      ]);
      for (const candidate of found) {
        expect(await page.locator(candidate.selector).count()).toBe(1);
        expect(await page.locator(candidate.selector).textContent()).toBe(candidate.technique.rawText);
      }
    });
  }, 60000);

  it("keeps per-frame unique source selectors and the official frame separator", async () => {
    await onServedPage(`<iframe srcdoc="<p>Ｋ카지노 신규가입 frame</p>"></iframe>`, async (page, url) => {
      const frame = page.frames().find((entry) => entry !== page.mainFrame());
      if (!frame) throw new Error("Missing served fixture frame");
      const observed: { url: string; location: string; evidenceText: string }[] = [];
      const found = await detectPageCandidates(frame, { pageUrl: url, framePath: [{ src: frame.url(), selector: "iframe" }], onAdText: (source) => observed.push(source) });
      expect(found.map((candidate) => [candidate.location, candidate.technique.rawText])).toEqual([
        ['iframe >>> p', "Ｋ카지노 신규가입 frame"],
      ]);
      expect(await frame.locator(found[0]!.selector).count()).toBe(1);
      expect(await frame.locator(found[0]!.selector).textContent()).toBe(found[0]!.technique.rawText);
      expect(observed).toEqual([{ url, location: 'iframe >>> p', evidenceText: "Ｋ카지노 신규가입 frame", analysisText: "Ｋ카지노 신규가입 frame" }]);
    });
  }, 60000);

  it("detects non-ID owners once and preserves composed inline phrases and exact source", async () => {
    await onServedPage(`<main><section><div><p>  Ｋ카지노 신규가입\n</p></div></section>
      <a href="/casino/join"><span style="color:transparent">카</span><span>지노 신규가입</span></a>
      <div>Ｋ카지노 신규가입<p>ㅋㅏㅈㅣㄴㅗ 신규가입</p></div>
      <script>"Ｋ카지노 신규가입"</script><style>.x { content: "Ｋ카지노 신규가입" }</style>`, async (page, url) => {
      const found = await detectPageCandidates(page, { pageUrl: url });
      expect(found.map((candidate) => candidate.technique.technique).sort()).toEqual(["HOMOGLYPH", "HOMOGLYPH", "JAMO", "TRANSPARENT"]);
      for (const candidate of found) {
        expect(await page.locator(candidate.selector).count()).toBe(1);
        expect(await page.locator(candidate.selector).textContent()).toBe(candidate.technique.rawText);
      }
      const transparent = found.find((candidate) => candidate.technique.technique === "TRANSPARENT");
      expect(transparent?.technique.rawText).toBe("카지노 신규가입");
      expect(await page.locator(transparent!.selector).evaluate((element) => element.tagName)).toBe("A");
      expect(transparent?.observed.css.color).toBe("rgba(0, 0, 0, 0)");
      expect(found.find((candidate) => candidate.technique.rawText.startsWith("  "))?.technique.rawText).toBe("  Ｋ카지노 신규가입\n");
    });
  }, 60000);

  it("keeps duplicate IDs, escaped selector tokens, and deep repeated ancestry individually addressable", async () => {
    const deep = (text: string): string => `<div>${"<div>".repeat(15)}<p>${text}</p>${"</div>".repeat(15)}</div>`;
    await onServedPage(`<p id="same">Ｋ카지노 신규가입 one</p><p id="same">Ｋ카지노 신규가입 two</p>
      <p class="1:odd">Ｋ카지노 신규가입 class</p><p title='quote&quot; slash\\ line&#10;end'>Ｋ카지노 신규가입 attr</p>
      ${deep("Ｋ카지노 신규가입 deep one")}${deep("Ｋ카지노 신규가입 deep two")}`, async (page, url) => {
      const found = await detectPageCandidates(page, { pageUrl: url });
      expect(found.map((candidate) => candidate.technique.rawText).sort()).toEqual([
        "Ｋ카지노 신규가입 one", "Ｋ카지노 신규가입 two", "Ｋ카지노 신규가입 class", "Ｋ카지노 신규가입 attr", "Ｋ카지노 신규가입 deep one", "Ｋ카지노 신규가입 deep two",
      ].sort());
      expect(new Set(found.map((candidate) => candidate.selector)).size).toBe(6);
      for (const candidate of found) {
        expect(await page.locator(candidate.selector).count()).toBe(1);
        expect(await page.locator(candidate.selector).textContent()).toBe(candidate.technique.rawText);
      }
    });
  }, 60000);
});
