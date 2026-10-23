import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { scanSite } from "../src/scan.js";

it.each([
  { bannerInFrame: true, frameStyle: "", equivalent: true },
  { bannerInFrame: false, frameStyle: "", equivalent: true },
  { bannerInFrame: false, frameStyle: "opacity:0", equivalent: false },
  { bannerInFrame: false, frameStyle: "position:absolute;left:-10000px", equivalent: false },
])("uses visible cross-frame advertisement text: %j", async ({ bannerInFrame, frameStyle, equivalent }) => {
  const bytes = await readFile("fixtures/ocr/banner.png");
  const caption = "<p>카지노 가입 보너스 지급</p>";
  const banner = '<img id="banner" class="ad" src="/banner.png">';
  const server = createServer((request, response) => {
    if (request.url === "/banner.png") {
      response.writeHead(200, { "content-type": "image/png", "content-length": bytes.length });
      response.end(bytes);
    } else {
      response.setHeader("content-type", "text/html; charset=utf-8");
      response.end(request.url === "/frame"
        ? (bannerInFrame ? banner : caption)
        : `${bannerInFrame ? caption : banner}<iframe id="frame" style="${frameStyle}" src="/frame"></iframe>`);
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture address unavailable");
  try {
    const output = await scanSite({ entryUrl: `http://127.0.0.1:${address.port}/`,
      crawl: { concurrency: 1, settleMs: 20, limits: { maxPages: 1, timeoutSec: 20 } } });
    expect(output.pagesVisited).toBe(1);
    const analysis = output.detailBundle.imageAnalysis!;
    expect(analysis).toHaveLength(1);
    expect(analysis[0]!.ocr.state).toBe("available");
    if (analysis[0]!.ocr.state === "available") expect(analysis[0]!.ocr.text.replace(/\s/g, "")).toContain("카지노가입보너스지급");
    expect(output.extraResult.findings.filter((finding) => finding.extra_finding === "IMAGE_ONLY_ILLEGAL_AD"))
      .toHaveLength(equivalent ? 0 : 1);
    expect(analysis[0]!.visibleDomEquivalent).toBe(equivalent);
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
}, 20_000);
