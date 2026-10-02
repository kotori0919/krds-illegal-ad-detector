/**
 * End-to-end scan: crawl → detect per page (+ frames) → result engine.
 *
 * This is the Phase 5–10 integration seam: the Playwright crawler supplies
 * live pages, the detection pipeline scores candidates with the two-axis
 * gate, and the result engine emits validated result.json. ScanEvent
 * progress flows through the optional callback using the frozen contract
 * vocabulary.
 */
import { chromium, type Browser } from "playwright-core";
import {
  initialProgress,
  type OfficialResult,
  type ScanEvent,
  type ScanProgress,
} from "@krds-detector/contracts";
import { crawlSite, type CrawlOptions } from "@krds-detector/scanner";
import { startFixtureServer } from "@krds-detector/synth-eval/serve.js";
import { detectPageCandidates } from "./pipeline.js";
import { buildOfficialResult, serializeValidatedResult } from "./result-engine.js";

export interface ScanInput {
  entryUrl: string;
  topic?: string;
  crawl?: Omit<CrawlOptions, "entryUrl" | "events">;
  /** Serve fixtures in-process when set (tests / local eval). */
  fixturePort?: number;
  onEvent?: (event: ScanEvent) => void;
}

export interface ScanOutput {
  result: OfficialResult;
  json: string;
  pagesVisited: number;
}

export async function scanSite(input: ScanInput): Promise<ScanOutput> {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const sessionId = `scan-${String(t0)}`;
  const progress: ScanProgress = initialProgress("crawling");
  const emit = (kind: ScanEvent["kind"], message?: string, pageUrl?: string): void => {
    progress.elapsedSec = (Date.now() - t0) / 1000;
    input.onEvent?.({ kind, sessionId, at: new Date().toISOString(), progress: { ...progress }, message, pageUrl });
  };

  emit("session-started", `scan started: ${input.entryUrl}`, input.entryUrl);
  let fixtureClose: (() => Promise<void>) | undefined;
  let entryUrl = input.entryUrl;
  if (input.fixturePort) {
    const started = startFixtureServer(input.fixturePort);
    fixtureClose = started.close;
    entryUrl = `${started.url}${input.entryUrl}`;
  }
  let browser: Browser | undefined;
  try {
    // Crawl for discovery (same-site BFS, dedup, hostile guards).
    // Stream per-page progress so the desktop host can show real counters
    // (KODEX §36): the worker forwards these as scan-event IPC.
    const summary = await crawlSite({
      entryUrl,
      limits: input.crawl?.limits,
      settleMs: input.crawl?.settleMs,
      perPageMs: input.crawl?.perPageMs,
      executablePath: input.crawl?.executablePath,
      channel: input.crawl?.channel,
      events: {
        onPageVisited: (snapshot) => {
          // Real per-page state: the CURRENT page URL and the ACTUAL
          // remaining queue depth (not a reset zero). Tests assert these.
          progress.visitedPages += 1;
          emit("page-visited", `crawled ${String(progress.visitedPages)} pages`, snapshot.url);
        },
        onPageQueued: (queued) => {
          progress.queuedPages = queued.pending;
          emit("page-queued", `${String(queued.pending)} pages queued`, queued.url);
        },
      },
    });
    progress.visitedPages = summary.pages.length;
    progress.queuedPages = 0;
    progress.stage = "analyzing";
    emit("stage-changed", `crawled ${String(summary.pages.length)} pages; analyzing`, entryUrl);

    // Detect per discovered page in a fresh context (crawler snapshots are
    // static HTML; live pages give computed style + geometry).
    browser = await chromium.launch({ executablePath: input.crawl?.executablePath, channel: input.crawl?.channel, args: ["--no-sandbox"] });
    const context = await browser.newContext();
    const allCandidates = [];
    for (const snapshot of summary.pages) {
      const page = await context.newPage();
      try {
        await page.goto(snapshot.url, { waitUntil: "commit", timeout: 20000 });
        const settle = input.crawl?.settleMs ?? 1500;
        await page.waitForTimeout(Math.min(settle, 5000));
        const found = await detectPageCandidates(page, { pageUrl: snapshot.url });
        progress.elementsAnalyzed += found.length;
        progress.candidates += found.length;
        for (const c of found) allCandidates.push(c);
        if (found.length > 0) {
          progress.confirmedFindings += found.length;
          emit("finding-confirmed", `${String(found.length)} candidates on ${snapshot.url}`, snapshot.url);
        }
        emit("page-visited", snapshot.url, snapshot.url);
      } finally {
        await page.close().catch(() => undefined);
      }
      // Frame-level detection for nested iframe ads. Crawler FrameSnapshots
      // carry full ancestor chains; detect each frame document in place.
      for (const frame of snapshot.frames) {
        const chain: { src: string; selector: string }[] = frame.srcChain.map((src, i) => ({
          src,
          selector: frame.selectorChain[i] ?? "iframe",
        }));
        const framePage = await context.newPage();
        try {
          await framePage.goto(frame.url, { waitUntil: "commit", timeout: 20000 });
          await framePage.waitForTimeout(500);
          const found = await detectPageCandidates(framePage, {
            pageUrl: frame.url,
            framePath: chain,
            baseUrl: snapshot.finalUrl,
          });
          progress.framesInspected += 1;
          for (const c of found) allCandidates.push(c);
          if (found.length > 0) {
            progress.confirmedFindings += found.length;
            emit("finding-confirmed", `${String(found.length)} frame candidates on ${frame.url}`, frame.url);
          }
        } finally {
          await framePage.close().catch(() => undefined);
        }
      }
    }
    await context.close();
    await browser.close();
    browser = undefined;

    const finishedAt = new Date().toISOString();
    progress.stage = "finalizing";
    emit("stage-changed", "finalizing result.json");
    const result = buildOfficialResult(
      { topic: input.topic ?? "", entryUrl: input.entryUrl, startedAt, finishedAt },
      allCandidates,
    );
    const json = serializeValidatedResult(result);
    progress.stage = "done";
    emit("session-finished", `done: ${String(result.findings.length)} findings`);
    return { result, json, pagesVisited: summary.pages.length };
  } finally {
    await browser?.close().catch(() => undefined);
    await fixtureClose?.();
  }
}
