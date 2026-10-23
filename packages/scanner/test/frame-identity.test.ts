import { createServer, type ServerResponse } from "node:http";
import { afterAll, beforeAll, expect, it } from "vitest";
import { serializeFramePath, SCAN_POLICY } from "@krds-detector/contracts";
import { crawlSite } from "../src/crawl.js";
import { resolveFrameLocation } from "../src/frame-location.js";
import { collectElementSignals } from "../../detection/src/visibility.js";

let base = "";
let fixtureReady = false;
let readyScript: ServerResponse | undefined;
const server = createServer((request, response) => {
  response.setHeader("content-type", "text/html; charset=utf-8");
  if (request.url === "/robots.txt") { response.end(""); return; }
  if (request.url === "/same") { response.end('<p id="ad">카지노 가입</p>'); return; }
  if (request.url === "/nested") { response.end('<iframe src="same"></iframe>'); return; }
  if (request.url === "/ready.js") {
    response.setHeader("content-type", "text/javascript");
    if (fixtureReady) response.end("");
    else {
      readyScript = response;
      response.on("close", () => { if (readyScript === response) readyScript = undefined; });
    }
    return;
  }
  if (request.url === "/fixture-ready") {
    fixtureReady = true; readyScript?.end(""); response.end(""); return;
  }
  if (request.url !== "/") { response.statusCode = 404; response.end(""); return; }
  fixtureReady = false;
  response.end(`<main>
    <section><iframe id="duplicate" src="same"></iframe></section>
    <aside><iframe id="duplicate" src="same"></iframe></aside>
    <iframe src="nested"></iframe>
    <div style="opacity:0"><iframe id="hidden" srcdoc='<p id="ad">카지노 가입</p>'></iframe></div>
    <iframe id="blank"></iframe>
    <div style="clip-path:inset(50%)"><iframe id="clipped" src="same"></iframe></div>
    <script>
      document.querySelector('#blank').contentDocument.body.innerHTML='<p id="ad">카지노 가입</p>';
      function countAds(doc) {
        return doc.querySelectorAll('#ad').length + [...doc.querySelectorAll('iframe')]
          .reduce((count, frame) => count + (frame.contentDocument ? countAds(frame.contentDocument) : 0), 0);
      }
      let reported = false;
      function reportReady() {
        if (!reported && countAds(document) === 6) { reported = true; fetch('/fixture-ready'); }
      }
      for (const frame of document.querySelectorAll('iframe')) frame.addEventListener('load', reportReady);
      reportReady();
    </script>
    <!-- Defer gates DOMContentLoaded on actual fixture readiness, not elapsed time.
         Crawl's existing page timeout and afterAll connection cleanup bound it. -->
    <script defer src="/ready.js"></script>
  </main>`);
});
beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(async () => { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); });

it("resolves complete owner paths to the same occurrence, including duplicate, nested, relative, srcdoc and blank frames", async () => {
  const locations: string[] = [];
  const sources: string[] = [];
  await crawlSite({ entryUrl: base + "/", settleMs: 0, limits: { maxPages: 1, maxDepth: 0, timeoutSec: 30 },
    onLivePage: async (page, snapshot, frames) => {
      expect(snapshot.finalUrl).toBe(base + "/");
      for (const live of frames) {
        const original = await live.frame.$("#ad");
        if (!original) continue;
        const identity = `${locations.length}`;
        await original.evaluate((element, value) => element.setAttribute("data-observed-identity", value), identity);
        const location = serializeFramePath({ framePath: live.srcChain.map((src, index) => ({ src, selector: live.selectorChain[index]! })), selector: "#ad" });
        const resolved = await resolveFrameLocation(page, location);
        expect(await resolved.getAttribute("data-observed-identity")).toBe(identity);
        await resolved.dispose(); await original.dispose();
        locations.push(location); sources.push(live.frame.url());
        if (live.selectorChain.includes("#hidden") || live.selectorChain.includes("#clipped")) {
          const [signal] = await live.frame.evaluate(collectElementSignals, { inputs: [{ selector: "#ad", rawText: "카지노 가입" }], frameVisibility: live.visibilityContext, limits: SCAN_POLICY.visibility });
          expect(signal?.transparent, location).toBe(live.selectorChain.includes("#hidden"));
          expect(signal?.offscreen, location).toBe(live.selectorChain.includes("#clipped"));
        }
      }
      await expect(resolveFrameLocation(page, 'iframe >>> #ad')).rejects.toThrow("ambiguous");
    } });
  expect(locations).toHaveLength(6);
  expect(new Set(locations).size).toBe(6);
  expect(sources).toContain("about:srcdoc"); expect(sources).toContain("about:blank");
  expect(locations.some((location) => location.split(" >>> ").length === 3)).toBe(true);
});
