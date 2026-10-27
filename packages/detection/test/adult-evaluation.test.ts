import { expect, it } from "vitest";
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { crawlSite, resolveFrameLocation } from "@krds-detector/scanner";
import { parseFrameLocation } from "@krds-detector/contracts";
import { detectPageCandidates, type DecidedCandidate } from "../src/pipeline.js";
import { buildOfficialResult, serializeValidatedResult } from "../src/result-engine.js";

// Evaluation-only corpus: never imported by development fixtures or policy.
// cases.json was promoted to regression after its first FP; holdout.json stays unused for tuning.
// Both are same-author synthetic samples, not an independent blind holdout.
it.each(["cases.json", "holdout.json"])("evaluates multipage/query/comment/repeated/nested-frame identities: %s", async (fixtureFile) => {
  const bytes = await readFile(new URL(`./fixtures/adult-evaluation/${fixtureFile}`, import.meta.url));
  const corpus = JSON.parse(bytes.toString()) as {
    dataset: string;
    pages: { path: string; html: string; expected: { selector: string; text: string; technique: string }[] }[];
    entries: string[];
  };
  const server = createServer((request, response) => {
    const fixture = corpus.pages.find(p => p.path === request.url);
    response.writeHead(fixture ? 200 : 404, { "content-type": "text/html;charset=utf-8" });
    response.end(fixture?.html ?? "missing fixture");
  });
  await new Promise<void>(done => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture server has no port");
  const base = `http://127.0.0.1:${address.port}`;
  const candidates: DecidedCandidate[] = [];
  const observed: { page: string; location: string; technique: string; raw: string; reasons: string[]; techniqueReason: string }[] = [];
  const expectedKeys = new Set<string>();
  const foundKeys: string[] = [];
  let checkedPages = 0;
  let inspectedDocuments = 0;
  let browserVersion = "";
  let resolved = 0;
  const startedAt = new Date().toISOString();
  try {
    const summary = await crawlSite({ entryUrl: base + corpus.entries[0], limits: { maxPages: 3, maxDepth: 2, timeoutSec: 30 },
      concurrency: 1, settleMs: 50, onLivePage: async (page, snapshot, frames) => {
        checkedPages++;
        browserVersion = page.context().browser()?.version() ?? "unavailable";
        const pagePath = new URL(snapshot.url).pathname + new URL(snapshot.url).search;
        const scopes = [{ frame: page.mainFrame(), chain: [] as { src: string; selector: string }[] },
          ...frames.map(f => ({ frame: f.frame, chain: f.srcChain.map((src, i) => ({ src, selector: f.selectorChain[i]! })) }))];
        for (const scope of scopes) {
          inspectedDocuments++;
          const scopeUrl = new URL(scope.frame.url());
          const fixture = corpus.pages.find(p => p.path === scopeUrl.pathname + scopeUrl.search)!;
          const chain = scope.chain.map(s => s.selector).join(">>>");
          for (const item of fixture.expected) expectedKeys.add(`${pagePath}|${chain}|${item.selector}|${item.technique}`);
          const found = await detectPageCandidates(scope.frame, { pageUrl: snapshot.url, framePath: scope.chain });
          for (const c of found) {
            const handle = await resolveFrameLocation(page, c.location);
            try {
              // Resolver rejects ambiguity at every frame/terminal segment.
              expect(await handle.textContent()).toBe(c.technique.rawText);
              const identity = await handle.evaluate(el => ({ tag: el.localName, id: el.id }));
              expect(identity.tag.length).toBeGreaterThan(0);
              expect(parseFrameLocation(c.location).slice(0, -1)).toEqual(scope.chain.map(s => s.selector));
              let matched = false;
              for (const item of fixture.expected) {
                const gold = await scope.frame.$$(item.selector);
                expect(gold.length).toBe(1);
                const same = await handle.evaluate((el, expected) => el === expected, gold[0]!);
                await gold[0]!.dispose();
                if (same && item.technique === c.technique.technique) {
                  expect(c.technique.rawText).toBe(item.text);
                  foundKeys.push(`${pagePath}|${chain}|${item.selector}|${item.technique}`);
                  matched = true;
                }
              }
              if (!matched) foundKeys.push(`UNEXPECTED|${pagePath}|${c.location}|${c.technique.technique}`);
              expect(c.textPolicy?.reasonCodes).toContain("AD_CATEGORY");
              expect(c.textPolicy?.reasonCodes).toContain("AD_OFFER");
              expect(c.technique.detail.length).toBeGreaterThan(0);
              resolved++;
            } finally { await handle.dispose(); }
            observed.push({ page: pagePath, location: c.location, technique: c.technique.technique,
              raw: c.technique.rawText, reasons: c.textPolicy?.reasonCodes ?? [], techniqueReason: c.technique.detail });
          }
          candidates.push(...found);
        }
      } });
    // The separate normal document is also processed through the production crawler.
    const normal = await crawlSite({ entryUrl: base + "/normal", limits: { maxPages: 1, maxDepth: 0, timeoutSec: 15 },
      concurrency: 1, settleMs: 50, onLivePage: async (page, snapshot) => {
        checkedPages++;
        inspectedDocuments++;
        const found = await detectPageCandidates(page, { pageUrl: snapshot.url });
        for (const c of found) foundKeys.push(`UNEXPECTED|/normal|${c.location}|${c.technique.technique}`);
        candidates.push(...found);
      } });
    const result = buildOfficialResult({ topic: "TOPIC", entryUrl: base + corpus.entries[0],
      startedAt, finishedAt: new Date().toISOString() }, [...candidates, ...candidates]);
    serializeValidatedResult(result);
    const tp = foundKeys.filter(k => expectedKeys.has(k)).length;
    const report = { dataset: corpus.dataset, usage: fixtureFile === "cases.json" ? "regression (promoted after observed FP)" : "same-author authored holdout; no policy tuning", sha256: createHash("sha256").update(bytes).digest("hex"),
      scope: "Authored same-author text/DOM corpus; production crawler + detector + official serializer + live locator roundtrip. Excludes OCR, native UI, persistence, cold process start, Windows and external sites.",
      browser: { engine: "actual Playwright Chromium", version: browserVersion }, node: process.version,
      fixtureSandboxException: process.env.KRDS_TEST_UNSANDBOXED === "1",
      concurrency: 1, checkedPages, documents: inspectedDocuments,
      expected: expectedKeys.size, tp, fp: foundKeys.filter(k => !expectedKeys.has(k)).length,
      fn: [...expectedKeys].filter(k => !foundKeys.includes(k)).length, duplicates: foundKeys.length - new Set(foundKeys).size,
      resolved, officialFindings: result.findings.length, failedPages: [...summary.pages, ...normal.pages].filter(p => p.failureReason).length,
      timedOut: summary.timedOut || normal.timedOut, observed, elapsedSec: result.meta.elapsed_sec };
    if (process.env.KRDS_ADULT_EVALUATION_REPORT) await writeFile(process.env.KRDS_ADULT_EVALUATION_REPORT + "." + fixtureFile, JSON.stringify(report, null, 2) + "\n");
    expect(report).toMatchObject({ checkedPages: 3, documents: 5, expected: 6, tp: 6, fp: 0, fn: 0, duplicates: 0, resolved: 6, officialFindings: 6, failedPages: 0, timedOut: false });
    expect(result.findings.map(f => new URL(f.url).search)).toContain("?id=41");
    expect(result.findings.map(f => new URL(f.url).search)).toContain("?id=42");
  } finally {
    server.closeAllConnections();
    await new Promise<void>((done, reject) => server.close(e => e ? reject(e) : done()));
  }
}, 60000);
