import { createServer, type Server } from "node:http";
import { performance } from "node:perf_hooks";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { validateOfficialResultText, validateScanDetailBundle } from "@krds-detector/contracts";
import { scanSite } from "../src/scan.js";

let server: Server;
let origin = "";
const requests: string[] = [];

beforeAll(async () => {
  server = createServer((request, response) => {
    const path = new URL(request.url ?? "/", "http://fixture.local").pathname;
    requests.push(path);
    response.setHeader("content-type", "text/html; charset=utf-8");
    if (path === "/") {
      response.end('<a href="/a-fast">fast</a><a href="/b-slow">slow</a><a href="/c-late">late</a>');
    } else if (path === "/a-fast") {
      response.end('<p id="ad" style="display:none">카지노 첫충 보너스 지급</p>');
    } else if (path === "/b-slow") {
      setTimeout(() => { if (!response.destroyed) response.end("<p>slow</p>"); }, 6_000);
    } else if (path === "/missing") {
      response.statusCode = 404;
      response.end("<p>missing</p>");
    } else {
      response.end("<p>late</p>");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture port unavailable");
  origin = `http://127.0.0.1:${String(address.port)}`;
});
afterAll(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); });

describe("L3 global deadline settlement", () => {
  it("fails when every attempted page fails", async () => {
    const stages: string[] = [];
    await expect(scanSite({
      entryUrl: `${origin}/missing`,
      crawl: { concurrency: 1, settleMs: 0, perPageMs: 5_000,
        limits: { maxPages: 1, maxDepth: 0, timeoutSec: 10 } },
      onEvent: (event) => {
        if (["session-started", "session-failed"].includes(event.kind)) stages.push(event.progress.stage);
      },
    })).rejects.toThrow("no successfully analyzed pages");
    expect(stages).toEqual(["running", "failed"]);
  }, 15_000);

  it("fails without requesting a page when the deadline cannot admit work", async () => {
    const before = requests.length;
    await expect(scanSite({
      entryUrl: `${origin}/`,
      crawl: { concurrency: 1, settleMs: 0, perPageMs: 5_000,
        limits: { maxPages: 1, maxDepth: 0, timeoutSec: 1 } },
    })).rejects.toThrow("no successfully analyzed pages");
    expect(requests.length).toBe(before);
  }, 15_000);

  it("retains completed findings and does not admit another page inside the reserve", async () => {
    const started = performance.now();
    const output = await scanSite({
      entryUrl: `${origin}/`,
      crawl: { concurrency: 1, settleMs: 0, perPageMs: 4_500,
        limits: { maxPages: 4, maxDepth: 1, timeoutSec: 6 } },
    });
    const wallMs = performance.now() - started;
    expect(requests).toContain("/a-fast");
    expect(requests).toContain("/b-slow");
    expect(requests).not.toContain("/c-late");
    expect(output.timedOut).toBe(true);
    expect(output.pagesVisited).toBe(3);
    expect(output.failedPages).toBe(1);
    expect(output.detailBundle.coverage.failedPages.map((page) => [new URL(page.url).pathname, page.status, page.reason]))
      .toEqual([["/b-slow", 0, "navigation-or-analysis-failed"]]);
    expect(output.result.findings.map((finding) => [new URL(finding.url).pathname, finding.location, finding.technique]))
      .toEqual([["/a-fast", "#ad", "OFFSCREEN"]]);
    expect(validateOfficialResultText(output.json).ok).toBe(true);
    expect(validateScanDetailBundle(output.detailBundle, output.result, output.extraResult).ok).toBe(true);
    expect(wallMs).toBeLessThan(10_000);
  }, 20_000);
});
