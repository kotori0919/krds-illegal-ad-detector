import { createServer } from "node:http";
import { expect, it } from "vitest";
import { crawlSite } from "../src/crawl.js";
import { PublicNetworkPolicy } from "../src/public-network.js";
import { createConnectTransport } from "../src/pinned-transport.js";

it("authorizes only the exact manual private origin while retaining public resource policy", async () => {
  const policy = await PublicNetworkPolicy.forManualEntry("http://127.0.0.1:4567/entry");
  expect((await policy.resolveTarget("http://127.0.0.1:4567/frame")).address).toBe("127.0.0.1");
  expect((await policy.resolveTarget("http://127.0.0.1:4567/frame")).route).toBe("owned-origin");
  await expect(policy.resolveTarget("http://127.0.0.1:4568/")).rejects.toThrow("policy rejected");
  await expect(policy.resolveTarget("http://localhost:4567/")).rejects.toThrow("policy rejected");
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
