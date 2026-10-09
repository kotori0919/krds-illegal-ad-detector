import { createServer, type Server } from "node:http";
import { expect, it } from "vitest";
import { scanSite } from "../../detection/src/scan.js";
import { validateOfficialResultText } from "@krds-detector/contracts";

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture address unavailable");
  return `http://127.0.0.1:${address.port}`;
}

async function close(server: Server): Promise<void> {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

it("excludes external main documents while retaining local redirects, query variants and external frames", async () => {
  const externalRequests: string[] = [];
  const external = createServer((request, response) => {
    externalRequests.push(request.url ?? "/");
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end('<p id="external-offer" style="opacity:0">카지노 가입 보너스 지급</p><a href="/recurse">more</a>');
  });
  const outside = await listen(external);
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
      response.end('<a href="/redirect">external</a><a href="/script">script</a><a href="/local-redirect">local</a>'
        + '<a href="/query?a=b%26c%3Dd">encoded</a><a href="/query?a=b&amp;c=d">structured</a>'
        + `<iframe id="advert" src="${outside}/frame"></iframe>`);
    } else if (path === "/script") {
      response.end(`<script>setTimeout(() => location.replace('${outside}/script-destination'), 50)</script>`);
    } else if (path === "/local") {
      response.end('<p id="local-offer" style="opacity:0">카지노 가입 보너스 지급</p>');
    } else {
      response.end(`<p>${path}</p>`);
    }
  });
  const origin = await listen(local);
  try {
    const output = await scanSite({ entryUrl: `${origin}/`, crawl: { settleMs: 250, concurrency: 1,
      limits: { maxPages: 6, maxDepth: 1, timeoutSec: 30 } } });
    expect(validateOfficialResultText(output.json).ok).toBe(true);
    expect(output.detailBundle.pageOutcomes?.filter((page) => page.outcome === "failed").map((page) => ({
      url: page.url, finalUrl: page.finalUrl, reason: page.reason, issue: page.issue,
    }))).toEqual([
      { url: `${origin}/redirect`, finalUrl: `${outside}/destination`, reason: "external-redirect", issue: { kind: "navigation", retryable: false } },
      { url: `${origin}/script`, finalUrl: `${outside}/script-destination`, reason: "external-redirect", issue: { kind: "navigation", retryable: false } },
    ]);
    expect(output.result.findings.map((finding) => `${finding.url}|${finding.location.split(">>>").at(-1)?.trim()}`).sort()).toEqual([
      `${outside}/frame|#external-offer`,
      `${origin}/local-redirect|#local-offer`,
    ].sort());
    expect(output.detailBundle.coverage.checkedPages).toBe(4);
    expect(localRequests).toContain("/query?a=b%26c%3Dd");
    expect(localRequests).toContain("/query?a=b&c=d");
    expect(externalRequests).not.toContain("/recurse");
    for (const path of ["/destination", "/script-destination"]) {
      expect(output.detailBundle.evidenceGraph?.nodes.map((node) => node.url)).toContain(`${outside}${path}`);
    }
  } finally {
    await Promise.all([close(local), close(external)]);
  }
}, 30000);
