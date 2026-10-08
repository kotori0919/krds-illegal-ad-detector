import { createServer } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crawlSite } from "../src/crawl.js";
import { isPublicAddress, PublicNetworkPolicy, startPublicNetworkProxy } from "../src/public-network.js";
import { ScanDeadline } from "../src/deadline.js";
import { scanSite } from "../../detection/src/scan.js";
import { request as httpRequest } from "node:http";

let origin = "";
let protectedOrigin = "";
const requests: string[] = [];
let protectedConnections = 0;
const protectedServer = createServer((_req, res) => res.end("private target"));
protectedServer.on("connection", () => { protectedConnections += 1; });
const server = createServer((req, res) => {
  const path = req.url ?? "/";
  requests.push(path);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  if (path === "/robots.txt" || path === "/sitemap.xml") { res.statusCode = 404; return res.end(); }
  if (path === "/redirect") { res.writeHead(302, { Location: protectedOrigin }); return res.end(); }
  if (path === "/https-redirect") { res.writeHead(302, { Location: protectedOrigin.replace("http:", "https:") }); return res.end(); }
  if (path === "/input-index.xml") { res.setHeader("Content-Type", "text/xml"); return res.end(`<sitemapindex><sitemap><loc>${origin}/nested.xml</loc></sitemap></sitemapindex>`); }
  if (path === "/nested.xml") { res.setHeader("Content-Type", "text/xml"); return res.end(`<urlset><url><loc>${origin}/listed-b</loc></url><url><loc>${origin}/listed-a</loc></url></urlset>`); }
  if (path.startsWith("/listed-")) return res.end('<title>Owned site</title><p id="offer" style="opacity:0">카지노 가입 보너스 지급</p>');
  res.end(`<title>Owned public fixture</title><img src="${protectedOrigin}/image"><iframe src="${protectedOrigin}/frame"></iframe><script>fetch('${protectedOrigin}/fetch').catch(()=>{});fetch('${protectedOrigin.replace("http:", "https:")}/secure').catch(()=>{});fetch('${protectedOrigin.replace("127.0.0.1", "localhost")}/named').catch(()=>{});fetch('${protectedOrigin.replace("127.0.0.1", "[::ffff:127.0.0.1]")}/mapped').catch(()=>{});</script>`);
});
beforeAll(async () => {
  await new Promise<void>((resolve) => protectedServer.listen(0, "127.0.0.1", resolve));
  protectedOrigin = `http://127.0.0.1:${(protectedServer.address() as { port: number }).port}`;
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(async () => { await Promise.all([server, protectedServer].map(async (s) => {
  s.closeAllConnections(); await new Promise<void>((resolve) => s.close(() => resolve()));
})); });

describe("public-only runtime navigation", () => {
  it("rejects imported loopback before any crawler or discovery connection", async () => {
    requests.length = 0;
    await expect(crawlSite({ entryUrl: origin, publicNetworkOnly: true,
      limits: { maxPages: 1, maxDepth: 0, timeoutSec: 30 }, settleMs: 0 })).rejects.toThrow(/public network/i);
    expect(requests).toEqual([]);
  }, 30000);
  it("pins explicit fixture DNS-like origins without authorizing another host or port", async () => {
    const port = new URL(origin).port;
    const fixtureOrigin = `http://first.fixture.invalid:${port}`;
    const policy = PublicNetworkPolicy.forFixtureTargets([{ origin: fixtureOrigin, address: "127.0.0.1" }]);
    expect((await policy.fetch(fixtureOrigin + "/listed-a")).status).toBe(200);
    await expect(policy.fetch(`http://second.fixture.invalid:${port}/`)).rejects.toThrow();
    await expect(policy.fetch(`http://127.0.0.1:${port}/`)).rejects.toThrow(/public network/i);
    await expect(policy.fetch(fixtureOrigin.replace(port, new URL(protectedOrigin).port))).rejects.toThrow();
    const summary = await crawlSite({ entryUrl: fixtureOrigin + "/listed-a", publicNetworkOnly: true,
      networkPolicyForTesting: policy, settleMs: 0, limits: { maxPages: 1, maxDepth: 0, timeoutSec: 30 } });
    expect(summary.pages.map((page) => [page.finalUrl, page.status, page.issue])).toEqual([[fixtureOrigin + "/listed-a", 200, undefined]]);
  }, 30000);
  it("rejects actual navigation after an initially public DNS answer rebinds to loopback", async () => {
    protectedConnections = 0;
    let lookups = 0;
    const policy = new PublicNetworkPolicy(async () => [{ address: ++lookups === 1 ? "8.8.8.8" : "127.0.0.1", family: 4 }]);
    const summary = await crawlSite({ entryUrl: `http://rebinding.fixture.invalid:${new URL(protectedOrigin).port}/`,
      publicNetworkOnly: true, networkPolicyForTesting: policy, settleMs: 0,
      limits: { maxPages: 1, maxDepth: 0, timeoutSec: 30 } });
    expect(summary.pages[0]?.issue?.kind).toBe("denied");
    expect(lookups).toBeGreaterThanOrEqual(3);
    expect(protectedConnections).toBe(0);
  }, 30000);
  it("routes actual Chromium HTTP/HTTPS subresources and redirects through the enforcing proxy", async () => {
    protectedConnections = 0;
    const policy = PublicNetworkPolicy.forFixtureOrigins([origin]);
    const summary = await crawlSite({ entryUrl: origin, publicNetworkOnly: true, networkPolicyForTesting: policy,
      limits: { maxPages: 1, maxDepth: 0, timeoutSec: 30 }, settleMs: 300 });
    expect(summary.pages[0]?.status).toBe(200);
    expect(summary.pages[0]?.issue).toBeUndefined();
    for (const path of ["/redirect", "/https-redirect"]) {
      const redirected = await crawlSite({ entryUrl: origin + path, publicNetworkOnly: true, networkPolicyForTesting: policy,
        limits: { maxPages: 1, maxDepth: 0, timeoutSec: 30 }, settleMs: 0 });
      expect(redirected.pages[0]?.issue).toBeDefined();
    }
    expect(protectedConnections).toBe(0);
  }, 60000);
  it("scans exact sitemap-index input pages with original official metadata and no XML checked page", async () => {
    requests.length = 0;
    const entryUrl = origin + "/input-index.xml";
    const output = await scanSite({ entryUrl, crawl: { publicNetworkOnly: true, entryKind: "sitemap",
      networkPolicyForTesting: PublicNetworkPolicy.forFixtureOrigins([origin]), settleMs: 0,
      limits: { maxPages: 2, maxDepth: 0, timeoutSec: 30 } } });
    expect(output.result.meta.entry_url).toBe(entryUrl);
    expect(output.detailBundle.coverage.checkedPages).toBe(2);
    expect(output.detailBundle.pageOutcomes?.map((page) => [new URL(page.url).pathname, page.depth, page.discoverySource]))
      .toEqual([["/listed-a", 0, "sitemap"], ["/listed-b", 0, "sitemap"]]);
    expect(output.result.findings.map((finding) => new URL(finding.url).pathname)).toEqual(["/listed-a", "/listed-b"]);
    expect(requests.filter((path) => path === "/input-index.xml")).toHaveLength(1);
  }, 30000);
});

describe("public address and DNS boundaries", () => {
  it("rejects private, metadata, mapped IPv6, transition and reserved literals", async () => {
    for (const address of ["0.0.0.0", "10.1.2.3", "100.100.100.200", "127.0.0.1", "169.254.169.254", "172.31.2.3", "192.168.1.1", "192.0.2.1", "198.18.0.1", "224.0.0.1", "::1", "::ffff:127.0.0.1", "::ffff:8.8.8.8", "fc00::1", "fe80::1", "64:ff9b::7f00:1", "2002:7f00:1::", "2001:db8::1"]) {
      expect(isPublicAddress(address), address).toBe(false);
      await expect(new PublicNetworkPolicy().resolveTarget(`http://${address.includes(":") ? `[${address}]` : address}/`)).rejects.toThrow(/public network/i);
    }
    expect(isPublicAddress("8.8.8.8")).toBe(true);
    expect(isPublicAddress("2606:4700:4700::1111")).toBe(true);
  });
  it("rejects mixed safe/private DNS answers and reevaluates rebinding before every new connection", async () => {
    const mixed = new PublicNetworkPolicy(async () => [{ address: "8.8.8.8", family: 4 }, { address: "127.0.0.1", family: 4 }]);
    await expect(mixed.resolveTarget("http://fixture.example/")).rejects.toThrow(/public network/i);
    let lookups = 0;
    const rebound = new PublicNetworkPolicy(async () => {
      lookups += 1;
      return [{ address: lookups === 1 ? "8.8.8.8" : "127.0.0.1", family: 4 }];
    });
    expect((await rebound.resolveTarget("http://fixture.example/")).address).toBe("8.8.8.8");
    const before = protectedConnections;
    await expect(rebound.fetch(`http://fixture.example:${new URL(protectedOrigin).port}/`)).rejects.toThrow(/public network/i);
    expect(lookups).toBe(2);
    expect(protectedConnections).toBe(before);
  });
  it("requires proxy authentication and closes the listener on cancellation", async () => {
    const controller = new AbortController();
    const proxy = await startPublicNetworkProxy(PublicNetworkPolicy.forFixtureOrigins([origin]), new ScanDeadline(30), controller.signal);
    const status = await new Promise<number>((resolve, reject) => {
      const req = httpRequest(proxy.proxy.server, { path: origin }, (response) => { response.resume(); resolve(response.statusCode ?? 0); });
      req.on("error", reject); req.end();
    });
    expect(status).toBe(407);
    controller.abort();
    await proxy.close();
    await expect(fetch(proxy.proxy.server)).rejects.toThrow();
  });
});
