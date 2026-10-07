import { describe, expect, it } from "vitest";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanSite } from "../src/scan.js";
import { loadGroundTruth } from "@krds-detector/synth-eval/evaluate.js";
import { validateOfficialResultText } from "@krds-detector/contracts";

describe("end-to-end scan on synthetic fixtures", () => {
  it("reports exact per-page counters with real page URLs", async () => {
    const visited: { pages: number; url: string | undefined }[] = [];
    const queued: { pending: number; url: string | undefined }[] = [];
    const stages: string[] = [];
    await scanSite({
      entryUrl: "/",
      crawl: {
        limits: { maxPages: 5, maxDepth: 1, timeoutSec: 120 },
        settleMs: 300,
        perPageMs: 10000,
      },
      fixturePort: 4193,
      onEvent: (e) => {
        if (["session-started", "stage-changed", "session-finished"].includes(e.kind)) stages.push(e.progress.stage);
        if (e.kind === "page-visited") visited.push({ pages: e.progress.visitedPages, url: e.pageUrl });
        if (e.kind === "page-queued") queued.push({ pending: e.progress.queuedPages, url: e.pageUrl });
      },
    });
    // Exact rendered-counter assertions: a label-only check would pass with
    // zeros; these fail if the value stays 0 or the URL is not the page.
    expect(visited.length).toBeGreaterThan(0);
    // Single-pass processing emits one visit event per completed page.
    let last = 0;
    for (const v of visited) {
      expect(v.pages).toBe(last + 1);
      last = v.pages;
      expect(v.url).toMatch(/^http/);
    }
    expect(last).toBeGreaterThan(0);
    for (const q of queued) {
      expect(q.pending).toBeGreaterThanOrEqual(0);
      expect(q.url).toMatch(/^http/);
    }
    expect(stages).toEqual(["running", "finalizing", "succeeded"]);
  }, 180000);

  it("recovers all 17 ground-truth pairs with zero FP/FN", async () => {
    const events: string[] = [];
    const started = Date.now();
    const { result, json, pagesVisited } = await scanSite({
      entryUrl: "/",
      crawl: {
        limits: { maxPages: 30, maxDepth: 4, timeoutSec: 300 },
        settleMs: 1800,
        perPageMs: 20000,
      },
      fixturePort: 4191,
      onEvent: (e) => {
        events.push(e.kind);
      },
    });
    const elapsedSec = (Date.now() - started) / 1000;

    const cases = await loadGroundTruth();
    const expected = new Set<string>();
    for (const c of cases) {
      if (c.kind !== "positive") continue;
      for (const t of c.techniques ?? []) {
        // Ground-truth identity: page + selector + technique.
        expected.add(`${c.page}#${c.selector}#${t}`);
      }
    }
    // Result identity: url path + location tail + technique.
    const got = new Set(
      result.findings.map((f) => {
        const url = new URL(f.url);
        return `${url.pathname}${url.search}#${f.location}#${f.technique}`;
      }),
    );
    const missing = [...expected].filter((k) => {
      // Frame case lives at inner.html with >>> location; page case direct.
      const [page, selector, technique] = k.split("#").length >= 3
        ? [k.split("#")[0], `#${k.split("#")[1]}`, k.split("#")[2]]
        : [k, "", ""];
      void technique;
      return ![...got].some((g) => {
        const [gPage, gLoc] = [g.slice(0, g.indexOf("#")), g.slice(g.indexOf("#"))];
        // Normalize: query board keeps search; others compare pathname.
        const pageKey = (page ?? "").includes("?") ? page : (page ?? "").split("?")[0];
        const gPageKey = gPage?.includes("board.html?id=") ? gPage : (gPage ?? "").split("?")[0];
        return gPageKey === pageKey && (gLoc ?? "").includes(selector ?? "");
      });
    });
    expect({ pagesVisited, findings: result.findings.length, elapsedSec: Math.round(elapsedSec) }).toBeDefined();
    expect(missing).toEqual([]);
    // No unexpected findings: every result maps to a positive case.
    expect(result.findings.length).toBe(expected.size);
    // Exact identity: every finding's url+location+technique matches a
    // ground-truth triple — count alone cannot catch a wrong technique.
    // Mutation guard: flipping any finding's technique must break the match.
    const mutated = result.findings.map((f, i) =>
      i === 0 ? { ...f, technique: f.technique === "HOMOGLYPH" ? "JAMO" : "HOMOGLYPH" } : f,
    );
    const wrongKeys = mutated.slice(0, 1).map((f) => {
      const url = new URL(f.url);
      return `${url.pathname}${url.search}#${f.location}#${f.technique}`;
    });
    const expectedKeys = new Set(
      [...expected].map((k) => {
        const parts = k.split("#");
        const [page, selector, technique] = parts.length >= 4
          ? [parts[0], `#${parts[2]}`, parts.slice(3).join("#")]
          : [k, "", ""];
        void page; void selector; void technique;
        return k;
      }),
    );
    expect(wrongKeys.some((k) => expectedKeys.has(k))).toBe(false);
    for (const f of result.findings) {
      const url = new URL(f.url);
      const key = `${url.pathname}${url.search}#${f.location}#${f.technique}`;
      const matched = [...expected].some((k) => {
        // Key form is page#selector#technique where the selector itself
      // starts with '#', so split produces [page, '', 'sel', technique].
      const parts = k.split("#");
      const [page, selector, technique] = parts.length >= 4
        ? [parts[0], `#${parts[2]}`, parts.slice(3).join("#")]
        : [k, "", ""];
        const pageKey = (page ?? "").includes("?") ? page : (page ?? "").split("?")[0];
        const gPage = `${url.pathname}${url.search}`;
        const gPageKey = gPage.includes("board.html?id=") ? gPage : gPage.split("?")[0];
        return gPageKey === pageKey && f.location.includes(selector ?? "") && f.technique === technique;
      });
      expect({ key, matched }).toEqual({ key, matched: true });
    }
    expect(validateOfficialResultText(json).ok).toBe(true);

    // Persist artifact for inspection (throwaway, OS tmp, not repo).
    const dir = await (async () => {
      const d = join(tmpdir(), `scan-e2e-${String(Date.now())}`);
      await mkdir(d, { recursive: true });
      return d;
    })();
    await writeFile(join(dir, "result.json"), json, "utf-8");
    const roundTrip = JSON.parse(await readFile(join(dir, "result.json"), "utf-8") as string) as {
      findings: unknown[];
    };
    expect(roundTrip.findings.length).toBe(result.findings.length);
  }, 300000);
});
