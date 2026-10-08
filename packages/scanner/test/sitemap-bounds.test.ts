import { createServer } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { discoverSitemaps, SITEMAP_LIMITS } from "../src/sitemap.js";
import { ScanDeadline } from "../src/deadline.js";

let origin = "";
let scenario = "";
const requests: string[] = [];
const urlset = (paths: string[]): string => `<urlset>${paths.map((path) => `<url><loc>${origin}${path}</loc></url>`).join("")}</urlset>`;
const index = (paths: string[]): string => `<sitemapindex>${paths.map((path) => `<sitemap><loc>${origin}${path}</loc></sitemap>`).join("")}</sitemapindex>`;
const server = createServer((req, res) => {
  const path = req.url ?? "/";
  requests.push(path);
  res.setHeader("Content-Type", "text/xml; charset=utf-8");
  if (path === "/robots.txt" && scenario === "encoded") return res.end(`User-agent: *\nDisallow: /encoded/%7eprivate\nDisallow: /a*b*c$\nSitemap: ${origin}/index.xml`);
  if (path === "/robots.txt") return res.end(`User-agent: *\nDisallow: /blocked\nUser-agent: KrdsDetector\nDisallow: /specific\nSitemap: ${origin}/index.xml`);
  if (path === "/sitemap.xml") return res.end(urlset([]));
  if (scenario === "count") {
    if (path === "/index.xml") return res.end(index(Array.from({ length: 20 }, (_, i) => `/maps/${String(i).padStart(2, "0")}.xml`)));
    return res.end(urlset([`/page-${path.split("/").pop()}`]));
  }
  if (scenario === "depth") {
    const depth = path === "/index.xml" ? 0 : Number(path.match(/\d+/)?.[0]);
    return res.end(index([`/depth-${depth + 1}.xml`]));
  }
  if (scenario === "urls") return res.end(urlset(Array.from({ length: 1500 }, (_, i) => `/page-${String(i).padStart(4, "0")}`)));
  if (scenario === "oversize") { res.write(urlset(["/too-large"])); return res.end(`<!--${"x".repeat(SITEMAP_LIMITS.documentBytes)}-->`); }
  if (scenario === "total") {
    if (path === "/index.xml") return res.end(index(Array.from({ length: 8 }, (_, i) => `/maps/${i}.xml`)));
    return res.end(`${urlset([`/page-${path.split("/").pop()}`])}<!--${"x".repeat(400 * 1024)}-->`);
  }
  if (scenario === "slow") { const timer = setTimeout(() => res.end(urlset(["/too-late"])), 4000); res.on("close", () => clearTimeout(timer)); return; }
  if (scenario === "encoded") return res.end(urlset(["/encoded/~private", "/aXXbYYc", "/aXXbYYcd"]));
  if (scenario === "roots") return res.end(`${urlset(["/malformed-root-page"])}<extra/>`);
  return res.end(urlset(["/blocked", "/specific", "/allowed"]));
});
beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(async () => { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); });
async function discover(name: string, signal?: AbortSignal) {
  scenario = name; requests.length = 0;
  return discoverSitemaps(origin, new ScanDeadline(30), signal);
}

describe("sitemap resource boundaries", () => {
  it("uses the matching user-agent group instead of wildcard exclusions", async () => {
    const found = await discover("robots");
    expect(found.urls).toEqual([origin + "/allowed", origin + "/blocked"]);
    expect(found.allows(origin + "/specific")).toBe(false);
  });
  it("matches normalized octets, wildcard rules and end anchors", async () => {
    const found = await discover("encoded");
    expect(found.urls).toEqual([origin + "/aXXbYYcd"]);
  });
  it("rejects multiple XML document roots", async () => {
    expect((await discover("roots")).urls).toEqual([]);
  });
  it("caps index documents and index recursion separately", async () => {
    const found = await discover("count");
    expect(requests.filter((path) => path !== "/robots.txt")).toHaveLength(8);
    expect(found.urls).toHaveLength(6);
    await discover("depth");
    expect(requests).toEqual(["/robots.txt", "/index.xml", "/sitemap.xml", "/depth-1.xml", "/depth-2.xml"]);
  });
  it("admits only the first 1,000 sorted canonical URLs", async () => {
    const found = await discover("urls");
    expect(found.urls).toHaveLength(1000);
    expect(found.urls[0]).toBe(origin + "/page-0000");
    expect(found.urls[999]).toBe(origin + "/page-0999");
  });
  it("rejects a streamed oversized document and stops at the total byte budget", async () => {
    expect((await discover("oversize")).urls).toEqual([]);
    const found = await discover("total");
    expect(found.urls).toHaveLength(5);
    expect(requests.filter((path) => path.startsWith("/maps/"))).toHaveLength(6);
  });
  it("bounds slow HTTP discovery and reacts to cancellation", async () => {
    const started = performance.now();
    expect((await discover("slow")).urls).toEqual([]);
    expect(performance.now() - started).toBeLessThan(3000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 100);
    const cancelledAt = performance.now();
    try { expect((await discover("slow", controller.signal)).urls).toEqual([]); }
    finally { clearTimeout(timer); }
    expect(performance.now() - cancelledAt).toBeLessThan(1000);
    scenario = "slow";
    const deadlineAt = performance.now();
    expect((await discoverSitemaps(origin, new ScanDeadline(1))).urls).toEqual([]);
    expect(performance.now() - deadlineAt).toBeLessThan(1400);
  }, 10000);
});
