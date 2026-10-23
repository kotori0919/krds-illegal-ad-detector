import { createServer } from "node:http";
import { expect, it } from "vitest";
import { crawlSite } from "../src/crawl.js";
import { retryAfterMs } from "../src/access.js";

it("preserves server seconds and HTTP dates instead of shortening them", () => {
  expect(retryAfterMs("120")).toBe(120_000);
  expect(retryAfterMs("Thu, 01 Jan 1970 00:02:00 GMT", 0)).toBe(120_000);
  expect(retryAfterMs("garbage")).toBeUndefined();
  expect(retryAfterMs("-1")).toBeUndefined();
});

it("does not request a queued page when Retry-After exceeds the scan budget", async () => {
  const requests: string[] = [];
  const server = createServer((request, response) => {
    const path = request.url ?? "/"; requests.push(path);
    if (path === "/robots.txt" || path === "/sitemap.xml") { response.statusCode = 404; response.end(); return; }
    response.setHeader("content-type", "text/html");
    if (path === "/a-rate") { response.writeHead(429, { "Retry-After": "120" }); response.end(); return; }
    response.end('<a href="/a-rate">rate</a><a href="/z-after">later</a>');
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  try {
    const started = performance.now();
    const summary = await crawlSite({ entryUrl: base, limits: { maxPages: 3, maxDepth: 1, timeoutSec: 15 }, concurrency: 1, settleMs: 0 });
    expect(requests.filter((path) => path === "/a-rate")).toHaveLength(1);
    expect(requests).not.toContain("/z-after");
    expect(summary.pages.find((page) => page.url.endsWith("/a-rate"))?.issue?.retryAfterMs).toBe(120_000);
    expect(summary.timedOut).toBe(true);
    expect(performance.now() - started).toBeLessThan(5000);
  } finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
});

it("cancels an affordable server pause without admitting the next page", async () => {
  const controller = new AbortController();
  const requests: string[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  const server = createServer((request, response) => {
    const path = request.url ?? "/"; requests.push(path);
    if (path === "/robots.txt" || path === "/sitemap.xml") { response.statusCode = 404; response.end(); return; }
    if (path === "/a-rate") { response.writeHead(429, { "Retry-After": "5" }); response.end(); return; }
    response.end('<a href="/a-rate">rate</a><a href="/z-after">later</a>');
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const started = performance.now();
    const summary = await crawlSite({ entryUrl: `http://127.0.0.1:${(server.address() as { port: number }).port}`, signal: controller.signal,
      limits: { maxPages: 3, maxDepth: 1, timeoutSec: 30 }, concurrency: 1, settleMs: 0,
      events: { onPageVisited: (snapshot) => { if (snapshot.issue?.kind === "rate-limit") timer = setTimeout(() => controller.abort(), 50); } } });
    expect(summary.cancelled).toBe(true); expect(requests).not.toContain("/z-after");
    expect(performance.now() - started).toBeLessThan(2500);
  } finally { if (timer) clearTimeout(timer); server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
});
