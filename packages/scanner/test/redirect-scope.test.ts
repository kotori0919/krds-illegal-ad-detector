import { createServer, type Server } from "node:http";
import { expect, it } from "vitest";
import { scanSite } from "../../detection/src/scan.js";
import { validateOfficialResultText } from "@krds-detector/contracts";
import { PublicNetworkPolicy } from "../src/public-network.js";

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture address unavailable");
  return `http://127.0.0.1:${address.port}`;
}

async function close(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  });
}

const scanTimeoutSec = 30;
// Keep scan work and browser finalization within separate allowances.
const testTimeoutMs = scanTimeoutSec * 1000 + 30_000;
interface ScopeFixture {
  origin: string;
  outside: string;
  localRequests: string[];
  externalRequests: string[];
}
const scopeTest = it.extend<{ site: ScopeFixture }>({
  site: async ({ signal }, use) => {
    const externalRequests: string[] = [];
    const external = createServer((request, response) => {
      externalRequests.push(request.url ?? "/");
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end('<p id="external-offer" style="opacity:0">카지노 가입 보너스 지급</p><a href="/recurse">more</a>');
    });
    let outside = "";
    const localRequests: string[] = [];
    const local = createServer((request, response) => {
      const path = request.url ?? "/";
      localRequests.push(path);
      if (path === "/redirect" || path === "/local-redirect") {
        response.writeHead(302, { location: path === "/redirect" ? `${outside}/destination` : "/local" });
        response.end();
        return;
      }
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      if (path === "/") {
        response.end('<a href="/local-redirect">local</a>'
          + `<iframe id="advert" src="${outside}/frame"></iframe>`);
      } else if (path === "/queries") {
        response.end('<a href="/query?a=b%26c%3Dd">encoded</a><a href="/query?a=b&amp;c=d">structured</a>');
      } else if (path === "/script") {
        response.end(`<script>setTimeout(() => location.replace('${outside}/script-destination'), 50)</script>`);
      } else if (path === "/local") {
        response.end('<p id="local-offer" style="opacity:0">카지노 가입 보너스 지급</p>');
      } else {
        response.end(`<p>${path}</p>`);
      }
    });
    const abort = () => { local.closeAllConnections(); external.closeAllConnections(); };
    signal.addEventListener("abort", abort, { once: true });
    try {
      outside = await listen(external);
      const origin = await listen(local);
      await use({ origin, outside, localRequests, externalRequests });
    } finally {
      signal.removeEventListener("abort", abort);
      await Promise.all([close(local), close(external)]);
    }
  },
});

scopeTest.for([
  { path: "/redirect", destination: "/destination" },
  { path: "/script", destination: "/script-destination" },
])("excludes the external main document after $path", { timeout: testTimeoutMs }, async ({ path, destination }, { site, signal }) => {
  const { origin, outside, externalRequests } = site;
  const entryUrl = `${origin}${path}`;
  const output = await scanSite({ entryUrl, signal, crawl: { settleMs: 250, concurrency: 1,
    networkPolicy: PublicNetworkPolicy.forFixtureOrigins([origin,outside]),
    limits: { maxPages: 1, maxDepth: 0, timeoutSec: scanTimeoutSec } } });
  expect(validateOfficialResultText(output.json).ok).toBe(true);
  expect(output.timedOut).toBe(false);
  expect(output.detailBundle.pageOutcomes).toEqual([{ url: entryUrl, finalUrl: `${outside}${destination}`,
    depth: 0, status: 200, outcome: "failed", reason: "external-redirect",
    issue: { kind: "navigation", retryable: false }, discoverySource: "entry" }]);
  expect(output.result.findings).toEqual([]);
  expect(output.detailBundle.coverage.checkedPages).toBe(0);
  expect(output.detailBundle.evidenceGraph?.nodes.map((node) => node.url)).toContain(`${outside}${destination}`);
  expect(externalRequests).not.toContain("/recurse");
});

scopeTest("retains same-host redirect and external frame findings", async ({ site, signal }) => {
  const { origin, outside, externalRequests } = site;
  const output = await scanSite({ entryUrl: `${origin}/`, signal, crawl: { settleMs: 250, concurrency: 1,
    networkPolicy: PublicNetworkPolicy.forFixtureOrigins([origin,outside]),
    limits: { maxPages: 2, maxDepth: 1, timeoutSec: scanTimeoutSec } } });
  expect(validateOfficialResultText(output.json).ok).toBe(true);
  expect(output.timedOut).toBe(false);
  expect(output.result.findings.map((finding) => `${finding.url}|${finding.location.split(">>>").at(-1)?.trim()}`).sort()).toEqual([
    `${origin}/|#external-offer`,
    `${origin}/local-redirect|#local-offer`,
  ].sort());
  expect(output.detailBundle.coverage.checkedPages).toBe(2);
  expect(output.failedPages).toBe(0);
  expect(externalRequests).not.toContain("/recurse");
}, testTimeoutMs);

scopeTest("visits both query variants containing encoded delimiters", async ({ site, signal }) => {
  const { origin, localRequests } = site;
  const output = await scanSite({ entryUrl: `${origin}/queries`, signal, crawl: { settleMs: 0, concurrency: 1,
    limits: { maxPages: 3, maxDepth: 1, timeoutSec: scanTimeoutSec } } });
  expect(validateOfficialResultText(output.json).ok).toBe(true);
  expect(output.timedOut).toBe(false);
  expect(output.detailBundle.coverage.checkedPages).toBe(3);
  expect(output.failedPages).toBe(0);
  expect(localRequests).toContain("/query?a=b%26c%3Dd");
  expect(localRequests).toContain("/query?a=b&c=d");
}, testTimeoutMs);
