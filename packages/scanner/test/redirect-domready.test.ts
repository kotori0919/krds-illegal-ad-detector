import { createServer, type Server } from "node:http";
import { describe, expect, it } from "vitest";
import { crawlSite } from "../src/crawl.js";
import { PublicNetworkPolicy } from "../src/public-network.js";

type Trigger = "domready" | "onload" | "meta-same" | "meta-external" | "two-hops" | "loop" | "stalled" | "hanging-image" | "history";

function makeServer(trigger: Trigger, externalOrigin = "", landedStatus = 200) {
  const server = createServer((req, res) => {
    if (req.url === "/robots.txt" || req.url === "/sitemap.xml") {
      res.statusCode = 404;
      res.end();
      return;
    }
    if (req.url === "/stalled" || req.url === "/hanging.png") return;
    if (trigger === "loop") {
      const hop = Number(new URL(req.url ?? "/", "http://fixture.invalid").searchParams.get("hop") ?? 0);
      res.setHeader("content-type", "text/html");
      res.end(`<meta http-equiv="refresh" content="0; URL=/?hop=${hop + 1}">`);
      return;
    }
    if (req.url === "/landed") {
      res.statusCode = landedStatus;
      if (landedStatus === 429) res.setHeader("retry-after", "60");
      res.setHeader("content-type", "text/html");
      res.end(`<!doctype html><html><head><title>Landed</title></head><body><div style="display:none">hidden ad text</div><a href="/linked">follow link</a>${trigger === "hanging-image" ? '<img src="/hanging.png">' : ""}</body></html>`);
      return;
    }
    if (req.url === "/linked") {
      res.setHeader("content-type", "text/html");
      res.end("<!doctype html><html><body>linked page</body></html>");
      return;
    }
    res.setHeader("content-type", "text/html");
    if (trigger === "history") {
      res.end('<script>for (let i=0;i<8;i++) history.replaceState(null,"",`?step=${i}#section`)</script><p>same document</p>');
    } else if (trigger === "domready") {
      res.end('<!doctype html><html><head><script>document.addEventListener("DOMContentLoaded", function(){ window.location="/landed"; });</script></head><body>redirecting</body></html>');
    } else if (trigger === "onload") {
      res.end('<!doctype html><html><head><script>window.onload = function(){ window.location="/landed"; };</script></head><body>redirecting</body></html>');
    } else if (trigger === "meta-same" || trigger === "hanging-image" || (trigger === "two-hops" && req.url === "/middle")) {
      res.end('<!doctype html><html><head><meta http-equiv="refresh" content="0; URL=/landed"></head><body>redirecting</body></html>');
    } else if (trigger === "two-hops") {
      res.end('<meta http-equiv="refresh" content="0; URL=/middle">');
    } else if (trigger === "stalled") {
      res.end('<meta http-equiv="refresh" content="0; URL=/stalled">');
    } else {
      res.end(`<meta http-equiv="refresh" content="0; URL=${externalOrigin}/external">`);
    }
  });
  return server;
}

async function listen(server: Server) {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture address unavailable");
  return `http://127.0.0.1:${address.port}`;
}

