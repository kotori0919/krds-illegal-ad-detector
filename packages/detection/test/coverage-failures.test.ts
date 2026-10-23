import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import { validateScanDetailBundle } from "@krds-detector/contracts";
import { scanSite } from "../src/scan.js";

describe("successful page coverage", () => {
  it("retains a real finding when failed pages outnumber checked pages", async () => {
    const site = createServer((request, response) => {
      response.setHeader("content-type", "text/html; charset=utf-8");
      if (request.url === "/") response.end('<p id="ad" style="opacity:0">카지노 첫충 보너스 지급</p><a href="/missing-a">A</a><a href="/missing-b">B</a>');
      else { response.statusCode = 404; response.end("missing"); }
    });
    await new Promise<void>((resolve) => site.listen(0, "127.0.0.1", resolve));
    const address = site.address();
    if (!address || typeof address === "string") throw new Error("fixture port missing");
    try {
      const output = await scanSite({ entryUrl: `http://127.0.0.1:${String(address.port)}/`,
        crawl: { concurrency: 2, settleMs: 0, limits: { maxPages: 3, maxDepth: 1, timeoutSec: 30 } } });
      expect(output.pagesVisited).toBe(3);
      expect(output.detailBundle.coverage.checkedPages).toBe(1);
      expect(output.detailBundle.coverage.failedPages.map((page) => new URL(page.url).pathname)).toEqual(["/missing-a", "/missing-b"]);
      expect(output.result.findings.map((finding) => ({ text: finding.evidence_text, technique: finding.technique })))
        .toEqual([{ text: "카지노 첫충 보너스 지급", technique: "TRANSPARENT" }]);
      expect(validateScanDetailBundle(output.detailBundle, output.result, output.extraResult).ok).toBe(true);
      for (const checkedPages of [-1, 1.5, Number.NaN]) {
        const corrupt = { ...output.detailBundle, coverage: { ...output.detailBundle.coverage, checkedPages } };
        expect(validateScanDetailBundle(corrupt, output.result, output.extraResult).ok).toBe(false);
      }
    } finally { await new Promise<void>((resolve) => site.close(() => resolve())); }
  }, 15_000);
});
