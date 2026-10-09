import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { validateOfficialResultText, validateScanDetailBundle } from "@krds-detector/contracts";
import { scanSite } from "../src/scan.js";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../fixtures/realistic");
let server: Server;
let origin = "";

beforeAll(async () => {
  server = createServer((request, response) => {
    const name = new URL(request.url ?? "/", "http://fixture.local").pathname.replace(/^\//, "") || "index.html";
    if (!/^[a-z-]+\.html$/.test(name)) { response.writeHead(404); response.end("missing"); return; }
    void readFile(resolve(root, name)).then((body) => {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(body);
    }).catch(() => { response.writeHead(404); response.end("missing"); });
  });
  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture port unavailable");
  origin = `http://127.0.0.1:${String(address.port)}`;
});

afterAll(async () => { await new Promise<void>((resolveClose) => server.close(() => resolveClose())); });

interface Truth { positive: { page: string; selector: string; technique: string }[]; expectedAttemptedPages: number; expectedCheckedPages: number; expectedFailedPages: number }
const findingKey = (finding: { url: string; location: string; technique: string }) => {
  const path = new URL(finding.url).pathname;
  const boundary = finding.location.lastIndexOf(">>>");
  const selector = boundary >= 0 ? finding.location.slice(boundary + 3).trim() : finding.location;
  return `${path}\0${selector}\0${finding.technique}`;
};

describe("L2 municipal-style public site", () => {
  it("preserves all five known findings and the failed page at worker counts 1–4", async () => {
    const truth = JSON.parse(await readFile(resolve(root, "ground-truth.json"), "utf8")) as Truth;
    // Historical fixture labels the child document; location policy1.1 now
    // anchors that observed frame occurrence to its checked parent page.
    const expected = new Set(truth.positive.map((item) => `${item.page === "/frame.html" ? "/post.html" : item.page}\0${item.selector}\0${item.technique}`));
    const sets: string[][] = [];
    const durations: number[] = [];
    for (const concurrency of [1, 2, 3, 4]) {
      const start = performance.now();
      const output = await scanSite({
        entryUrl: `${origin}/`,
        crawl: { concurrency, settleMs: 1400, perPageMs: 10000, limits: { maxPages: 6, maxDepth: 2, timeoutSec: 90 } },
      });
      durations.push(Number(((performance.now() - start) / 1000).toFixed(3)));
      expect(output.pagesVisited).toBe(truth.expectedAttemptedPages);
      expect(output.failedPages).toBe(truth.expectedFailedPages);
      expect(output.timedOut).toBe(false);
      expect(validateOfficialResultText(output.json).ok).toBe(true);
      expect(validateScanDetailBundle(output.detailBundle, output.result, output.extraResult).ok).toBe(true);
      expect(output.detailBundle.coverage.checkedPages).toBe(truth.expectedCheckedPages);
      expect(output.detailBundle.coverage.failedPages.map((page) => new URL(page.url).pathname)).toEqual(["/missing.html"]);
      expect(output.detailBundle.findings.map((detail) => detail.findingId)).toEqual(output.result.findings.map((finding) => finding.id));
      for (const detail of output.detailBundle.findings) {
        expect(detail.normalizedText.length).toBeGreaterThan(0);
        expect(detail.observed.css.display.length).toBeGreaterThan(0);
        expect(detail.visual.state).toBe("available");
        const dataUrl = detail.visual.dataUrl ?? output.detailBundle.visualAssets?.find((asset) => asset.assetId === detail.visual.assetId)?.dataUrl;
        const bytes = Buffer.from(dataUrl!.split(",")[1]!, "base64");
        expect([...bytes.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
      }
      const got = new Set(output.result.findings.map(findingKey));
      expect([...got].sort()).toEqual([...expected].sort());
      sets.push(output.result.findings.map((finding) => `${finding.id}\0${findingKey(finding)}\0${finding.evidence_text}`));
    }
    expect(sets[1]).toEqual(sets[0]);
    expect(sets[2]).toEqual(sets[0]);
    expect(sets[3]).toEqual(sets[0]);
    console.log(`L2 wall seconds C1/C2/C3/C4: ${durations.join("/")}`);
  }, 90_000);
});