async function close(server: Server) {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

describe("crawlSite client-side same-site redirect", () => {
  for (const trigger of ["domready", "onload", "meta-same", "two-hops"] as const) {
    it(`analyzes the final document for a ${trigger} redirect and follows the discovered link`, async () => {
      const server = makeServer(trigger);
      const origin = await listen(server);
      const liveCalls: { url: string; html: string }[] = [];
      try {
        const summary = await crawlSite({
          entryUrl: `${origin}/`,
          limits: { maxPages: 5, maxDepth: 1, timeoutSec: 60 },
          settleMs: 500,
          perPageMs: 15000,
          onLivePage: async (page) => {
            liveCalls.push({ url: page.url(), html: await page.content() });
          },
        });
        const entry = summary.pages.find((p) => p.url === `${origin}/`);
        expect(entry).toBeDefined();
        expect(entry?.issue).toBeUndefined();
        expect(entry?.finalUrl).toBe(`${origin}/landed`);

        const landedLive = liveCalls.filter((c) => c.url === `${origin}/landed`);
        expect(landedLive).toHaveLength(1);
        expect(landedLive[0].html).toContain("hidden ad text");
        expect(landedLive[0].html).toContain('href="/linked"');

        const linked = summary.pages.find((p) => p.url === `${origin}/linked`);
        expect(linked).toBeDefined();
        expect(linked?.issue).toBeUndefined();
        expect(linked?.depth).toBe(1);
        expect(summary.timedOut).toBe(false);
      } finally {
        await close(server);
      }
    }, 120000);
  }

  it("rejects an external-host meta-refresh redirect without invoking onLivePage", async () => {
    const external = createServer((_req, res) => res.end("external fixture"));
    const externalOrigin = await listen(external);
    const server = makeServer("meta-external", externalOrigin);
    const origin = await listen(server);
    const liveCalls: string[] = [];
    try {
      const summary = await crawlSite({
        entryUrl: `${origin}/`,
        networkPolicy: PublicNetworkPolicy.forFixtureOrigins([origin, externalOrigin]),
        limits: { maxPages: 5, maxDepth: 1, timeoutSec: 60 },
        settleMs: 500,
        perPageMs: 15000,
        onLivePage: async (page) => {
          liveCalls.push(page.url());
        },
      });
      const entry = summary.pages.find((p) => p.url === `${origin}/`);
      expect(entry).toBeDefined();
      expect(entry?.issue?.kind).toBe("navigation");
      expect(entry?.finalUrl).toBe(`${externalOrigin}/external`);
      expect(liveCalls).toHaveLength(0);
      expect(summary.timedOut).toBe(false);
    } finally {
      await Promise.all([close(server), close(external)]);
    }
  }, 120000);

  it("stops a document redirect loop as navigation failure before live analysis", async () => {
    const server = makeServer("loop");
    const origin = await listen(server);
    let liveCalls = 0;
    try {
      const summary = await crawlSite({ entryUrl: origin, limits: { maxPages: 1, maxDepth: 0, timeoutSec: 30 },
        settleMs: 500, perPageMs: 10000, onLivePage: async () => { liveCalls++; } });
      expect(summary.pages).toHaveLength(1);
      expect(summary.pages[0]?.issue).toEqual({ kind: "navigation", retryable: false });
      expect(summary.pages[0]?.failureReason).toBe("access-navigation");
      expect(liveCalls).toBe(0);
      expect(summary.pages[0]!.elapsedMs).toBeLessThan(5000);
      expect(summary.timedOut).toBe(false);
    } finally { await close(server); }
  }, 30000);

  it("does not count history and fragment updates as document replacements", async () => {
    const server = makeServer("history");
    const origin = await listen(server);
    let liveCalls = 0;
    try {
      const summary = await crawlSite({ entryUrl: origin, limits: { maxPages: 1, maxDepth: 0, timeoutSec: 30 },
        settleMs: 300, onLivePage: async (page) => {
          expect(await page.content()).toContain("same document");
          liveCalls++;
        } });
      expect(summary.pages[0]?.issue).toBeUndefined();
      expect(liveCalls).toBe(1);
    } finally { await close(server); }
  }, 30000);

  for (const [status, kind] of [[403, "denied"], [429, "rate-limit"], [503, "navigation"]] as const) {
    it(`classifies the final redirected response (${status}) instead of the entry 200`, async () => {
      const server = makeServer("meta-same", "", status);
      const origin = await listen(server);
      let liveCalls = 0;
      try {
        const summary = await crawlSite({ entryUrl: origin, limits: { maxPages: 1, maxDepth: 0, timeoutSec: 30 },
          settleMs: 500, onLivePage: async () => { liveCalls++; } });
        expect(summary.pages[0]?.finalUrl).toBe(`${origin}/landed`);
        expect(summary.pages[0]?.status).toBe(status);
        expect(summary.pages[0]?.issue?.kind).toBe(kind);
        if (status === 429) expect(summary.pages[0]?.issue?.retryAfterMs).toBe(60000);
        expect(liveCalls).toBe(0);
      } finally { await close(server); }
    }, 30000);
  }

  it("retains a page timeout during a stalled client redirect", async () => {
    const server = makeServer("stalled");
    const origin = await listen(server);
    let liveCalls = 0;
    try {
      const summary = await crawlSite({ entryUrl: origin, limits: { maxPages: 1, maxDepth: 0, timeoutSec: 30 },
        settleMs: 500, perPageMs: 1500, onLivePage: async () => { liveCalls++; } });
      expect(summary.pages[0]?.issue).toEqual({ kind: "timeout", retryable: true });
      expect(summary.pages[0]?.elapsedMs).toBeLessThan(5000);
      expect(liveCalls).toBe(0);
    } finally { await close(server); }
  }, 30000);

  it("analyzes a redirected document without waiting for a hanging image to load", async () => {
    const server = makeServer("hanging-image");
    const origin = await listen(server);
    const liveCalls: string[] = [];
    try {
      const summary = await crawlSite({ entryUrl: origin, limits: { maxPages: 1, maxDepth: 0, timeoutSec: 30 },
        settleMs: 300, perPageMs: 10000, onLivePage: async (page) => { liveCalls.push(page.url()); } });
      expect(summary.pages[0]?.issue).toBeUndefined();
      expect(summary.pages[0]?.finalUrl).toBe(`${origin}/landed`);
      expect(liveCalls).toEqual([`${origin}/landed`]);
      expect(summary.pages[0]!.elapsedMs).toBeLessThan(4000);
    } finally { await close(server); }
  }, 30000);

  it("does not repeat live analysis or keep stale links after navigation during the callback", async () => {
    const server = makeServer("meta-same");
    const origin = await listen(server);
    let liveCalls = 0;
    try {
      const summary = await crawlSite({ entryUrl: origin, limits: { maxPages: 5, maxDepth: 1, timeoutSec: 30 },
        settleMs: 300, onLivePage: async (page) => {
          liveCalls++;
          await page.goto(`${origin}/linked`);
        } });
      expect(liveCalls).toBe(1);
      expect(summary.pages).toHaveLength(1);
      expect(summary.pages[0]?.issue).toEqual({ kind: "navigation", retryable: false });
      expect(summary.pages[0]?.links).toEqual([]);
      expect(summary.pages[0]?.html).toBe("");
    } finally { await close(server); }
  }, 30000);
});
