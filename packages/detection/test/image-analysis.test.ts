import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { scanSite } from "../src/scan.js";
import { validateScanDetailBundle } from "@krds-detector/contracts";

it("stores real candidate-image OCR and structured decisions with page coverage", async () => {
  const image = await readFile("fixtures/ocr/banner.png");
  const server = createServer((request, response) => {
    if (request.url === "/banner.png" || request.url === "/logo.png") {
      response.writeHead(200, { "content-type": "image/png", "content-length": image.length });
      response.end(image);
    } else {
      response.setHeader("content-type", "text/html; charset=utf-8");
      response.end('<p style="opacity:0">카지노 가입 보너스 지급</p><img class="ad" src="/banner.png"><img alt="logo" src="/logo.png">');
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture address unavailable");
  try {
    const output = await scanSite({ entryUrl: `http://127.0.0.1:${address.port}/`,
      crawl: { concurrency: 1, settleMs: 20, limits: { maxPages: 1, timeoutSec: 20 } } });
    expect(output.result.findings.map((finding) => finding.evidence_text)).toEqual(["카지노 가입 보너스 지급"]);
    expect(output.detailBundle.imageAnalysis?.length).toBe(1);
    const analysis = output.detailBundle.imageAnalysis![0]!;
    expect(analysis.sourceUrl).toContain("/banner.png");
    expect(analysis.ocr.state).toBe("available");
    if (analysis.ocr.state === "available") expect(analysis.ocr.text.replace(/\s/g, "")).toContain("카지노가입보너스지급");
    expect(analysis.matchedTerms).toContain("카지노");
    expect(analysis.decision.passed).toBe(true);
    expect(output.detailBundle.pageOutcomes?.map((page) => page.outcome)).toEqual(["checked"]);
    expect(validateScanDetailBundle(output.detailBundle, output.result, output.extraResult)).toEqual({ ok: true, errors: [] });
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
}, 20_000);
