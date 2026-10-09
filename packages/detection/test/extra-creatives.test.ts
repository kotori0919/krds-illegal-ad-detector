import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { validateExtraResult, validateOfficialResultText, validateScanDetailBundle } from "@krds-detector/contracts";
import { scanSite } from "../src/scan.js";
import { PublicNetworkPolicy } from "@krds-detector/scanner";

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
let redirectOrigin = "";
let landingOrigin = "";
let contentOrigins: string[] = [];
let redirectedImages = false;
let imageRequests = 0;

beforeAll(async () => {
  assets = createServer((request, response) => {
    const path = new URL(request.url ?? "/", "http://fixture.local").pathname;
    if (path === "/frame.html") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(`<!doctype html><html lang="ko"><body><h1>${request.headers.host} 행사 안내</h1><p>시민 문화 행사 일정입니다.</p></body></html>`);
      return;
    }
    if (path.startsWith("/track/")) {
      response.writeHead(302, { location: `${assetOrigin}/${path.slice(7)}` });
      response.end();
      return;
    }
    const name = path.slice(1);
    if (!["creative.png", "resized.png", "reencoded.webp", "modified.png"].includes(name)) {
      response.writeHead(404); response.end(); return;
    }
    imageRequests += 1;
    void readFile(resolve(assetRoot, name)).then((bytes) => {
      response.writeHead(200, { "content-type": name.endsWith(".webp") ? "image/webp" : "image/png",
        "content-length": bytes.length });
      response.end(bytes);
    });
  });
  await new Promise<void>((resolve) => assets.listen(0, "127.0.0.1", resolve));
  const assetAddress = assets.address();
  if (!assetAddress || typeof assetAddress === "string") throw new Error("asset port unavailable");
  assetOrigin = `http://assets.localhost:${String(assetAddress.port)}`;
  redirectOrigin = `http://redirect.localhost:${String(assetAddress.port)}`;
  landingOrigin = `http://landing.localhost:${String(assetAddress.port)}`;
  contentOrigins = ["content-a", "content-b"].map((name) => `http://${name}.localhost:${String(assetAddress.port)}`);
  site = createServer((request, response) => {
    const name = names[new URL(request.url ?? "/", "http://fixture.local").pathname];
    if (!name) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(`<!doctype html><html lang="ko"><body>
      <nav><a href="/duplicate">복제</a><a href="/resized">두 번째</a><a href="/webp">세 번째</a><a href="/modified">네 번째</a></nav>
      <a href="${landingOrigin}/landing"><img alt="광고 배너" src="${redirectedImages ? `${redirectOrigin}/track/${name}` : `${assetOrigin}/${name}`}"></a>
      ${contentOrigins.map((origin, index) => `<iframe title="행사 ${index + 1}" src="${origin}/frame.html"></iframe>`).join("")}
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
  it.each([false, true])("correlates exact creative, destination and redirect domains while excluding benign frames (redirected=%s)", async (redirected) => {
    redirectedImages = redirected;
    imageRequests = 0;
    let inspectedFrames = 0;
    const output = await scanSite({ entryUrl: `${siteOrigin}/`,
      onEvent: (event) => { inspectedFrames = event.progress.framesInspected; }, crawl: {
        networkPolicyForTesting: PublicNetworkPolicy.forFixtureTargets([siteOrigin,assetOrigin,redirectOrigin,...contentOrigins]
          .map((origin) => ({ origin, address: "127.0.0.1" as const }))),
        concurrency: 2, settleMs: 700, perPageMs: 7000,
        limits: { maxPages: 5, maxDepth: 1, timeoutSec: 45 },
    } });
    expect(output.pagesVisited).toBe(5);
    expect(output.failedPages).toBe(0);
    expect(inspectedFrames).toBe(10);
    expect(validateOfficialResultText(output.json).ok).toBe(true);
    expect(validateExtraResult(output.extraResult).ok).toBe(true);
    expect(output.result.findings).toEqual([]);
    expect(imageRequests).toBe(5);
    const creativeFinding = output.extraResult.findings.find((item) => item.extra_finding === "REUSED_AD_CREATIVE")!;
    const image = output.detailBundle.creativeImages.find((item) => item.findingId === creativeFinding.id)!;
    expect(image.sourceUrl).toBe(creativeFinding.url);
    const dataUrl = image.dataUrl ?? output.detailBundle.visualAssets?.find((asset) => asset.assetId === image.assetId)?.dataUrl;
    expect(Buffer.from(dataUrl!.split(",")[1]!, "base64"))
      .toEqual(await readFile(resolve(assetRoot, new URL(image.sourceUrl).pathname.slice(1))));
    const wrongSource = structuredClone(output.detailBundle);
    wrongSource.creativeImages[0]!.sourceUrl = `${assetOrigin}/unobserved.png`;
    expect(validateScanDetailBundle(wrongSource, output.result, output.extraResult).ok).toBe(false);
    const duplicate = structuredClone(output.detailBundle);
    duplicate.creativeImages.push(duplicate.creativeImages[0]!);
    expect(validateScanDetailBundle(duplicate, output.result, output.extraResult).ok).toBe(false);
    const invalidData = structuredClone(output.detailBundle);
    invalidData.creativeImages[0]!.dataUrl = "data:image/png;base64,<svg>";
    expect(validateScanDetailBundle(invalidData, output.result, output.extraResult).ok).toBe(false);
    const extras = output.extraResult.findings.map(({ id, extra_finding, evidence_text }) => ({ id, extra_finding, evidence_text }));
    expect(extras.filter((item) => item.extra_finding === "REUSED_AD_CREATIVE")
      .map((item) => item.evidence_text)).toEqual([expect.stringContaining("seen 5 times")]);
    const domains = [assetOrigin, ...(redirected ? [redirectOrigin] : []), landingOrigin]
      .map((origin) => new URL(origin).host).sort();
    expect(extras.filter((item) => item.extra_finding === "AD_INFRASTRUCTURE_CORRELATION")
      .map((item) => item.evidence_text).sort()).toEqual(domains
      .map((domain) => `recurring advertisement infrastructure: ${domain} (observed on 5 pages)`));
    expect(output.detailBundle.infrastructure!.map((relation) => relation.domain).sort()).toEqual(domains);
    for (const relation of output.detailBundle.infrastructure!) expect(relation.pageUrls)
      .toEqual(Object.keys(names).map((path) => `${siteOrigin}${path}`).sort());
    const observedDomains = output.detailBundle.evidenceGraph!.nodes.filter((node) => node.kind === "Domain").map((node) => node.label);
    for (const origin of contentOrigins) expect(observedDomains).toContain(new URL(origin).host);
    expect(output.detailBundle.evidenceGraph!.nodes.filter((node) => node.kind === "Domain" && node.adRelated)
      .map((node) => node.label).sort()).toEqual(domains);
  }, 20_000);
});
