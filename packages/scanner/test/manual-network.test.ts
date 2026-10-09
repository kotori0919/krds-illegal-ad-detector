import { createServer } from "node:http";
import { expect, it } from "vitest";
import { crawlSite } from "../src/crawl.js";
import { PublicNetworkPolicy } from "../src/public-network.js";

it("authorizes only the exact manual private origin while retaining public resource policy", async () => {
  const policy = await PublicNetworkPolicy.forManualEntry("http://127.0.0.1:4567/entry");
  expect((await policy.resolveTarget("http://127.0.0.1:4567/frame")).address).toBe("127.0.0.1");
  await expect(policy.resolveTarget("http://127.0.0.1:4568/")).rejects.toThrow("policy rejected");
  await expect(policy.resolveTarget("http://localhost:4567/")).rejects.toThrow("policy rejected");
  expect((await policy.resolveTarget("https://8.8.8.8/")).address).toBe("8.8.8.8");
  await expect(PublicNetworkPolicy.forManualEntry("http://169.254.169.254/")).rejects.toThrow("policy rejected");
});

it("blocks actual private subresources and redirects outside a manually entered local origin", async () => {
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
  try {
    const summary = await crawlSite({ entryUrl: entryOrigin + "/", settleMs: 100, limits: { maxPages: 1, maxDepth: 0, timeoutSec: 30 } });
    expect(summary.pages[0]?.issue).toBeUndefined();
    expect(summary.pages[0]?.collectionIssues).toContain("network-policy-denied");
    expect(connections).toBe(0);
    const redirect = await crawlSite({ entryUrl: entryOrigin + "/redirect", settleMs: 0, limits: { maxPages: 1, maxDepth: 0, timeoutSec: 30 } });
    expect(redirect.pages[0]?.issue?.kind).toBe("network-policy");
    expect(connections).toBe(0);
  } finally {
    entryServer.closeAllConnections(); protectedServer.closeAllConnections();
    await Promise.all([entryServer,protectedServer].map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  }
});
