import { createServer, type ServerResponse } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crawlSite } from "../src/crawl.js";

let base = "";
let externalBase = "";
const requests: { path: string; at: number }[] = [];
let externalRequests = 0;
const xml = (res: ServerResponse, body: string): void => { res.setHeader("Content-Type", "application/xml"); res.end(body); };
const urlset = (paths: string[]): string => `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((path) => `<url><loc>${base}${path}</loc></url>`).join("")}</urlset>`;
const index = (paths: string[]): string => `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((path) => `<sitemap><loc>${path.startsWith("http") ? path : base + path}</loc></sitemap>`).join("")}</sitemapindex>`;
const external = createServer((_req, res) => { externalRequests += 1; res.end("external"); });
const server = createServer((req, res) => {
  const path = req.url ?? "/";
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  requests.push({ path, at: performance.now() });
  if (path === "/robots.txt") return res.end(`User-agent: *\nDisallow: /private\nAllow: /private/public\nSitemap: ${base}/maps/root.xml\nSitemap: ${externalBase}/external.xml`);
  if (path === "/sitemap.xml") return xml(res, urlset(["/z-map", "/private/secret", "/private/public"]));
  if (path === "/maps/root.xml") return xml(res, index(["/maps/nested.xml", "/maps/root.xml", "/maps/bad.xml", "/maps/entities.xml", "/maps/redirect.xml", externalBase + "/map.xml"]));
  if (path === "/maps/nested.xml") return xml(res, index(["/maps/pages.xml", "/maps/root.xml"]));
  if (path === "/maps/pages.xml") return xml(res, urlset(["/a-map", "/z-map", "/board?a=1&amp;b=2"]));
  if (path === "/maps/bad.xml") return xml(res, `<urlset><url><loc>${base}/bad-page</loc></url>`);
  if (path === "/maps/entities.xml") return xml(res, `<!DOCTYPE urlset [<!ENTITY bad "${base}/entity-page">]><urlset><url><loc>&bad;</loc></url></urlset>`);
  if (path === "/maps/redirect.xml") { res.writeHead(302, { Location: `${externalBase}/redirect.xml` }); return res.end(); }
  if (path === "/challenge") { res.writeHead(403, { "cf-mitigated": "challenge", Server: "cloudflare" }); return res.end("<title>Forbidden</title><a href='/challenge-child'>next</a>"); }
  if (path === "/challenge200") { res.writeHead(200, { "cf-mitigated": "challenge" }); return res.end("<title>Public page</title>"); }
  if (path === "/challenge-body") return res.end("<title>Just a moment...</title><div id='challenge-running'>Verify you are human</div>");
  if (path === "/challenge-body403") { res.statusCode = 403; return res.end("<title>Just a moment...</title><form id='challenge-form'>Verify you are human</form>"); }
  if (path === "/proxied") { res.setHeader("Server", "cloudflare"); res.setHeader("cf-ray", "fixture"); return res.end("<title>Public service</title><h1>Public service</h1>"); }
  if (path === "/denied") { res.statusCode = 403; return res.end("Forbidden"); }
  if (path === "/rate") { res.writeHead(429, { "Retry-After": "999999999" }); return res.end("Too many requests"); }
  if (path === "/rate-short") { res.writeHead(429, { "Retry-After": "1" }); return res.end("Too many requests"); }
  if (path === "/login") return res.end("<title>로그인</title><form><input type='password'><button>로그인</button></form>");
  if (path === "/redirect-login") { res.writeHead(302, { Location: "/login" }); return res.end(); }
  if (path === "/timeout") { const timer = setTimeout(() => res.end("late"), 2500); res.on("close", () => clearTimeout(timer)); return; }
  if (path === "/navigation") { req.socket.destroy(); return; }
  if (path === "/ordered") return res.end("<a href='/zz-link'>Z</a><a href='/ab-link'>B</a><a href='/aa-link'>A</a><a href='/private/secret'>private</a>");
  if (path === "/rates") return res.end("<a href='/rate-short'>rate</a><a href='/zz-after-rate'>later</a>");
  res.end(`<title>Public ${path}</title><p>Public content</p>`);
});

