import { createServer } from "node:http";
import { expect, it } from "vitest";
import { scanSite } from "../../detection/src/scan.js";
import { validateOfficialResultText } from "@krds-detector/contracts";

it("retains measured all-challenge failures without claiming any successfully checked page", async () => {
  const requests: string[] = [];
  const events: { kind: string; failures: number }[] = [];
  const server = createServer((request, response) => {
    requests.push(request.url ?? "/");
    if (request.url !== "/") { response.statusCode = 404; response.end(); return; }
    response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cf-mitigated": "challenge" });
    // This content would create an official finding if the challenge body
    // reached the live detector. Access classification must stop it first.
    response.end('<title>Challenge</title><p id="offer" style="opacity:0">카지노 가입 보너스 지급</p>');
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture address unavailable");
  const entryUrl = `http://127.0.0.1:${address.port}/`;
  try {
    const output = await scanSite({ entryUrl, crawl: { settleMs: 0, limits: { maxPages: 1, maxDepth: 0, timeoutSec: 30 } },
      onEvent: (event) => { events.push({ kind: event.kind, failures: event.progress.failedPages }); } });
    expect(output.result.findings).toEqual([]);
    expect(validateOfficialResultText(output.json).ok).toBe(true);
    expect(output.pagesVisited).toBe(1);
    expect(output.failedPages).toBe(1);
    expect(output.detailBundle.coverage.checkedPages).toBe(0);
    expect(output.detailBundle.coverage.failedPages).toEqual([{ url: entryUrl, status: 200, reason: "access-challenge" }]);
    expect(output.detailBundle.pageOutcomes).toEqual([{ url: entryUrl, finalUrl: entryUrl, depth: 0, status: 200,
      outcome: "failed", reason: "access-challenge", issue: { kind: "challenge", retryable: false }, discoverySource: "entry" }]);
    expect(events.find((event) => event.kind === "page-failed")?.failures).toBe(1);
    expect(requests.filter((url) => url === "/")).toHaveLength(1);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}, 30000);
