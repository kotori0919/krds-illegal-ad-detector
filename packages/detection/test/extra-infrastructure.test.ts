import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { validateExtraResult, validateOfficialResultText } from "@krds-detector/contracts";
import { scanSite } from "../src/scan.js";

let site: Server;
let asset: Server;
let siteOrigin = "";
let assetOrigin = "";

beforeAll(async () => {
  asset = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "image/svg+xml" });
    response.end('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="red"/></svg>');
  });
  await new Promise<void>((resolve) => asset.listen(0, "127.0.0.1", resolve));
  const assetAddress = asset.address();
  if (!assetAddress || typeof assetAddress === "string") throw new Error("asset port unavailable");
  assetOrigin = `http://127.0.0.1:${String(assetAddress.port)}`;
  site = createServer((request, response) => {
    const path = new URL(request.url ?? "/", "http://fixture.local").pathname;
    if (path !== "/" && path !== "/second") { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(`<!doctype html><html lang="ko"><body>
      <h1>기관 소식</h1><a href="/second">다음 소식</a>
      <img alt="광고 배너" src="${assetOrigin}/creative.svg">
    </body></html>`);
  });
  await new Promise<void>((resolve) => site.listen(0, "127.0.0.1", resolve));
  const siteAddress = site.address();
  if (!siteAddress || typeof siteAddress === "string") throw new Error("site port unavailable");
  siteOrigin = `http://127.0.0.1:${String(siteAddress.port)}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => site.close(() => resolve()));
  await new Promise<void>((resolve) => asset.close(() => resolve()));
});

describe("live extra infrastructure result", () => {
  it("counts a reused external asset on two pages without changing official output or concurrent IDs", async () => {
    let baseline: unknown;
    for (const concurrency of [1, 2, 3, 4]) {
      const output = await scanSite({ entryUrl: `${siteOrigin}/`, crawl: {
        concurrency, settleMs: 250, perPageMs: 7000,
        limits: { maxPages: 2, maxDepth: 1, timeoutSec: 45 },
      } });
      expect(output.pagesVisited).toBe(2);
      expect(output.failedPages).toBe(0);
      expect(validateOfficialResultText(output.json).ok).toBe(true);
      expect(validateExtraResult(output.extraResult).ok).toBe(true);
      expect(output.result.findings).toEqual([]);
      const extras = output.extraResult.findings.map(({ id, extra_finding, evidence_text }) => ({ id, extra_finding, evidence_text }));
      expect(extras).toEqual([{
        id: "x1", extra_finding: "AD_INFRASTRUCTURE_CORRELATION",
        evidence_text: `recurring advertisement infrastructure: 127.0.0.1:${String(assetAddressPort())} (observed on 2 pages)`,
      }]);
      if (baseline) expect(extras).toEqual(baseline);
      baseline = extras;
    }
  }, 30_000);
});

function assetAddressPort(): number {
  const address = asset.address();
  if (!address || typeof address === "string") throw new Error("asset port unavailable");
  return address.port;
}
