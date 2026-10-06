import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { validateExtraResult, validateOfficialResultText } from "@krds-detector/contracts";
import { scanSite } from "../src/scan.js";

const assetRoot = resolve(import.meta.dirname, "../../../fixtures/realistic/ads");
const names: Record<string, string> = {
  "/": "creative.png",
  "/duplicate": "creative.png",
  "/resized": "resized.png",
  "/webp": "reencoded.webp",
  "/modified": "modified.png",
};
let site: Server;
let assets: Server;
let siteOrigin = "";
let assetOrigin = "";

beforeAll(async () => {
  assets = createServer((request, response) => {
    const name = new URL(request.url ?? "/", "http://fixture.local").pathname.slice(1);
    if (!["creative.png", "resized.png", "reencoded.webp", "modified.png"].includes(name)) {
      response.writeHead(404); response.end(); return;
    }
    void readFile(resolve(assetRoot, name)).then((bytes) => {
      response.writeHead(200, { "content-type": name.endsWith(".webp") ? "image/webp" : "image/png",
        "content-length": bytes.length });
      response.end(bytes);
    });
  });
  await new Promise<void>((resolve) => assets.listen(0, "127.0.0.1", resolve));
  const assetAddress = assets.address();
  if (!assetAddress || typeof assetAddress === "string") throw new Error("asset port unavailable");
  assetOrigin = `http://127.0.0.1:${String(assetAddress.port)}`;
  site = createServer((request, response) => {
    const name = names[new URL(request.url ?? "/", "http://fixture.local").pathname];
    if (!name) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(`<!doctype html><html lang="ko"><body>
      <nav><a href="/duplicate">복제</a><a href="/resized">두 번째</a><a href="/webp">세 번째</a><a href="/modified">네 번째</a></nav>
      <a href="${assetOrigin}/landing"><img alt="광고 배너" src="${assetOrigin}/${name}"></a>
    </body></html>`);
  });
  await new Promise<void>((resolve) => site.listen(0, "127.0.0.1", resolve));
  const siteAddress = site.address();
  if (!siteAddress || typeof siteAddress === "string") throw new Error("site port unavailable");
  siteOrigin = `http://127.0.0.1:${String(siteAddress.port)}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => site.close(() => resolve()));
  await new Promise<void>((resolve) => assets.close(() => resolve()));
});

describe("live creative and infrastructure extra result", () => {
  it("groups duplicate, resized, WebP and modified observed images deterministically", async () => {
    let baseline: unknown;
    for (const concurrency of [1, 2, 3, 4]) {
      const output = await scanSite({ entryUrl: `${siteOrigin}/`, crawl: {
        concurrency, settleMs: 700, perPageMs: 7000,
        limits: { maxPages: 5, maxDepth: 1, timeoutSec: 45 },
      } });
      expect(output.pagesVisited).toBe(5);
      expect(output.failedPages).toBe(0);
      expect(validateOfficialResultText(output.json).ok).toBe(true);
      expect(validateExtraResult(output.extraResult).ok).toBe(true);
      expect(output.result.findings).toEqual([]);
      const extras = output.extraResult.findings.map(({ id, extra_finding, evidence_text }) => ({ id, extra_finding, evidence_text }));
      expect(extras.map((item) => item.extra_finding)).toEqual([
        "REUSED_AD_CREATIVE", "AD_INFRASTRUCTURE_CORRELATION",
      ]);
      expect(extras[0]?.evidence_text).toContain("seen 5 times");
      expect(extras[1]?.evidence_text).toContain("observed on 5 pages");
      if (baseline) expect(extras).toEqual(baseline);
      baseline = extras;
    }
  }, 40_000);
});
