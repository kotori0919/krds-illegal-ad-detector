import { createServer } from "node:http";
import { once } from "node:events";
import { chromium } from "playwright-core";
import { expect, it } from "vitest";
import { createSelectorEngine } from "../src/selectors.js";

it("generates actual unique round trips for escaped tokens, duplicate IDs, and deeply repeated ancestry", async () => {
  const nested = `<section>${"<div>".repeat(16)}<span data-selector-case>deep</span>${"</div>".repeat(16)}</section>`;
  const html = `<!doctype html><html><body>
    <p data-selector-case id="123:ad">escaped ID</p>
    <p data-selector-case id="duplicate" title="stable">duplicate with stable attribute</p>
    <p data-selector-case id="duplicate">duplicate without attribute</p>
    <p data-selector-case class="1:class">escaped class</p>
    <p data-selector-case title='quote&quot; backslash\\ line&#10;end'>escaped attribute</p>
    ${nested}${nested}
  </body></html>`;
  const server = createServer((_request, response) => { response.setHeader("Content-Type", "text/html; charset=utf-8"); response.end(html); });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing server address");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${address.port}/`);
    const result = await page.evaluate<{
      entries: { selector: string; count: number; same: boolean; text: string }[];
      ambiguousRoundTrip: boolean;
      wrongElementRoundTrip: boolean;
    }>(`(() => {
      const engine = (${createSelectorEngine.toString()})();
      const elements = Array.from(document.querySelectorAll('[data-selector-case]'));
      return {
        entries: elements.map((element) => {
          const selector = engine.buildSelectorFor(element, document);
          return { selector, count: engine.countMatches(document, selector), same: engine.roundTrips(document, element, selector), text: document.querySelector(selector)?.textContent };
        }),
        ambiguousRoundTrip: engine.roundTrips(document, elements[1], '#duplicate'),
        wrongElementRoundTrip: engine.roundTrips(document, elements[0], '[title="stable"]'),
      };
    })()`);
    expect(result.entries.map((entry: { text: string }) => entry.text)).toEqual([
      "escaped ID", "duplicate with stable attribute", "duplicate without attribute", "escaped class", "escaped attribute", "deep", "deep",
    ]);
    for (const entry of result.entries) expect(entry).toMatchObject({ count: 1, same: true });
    expect(result.entries[1]!.selector).toBe('p[title="stable"]');
    expect(result.ambiguousRoundTrip).toBe(false);
    expect(result.wrongElementRoundTrip).toBe(false);
  } finally {
    await browser.close();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}, 60000);
