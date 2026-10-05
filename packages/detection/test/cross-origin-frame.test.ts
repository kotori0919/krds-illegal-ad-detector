import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { validateOfficialResultText, validateScanDetailBundle } from "@krds-detector/contracts";
import { scanSite } from "../src/scan.js";

let siteServer: Server;
let frameServer: Server;
let siteOrigin = "";
let frameOrigin = "";
const siteRequests = new Map<string, number>();
const frameRequests = new Map<string, number>();

beforeAll(async () => {
  frameServer = createServer((request, response) => {
    const path = new URL(request.url ?? "/", "http://fixture.local").pathname;
    frameRequests.set(path, (frameRequests.get(path) ?? 0) + 1);
    response.setHeader("content-type", "text/html; charset=utf-8");
    if (path === "/outer") {
      response.end('<p id="ad-outer" style="display:none">카지노 첫충 보너스 지급</p><iframe id="inner" src="/inner"></iframe>');
    } else if (path === "/inner") {
      response.end('<p id="ad-inner">Ｃ카지노 신규가입</p>');
    } else {
      response.statusCode = 404;
      response.end();
    }
  });
  await new Promise<void>((resolve) => frameServer.listen(0, "127.0.0.1", resolve));
  const frameAddress = frameServer.address();
  if (!frameAddress || typeof frameAddress === "string") throw new Error("frame port unavailable");
  frameOrigin = `http://127.0.0.1:${String(frameAddress.port)}`;

  siteServer = createServer((request, response) => {
    const path = new URL(request.url ?? "/", "http://fixture.local").pathname;
    siteRequests.set(path, (siteRequests.get(path) ?? 0) + 1);
    response.setHeader("content-type", "text/html; charset=utf-8");
    response.end(`<iframe id="outer" src="${frameOrigin}/outer"></iframe>`);
  });
  await new Promise<void>((resolve) => siteServer.listen(0, "127.0.0.1", resolve));
  const siteAddress = siteServer.address();
  if (!siteAddress || typeof siteAddress === "string") throw new Error("site port unavailable");
  siteOrigin = `http://127.0.0.1:${String(siteAddress.port)}`;
});
afterAll(async () => {
  await Promise.all([
    new Promise<void>((resolve) => siteServer.close(() => resolve())),
    new Promise<void>((resolve) => frameServer.close(() => resolve())),
  ]);
});

describe("L3 live cross-origin frames", () => {
  it("analyzes nested live Frames once with absolute official paths and a depth bound", async () => {
    for (const maxFrameDepth of [2, 1]) {
      siteRequests.clear();
      frameRequests.clear();
      const output = await scanSite({
        entryUrl: `${siteOrigin}/`,
        crawl: { concurrency: 2, settleMs: 800, perPageMs: 8_000,
          limits: { maxPages: 1, maxDepth: 0, maxFrameDepth, timeoutSec: 30 } },
      });
      expect(output.pagesVisited).toBe(1);
      expect(output.failedPages).toBe(0);
      expect(siteRequests.get("/")).toBe(1);
      expect(frameRequests.get("/outer")).toBe(1);
      expect(frameRequests.get("/inner")).toBe(1);
      const outerPath = `iframe[src="${frameOrigin}/outer"] >>> #ad-outer`;
      const innerPath = `iframe[src="${frameOrigin}/outer"] >>> iframe[src="${frameOrigin}/inner"] >>> #ad-inner`;
      const expected = maxFrameDepth === 2
        ? [`${frameOrigin}/outer\0${outerPath}\0OFFSCREEN`, `${frameOrigin}/inner\0${innerPath}\0HOMOGLYPH`]
        : [`${frameOrigin}/outer\0${outerPath}\0OFFSCREEN`];
      const actual = output.result.findings.map((finding) => `${finding.url}\0${finding.location}\0${finding.technique}`).sort();
      expect(actual).toEqual(expected.sort());
      expect(validateOfficialResultText(output.json).ok).toBe(true);
      expect(validateScanDetailBundle(output.detailBundle, output.result).ok).toBe(true);
    }
  }, 30_000);
});
