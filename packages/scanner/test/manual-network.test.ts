import { createServer } from "node:http";
import { expect, it, vi } from "vitest";
import dns from "node:dns/promises";
import { syncBuiltinESMExports } from "node:module";
import { crawlSite } from "../src/crawl.js";
import { PublicNetworkPolicy } from "../src/public-network.js";
import { createConnectTransport } from "../src/pinned-transport.js";
import { createDirectTransport, type PinnedTransport } from "../src/pinned-transport.js";
import type { CrawlOptions } from "../src/crawl.js";
import { scanSite } from "../../detection/src/scan.js";

async function controlledDns(answers: () => { address: string; family: number }[], run: () => Promise<void>): Promise<void> {
  const lookup = vi.spyOn(dns, "lookup").mockImplementation((async () => answers()) as unknown as typeof dns.lookup);
  syncBuiltinESMExports();
  try { await run(); } finally { lookup.mockRestore(); syncBuiltinESMExports(); }
}

it("retains public authorization when DNS becomes private during route preparation", async () => {
  let requests = 0;
  let opens = 0;
  let queries = 0;
  const server = createServer((_request, response) => { requests++; response.end("private response must never be read"); });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const entryUrl = `http://rebind.example:${(server.address() as { port: number }).port}/`;
  const publicTransport: PinnedTransport = { open: async () => { opens++; throw new Error("unavailable public fixture transport"); }, close: async () => {} };
  try {
    await controlledDns(() => [{ address: ++queries <= 2 ? "1.1.1.1" : "127.0.0.1", family: 4 }], async () => {
      const networkPolicy = await PublicNetworkPolicy.forManualEntry(entryUrl, undefined, 2000, publicTransport);
      expect((await networkPolicy.resolveTarget(entryUrl)).route).toBe("public");
      const input: CrawlOptions = { entryUrl, networkPolicy, publicTransport, settleMs: 0,
        limits: { maxPages: 1, maxDepth: 0, timeoutSec: 20 } };
      await expect(crawlSite(input)).rejects.toThrow(/policy rejected/);
      expect(requests).toBe(0);
      expect(opens).toBe(0);
    });
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
}, 30_000);

it("keeps an initially owned DNS binding direct instead of authorizing a later private address", async () => {
  let originalRequests = 0;
  let laterRequests = 0;
  let opens = 0;
  let queries = 0;
  const original = createServer((_request, response) => { originalRequests++; response.setHeader("content-type", "text/html"); response.end("<p>original owned site</p>"); });
  await new Promise<void>(resolve => original.listen(0, "127.0.0.1", resolve));
  const port = (original.address() as { port: number }).port;
  const later = createServer((_request, response) => { laterRequests++; response.end("later private site"); });
  await new Promise<void>(resolve => later.listen(port, "127.0.0.2", resolve));
  const entryUrl = `http://owned-binding.example:${port}/`;
  const publicTransport: PinnedTransport = { open: async () => { opens++; throw new Error("public route unavailable"); }, close: async () => {} };
  try {
    await controlledDns(() => [{ address: ++queries === 1 ? "127.0.0.1" : "127.0.0.2", family: 4 }], async () => {
      const networkPolicy = await PublicNetworkPolicy.forManualEntry(entryUrl, undefined, 2000, publicTransport);
      expect((await networkPolicy.resolveTarget(entryUrl)).route).toBe("owned-origin");
      const input: CrawlOptions = { entryUrl, networkPolicy, publicTransport, settleMs: 0,
        limits: { maxPages: 1, maxDepth: 0, timeoutSec: 20 } };
      const output = await scanSite({ entryUrl, crawl: input });
      expect(output.detailBundle.pageOutcomes?.[0]?.status).toBe(200);
      expect(originalRequests).toBeGreaterThan(0);
      expect(laterRequests).toBe(0);
      expect(opens).toBe(0);
    });
  } finally {
    await Promise.all([original, later].map(server => { server.closeAllConnections(); return new Promise<void>(resolve => server.close(() => resolve())); }));
  }
}, 30_000);

it.for([[{ address: "127.0.0.1", family: 4 }], [{ address: "1.1.1.1", family: 4 }, { address: "127.0.0.1", family: 4 }]])(
  "rejects unsafe public DNS at browser navigation after successful public preparation", { timeout: 30_000 }, async unsafeAnswers => {
    let changed = false;
    let opensAfterChange = 0;
    const requests: string[] = [];
    const server = createServer((request, response) => { requests.push(request.url ?? ""); response.writeHead(404); response.end(); });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const entryUrl = `http://browser-rebind.example:${(server.address() as { port: number }).port}/page`;
    const mapped = createDirectTransport();
    const publicTransport: PinnedTransport = { open: (target, options) => {
      if (changed) opensAfterChange++;
      return mapped.open({ ...target, address: "127.0.0.1", family: 4 }, options);
    }, close: () => mapped.close() };
    try {
      await controlledDns(() => changed ? unsafeAnswers : [{ address: "1.1.1.1", family: 4 }], async () => {
        const networkPolicy = await PublicNetworkPolicy.forManualEntry(entryUrl, undefined, 2000, publicTransport);
        expect((await networkPolicy.resolveTarget(entryUrl)).route).toBe("public");
        const input: CrawlOptions = { entryUrl, networkPolicy, publicTransport, settleMs: 0,
          events: { onPageStarted: () => { changed = true; } }, limits: { maxPages: 1, maxDepth: 0, timeoutSec: 20 } };
        const summary = await crawlSite(input);
        expect(changed).toBe(true);
        expect(summary.pages[0]?.issue?.kind).toBe("network-policy");
        expect(requests).not.toContain("/page");
        expect(opensAfterChange).toBe(0);
      });
    } finally { await publicTransport.close(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
  });

it("authorizes only the exact manual private origin while retaining public resource policy", async () => {
  const policy = await PublicNetworkPolicy.forManualEntry("http://127.0.0.1:4567/entry");
  expect((await policy.resolveTarget("http://127.0.0.1:4567/frame")).address).toBe("127.0.0.1");
  expect((await policy.resolveTarget("http://127.0.0.1:4567/frame")).route).toBe("owned-origin");
  await expect(policy.resolveTarget("http://127.0.0.1:4568/")).rejects.toThrow("policy rejected");
  await expect(policy.resolveTarget("http://127.0.0.2:4567/")).rejects.toThrow("policy rejected");
  await expect(policy.resolveTarget("https://127.0.0.1:4567/")).rejects.toThrow("policy rejected");
  await expect(policy.resolveTarget("http://localhost:4567/")).rejects.toThrow("policy rejected");
  // Public-network-only mode stays strict for the same loopback origin.
  const strict = new PublicNetworkPolicy();
  await expect(strict.resolveTarget("http://127.0.0.1:4567/")).rejects.toThrow("policy rejected");
  await expect(strict.resolveTarget("http://127.0.0.2:4567/")).rejects.toThrow("policy rejected");
  expect((await policy.resolveTarget("https://8.8.8.8/")).address).toBe("8.8.8.8");
  expect((await policy.resolveTarget("https://8.8.8.8/")).route).toBe("public");
  await expect(PublicNetworkPolicy.forManualEntry("http://169.254.169.254/")).rejects.toThrow("policy rejected");
});

const scanTimeoutSec = 30;
const testTimeoutMs = scanTimeoutSec * 1000 + 30_000;

it.for(["/", "/redirect"])("blocks actual private traffic outside a manually entered local origin (%s)", { timeout: testTimeoutMs }, async (path, { signal }) => {
  let connections = 0;
  const protectedServer = createServer((_request,response) => response.end("protected"));
  protectedServer.on("connection", () => { connections += 1; });
  await new Promise<void>((resolve) => protectedServer.listen(0,"127.0.0.1",resolve));
  const protectedOrigin = `http://127.0.0.1:${(protectedServer.address() as { port: number }).port}`;
  const entryServer = createServer((request,response) => {
    if (request.url === "/robots.txt") { response.end(""); return; }
    if (request.url === "/redirect") { response.writeHead(302, { location: protectedOrigin + "/target" }); response.end(); return; }
    response.setHeader("content-type", "text/html; charset=utf-8");
    response.end(`<p id="normal">업무 안내</p><img src="${protectedOrigin}/image"><iframe src="${protectedOrigin}/frame"></iframe><script>fetch('${protectedOrigin}/fetch').catch(()=>{})</script>`);
  });
  await new Promise<void>((resolve) => entryServer.listen(0,"127.0.0.1",resolve));
  const entryOrigin = `http://127.0.0.1:${(entryServer.address() as { port: number }).port}`;
  const publicTransport = createConnectTransport({ port: Number(new URL(protectedOrigin).port), username: "fixture", password: "fixture" });
  const abort = (): void => { entryServer.closeAllConnections(); protectedServer.closeAllConnections(); };
  signal.addEventListener("abort", abort, { once: true });
  try {
    const summary = await crawlSite({ entryUrl: entryOrigin + path, signal, publicTransport, settleMs: path === "/" ? 100 : 0,
      limits: { maxPages: 1, maxDepth: 0, timeoutSec: scanTimeoutSec } });
    if (path === "/") {
      expect(summary.pages[0]?.issue).toBeUndefined();
      expect(summary.pages[0]?.collectionIssues).toContain("network-policy-denied");
    } else expect(summary.pages[0]?.issue?.kind).toBe("network-policy");
    expect(connections).toBe(0);
  } finally {
    await publicTransport.close();
    signal.removeEventListener("abort", abort);
    await Promise.all([entryServer,protectedServer].map((server) => new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
      server.closeAllConnections();
    })));
  }
});

it("reports an unreachable manual-entry fixture as a navigation failure, not a policy denial", { timeout: testTimeoutMs }, async ({ signal }) => {
  const reserved = createServer();
  await new Promise<void>((resolve) => reserved.listen(0, "127.0.0.1", resolve));
  const address = reserved.address();
  if (address === null || typeof address === "string") throw new Error("loopback listener unavailable");
  const port = address.port;
  await new Promise<void>((resolve) => reserved.close(() => resolve()));
  const summary = await crawlSite({ entryUrl: `http://127.0.0.1:${port}/`, signal, settleMs: 0,
    limits: { maxPages: 1, maxDepth: 0, timeoutSec: 20 } });
  expect(summary.pages[0]?.status).toBe(502);
  expect(summary.pages[0]?.issue).toEqual({ kind: "navigation", retryable: true });
  expect(summary.pages[0]?.collectionIssues ?? []).not.toContain("network-policy-denied");
});