beforeAll(async () => {
  await new Promise<void>((resolve) => external.listen(0, "127.0.0.1", resolve));
  externalBase = `http://127.0.0.1:${(external.address() as { port: number }).port}`;
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(async () => { await Promise.all([server, external].map((s) => new Promise<void>((resolve, reject) => s.close((error) => error ? reject(error) : resolve())))); });

describe("typed access outcomes on real navigation", () => {
  it("classifies challenge headers before status and leaves ordinary proxy pages inspectable", async () => {
    for (const [path, kind] of [["/challenge", "challenge"], ["/challenge200", "challenge"], ["/challenge-body", "challenge"], ["/challenge-body403", "challenge"], ["/denied", "denied"], ["/redirect-login", "login-required"], ["/rate", "rate-limit"], ["/proxied", undefined]] as const) {
      const inspected: string[] = [];
      const summary = await crawlSite({ entryUrl: base + path, limits: { maxPages: 1, maxDepth: 0, timeoutSec: 30 }, settleMs: 0,
        onLivePage: async (_page, snapshot) => { inspected.push(snapshot.url); } });
      expect(summary.pages[0]?.issue?.kind, path).toBe(kind);
      expect(inspected, path).toEqual(kind ? [] : [base + path]);
      expect(summary.pages[0]?.discoverySource).toBe("entry");
      if (path === "/rate") expect(summary.pages[0]?.issue?.retryAfterMs).toBe(5000);
    }
  }, 60000);

  it("reports navigation failure and timeout without inspecting either failed document", async () => {
    for (const [path, kind] of [["/timeout", "timeout"], ["/navigation", "navigation"]] as const) {
      const inspected: string[] = [];
      const summary = await crawlSite({ entryUrl: base + path, limits: { maxPages: 1, maxDepth: 0, timeoutSec: 30 }, perPageMs: 1200, settleMs: 0,
        onLivePage: async (_page, snapshot) => { inspected.push(snapshot.url); } });
      expect(summary.pages[0]?.issue?.kind).toBe(kind);
      expect(inspected).toEqual([]);
    }
  }, 30000);

  it("honors a Retry-After before the next queued page without retrying the rate-limited URL", async () => {
    const start = requests.length;
    await crawlSite({ entryUrl: base + "/rates", limits: { maxPages: 20, maxDepth: 1, timeoutSec: 30 }, concurrency: 1, settleMs: 0 });
    const seen = requests.slice(start);
    const rate = seen.filter((r) => r.path === "/rate-short");
    expect(rate).toHaveLength(1);
    const later = seen.find((r) => r.path === "/zz-after-rate");
    expect(later?.at).toBeGreaterThanOrEqual(rate[0]!.at + 950);
  }, 30000);
});

describe("bounded sitemap discovery on real HTTP fixtures", () => {
  it("merges links and nested sitemap pages deterministically while excluding hostile/external/private inputs", async () => {
    const sets: string[][] = [];
    for (const concurrency of [1, 4]) {
      const start = requests.length;
      const summary = await crawlSite({ entryUrl: base + "/ordered", limits: { maxPages: 7, maxDepth: 1, timeoutSec: 30 }, concurrency, settleMs: 0 });
      sets.push(summary.pages.map((page) => page.url));
      expect(summary.pages.map((page) => [new URL(page.url).pathname, page.discoverySource])).toEqual([
        ["/ordered", "entry"], ["/a-map", "sitemap"], ["/aa-link", "link"], ["/ab-link", "link"], ["/board", "sitemap"], ["/private/public", "sitemap"], ["/z-map", "sitemap"],
      ]);
      const seen = requests.slice(start).map((r) => r.path);
      expect(seen.filter((path) => path === "/maps/root.xml")).toHaveLength(1);
      expect(seen).not.toContain("/private/secret");
      expect(seen).not.toContain("/bad-page");
      expect(seen).not.toContain("/entity-page");
    }
    expect(sets[0]).toEqual(sets[1]);
    expect(externalRequests).toBe(0);
  }, 60000);

  it("does not add sitemap pages when depth is zero or the page bound is exhausted", async () => {
    const summary = await crawlSite({ entryUrl: base + "/ordered", limits: { maxPages: 1, maxDepth: 0, timeoutSec: 30 }, settleMs: 0 });
    expect(summary.pages.map((page) => page.url)).toEqual([base + "/ordered"]);
  }, 30000);
});
