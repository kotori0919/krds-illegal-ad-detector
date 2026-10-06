import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { scanSite } from "../src/scan.js";
import type { ScanEvent } from "@krds-detector/contracts";

const counts = new Map<string, number>();
let server: Server;
let origin = "";

beforeAll(async () => {
  server = createServer((request, response) => {
    const path = request.url ?? "/";
    counts.set(path, (counts.get(path) ?? 0) + 1);
    if (path === "/redirect-frame") {
      response.writeHead(302, { location: "/frame" });
      response.end();
      return;
    }
    const pages: Record<string, string> = {
      "/": '<a href="/d">D</a><a href="/c">C</a><a href="/b">B</a><a href="/a">A</a>',
      "/a": '<div id="ad-a">Ｃ카지노 가입</div><iframe id="frame-x" src="/redirect-frame"></iframe>',
      "/b": '<div id="ad-b">Ｂ바카라 가입</div><iframe id="frame-x" src="/redirect-frame"></iframe>',
      "/frame": '<div id="ad-frame">Ｄ대출 승인</div>',
      "/c": '<div id="ad-c">Ｅ카지노 가입</div>',
      "/d": '<div id="ad-d">Ｆ카지노 가입</div>',
    };
    const body = pages[path];
    if (!body) { response.writeHead(404); response.end(); return; }
    const delay = path === "/a" ? 150 : path === "/b" ? 10 : 0;
    setTimeout(() => {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(`<!doctype html><html lang="ko"><body>${body}</body></html>`);
    }, delay);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture port unavailable");
  origin = `http://127.0.0.1:${String(address.port)}`;
});

afterAll(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); });

describe("single-pass live-page processing", () => {
  it("navigates each page and iframe once while preserving findings across worker counts", async () => {
    const sets: string[][] = [];
    for (const concurrency of [1, 4]) {
      counts.clear();
      const confirmed: number[] = [];
      const events: ScanEvent[] = [];
      const output = await scanSite({
        entryUrl: `${origin}/`,
        onEvent: (event) => { confirmed.push(event.progress.confirmedFindings); events.push(event); },
        crawl: { concurrency, settleMs: 300, perPageMs: 5000, limits: { maxPages: 3, maxDepth: 1, timeoutSec: 60 } },
      });
      expect(output.pagesVisited).toBe(3);
      expect(output.failedPages).toBe(0);
      expect(output.result.findings).toHaveLength(3);
      for (const path of ["/", "/a", "/b"]) expect(counts.get(path)).toBe(1);
      for (const path of ["/redirect-frame", "/frame"]) expect(counts.get(path)).toBe(2);
      expect(Math.max(...confirmed)).toBe(output.result.findings.length);
      expect(events.map((event) => event.progress.sequence)).toEqual(events.map((_, index) => index + 1));
      expect(Math.max(...events.map((event) => event.progress.currentPages.length))).toBe(concurrency === 1 ? 1 : 2);
      const started = events.filter((event) => event.kind === "page-started");
      expect(started.map((event) => event.pageUrl).sort()).toEqual([`${origin}/`, `${origin}/a`, `${origin}/b`]);
      for (const event of started) expect(event.progress.currentPages).toContain(event.pageUrl);
      for (const event of events.filter((event) => event.kind === "page-visited")) {
        expect(event.progress.currentPages).not.toContain(event.pageUrl);
      }
      expect(events.at(-1)?.progress.currentPages).toEqual([]);
      expect(events.at(-1)?.progress.failedPages).toBe(0);
      expect(counts.has("/c")).toBe(false);
      expect(counts.has("/d")).toBe(false);
      expect(output.result.findings.some((finding) => finding.location.includes(">>>") && finding.url.endsWith("/frame"))).toBe(true);
      const frameFinding = output.result.findings.find((finding) => finding.url.endsWith("/frame"));
      expect(frameFinding?.location).toContain(`iframe[src="${origin}/redirect-frame"]`);
      sets.push(output.result.findings.map((finding) => `${finding.id}|${finding.url}|${finding.location}|${finding.technique}`));
    }
    expect(sets[1]).toEqual(sets[0]);
  }, 30_000);
});
