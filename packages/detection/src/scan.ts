/**
 * End-to-end scan: discover and detect on each live page → result engine.
 *
 * This is the Phase 5–10 integration seam: the Playwright crawler supplies
 * live pages, the detection pipeline scores candidates with the two-axis
 * gate, and the result engine emits validated result.json. ScanEvent
 * progress flows through the optional callback using the frozen contract
 * vocabulary.
 */
import { performance } from "node:perf_hooks";
import {
  initialProgress,
  type OfficialResult,
  type ScanEvent,
  type ScanProgress,
} from "@krds-detector/contracts";
import { crawlSite, ScanDeadline, type CrawlOptions } from "@krds-detector/scanner";
import { DEFAULT_SCAN_LIMITS } from "@krds-detector/contracts";
import { startFixtureServer } from "@krds-detector/synth-eval/serve.js";
import { detectPageCandidates, type DecidedCandidate } from "./pipeline.js";
import { buildOfficialResult, serializeValidatedResult } from "./result-engine.js";

export interface ScanInput {
  entryUrl: string;
  topic?: string;
  crawl?: Omit<CrawlOptions, "entryUrl" | "events" | "deadline" | "onLivePage">;
  /** Serve fixtures in-process when set (tests / local eval). */
  fixturePort?: number;
  onEvent?: (event: ScanEvent) => void;
}

export interface ScanOutput {
  result: OfficialResult;
  json: string;
  pagesVisited: number;
  failedPages: number;
  timedOut: boolean;
}

export async function scanSite(input: ScanInput): Promise<ScanOutput> {
  const startedAt = new Date().toISOString();
  const t0 = performance.now();
  const sessionId = `scan-${String(Date.now())}`;
  const deadline = new ScanDeadline(input.crawl?.limits?.timeoutSec ?? DEFAULT_SCAN_LIMITS.timeoutSec);
  const progress: ScanProgress = initialProgress("crawling");
  const emit = (kind: ScanEvent["kind"], message?: string, pageUrl?: string): void => {
    progress.elapsedSec = (performance.now() - t0) / 1000;
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
  try {
    const allCandidates: DecidedCandidate[] = [];
    // Discovery and detection share the same live Page, Frame tree and clock.
    const summary = await crawlSite({
      entryUrl,
      limits: input.crawl?.limits,
      settleMs: input.crawl?.settleMs,
      perPageMs: input.crawl?.perPageMs,
      executablePath: input.crawl?.executablePath,
      channel: input.crawl?.channel,
      concurrency: input.crawl?.concurrency,
      deadline,
      onLivePage: async (page, snapshot, liveFrames) => {
        const collect = (found: DecidedCandidate[], url: string): void => {
          allCandidates.push(...found);
          progress.candidates += found.length;
          progress.confirmedFindings += found.length;
          if (found.length > 0) emit("finding-confirmed", `${String(found.length)} candidates on ${url}`, url);
        };
        collect(await detectPageCandidates(page, {
          pageUrl: snapshot.url,
          onElementsAnalyzed: (count) => { progress.elementsAnalyzed += count; },
        }), snapshot.url);
        for (const live of liveFrames) {
          if (!deadline.canStartPage(0)) break;
          const chain = live.srcChain.map((src, index) => ({ src, selector: live.selectorChain[index] ?? "iframe" }));
          try {
            const found = await detectPageCandidates(live.frame, {
              pageUrl: live.frame.url(),
              framePath: chain,
              baseUrl: snapshot.finalUrl,
              onElementsAnalyzed: (count) => { progress.elementsAnalyzed += count; },
            });
            progress.framesInspected += 1;
            collect(found, live.frame.url());
          } catch {
            // A detached or inaccessible frame does not discard page findings.
          }
        }
      },
      events: {
        onPageVisited: (snapshot) => {
          progress.visitedPages += 1;
          emit("page-visited", `processed ${String(progress.visitedPages)} pages`, snapshot.url);
        },
        onPageQueued: (queued) => {
          progress.queuedPages = queued.pending;
          emit("page-queued", `${String(queued.pending)} pages queued`, queued.url);
        },
      },
    });
    progress.visitedPages = summary.pages.length;
    progress.queuedPages = 0;

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
    return {
      result,
      json,
      pagesVisited: summary.pages.length,
      failedPages: summary.pages.filter((page) => page.status === 0 || page.status >= 400).length,
      timedOut: summary.timedOut,
    };
  } finally {
    await fixtureClose?.();
  }
}
