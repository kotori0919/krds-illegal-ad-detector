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
  findingIdentityKey,
  validateScanDetailBundle,
  type OfficialResult,
  type ScanDetailBundle,
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
  detailBundle: ScanDetailBundle;
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
    let capturedPages = 0;
    let capturedBytes = 0;
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
        const pageCandidates: DecidedCandidate[] = [];
        const collect = (found: DecidedCandidate[], url: string): void => {
          pageCandidates.push(...found);
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
        if (pageCandidates.length > 0) {
          let visual: DecidedCandidate["visual"] = { state: "unavailable", reason: "budget" };
          if (capturedPages < 6 && capturedBytes < 2_000_000 && deadline.operationTimeoutMs(5000) >= 1000) {
            capturedPages += 1;
            try {
              const bytes = await page.screenshot({ type: "jpeg", quality: 65, timeout: deadline.operationTimeoutMs(5000) });
              // The manifest embeds this page image in every matching
              // finding. Budget the serialized copies, not just one capture.
              const embeddedBytes = bytes.length * pageCandidates.length;
              if (capturedBytes + embeddedBytes <= 2_000_000 && bytes.length <= 500_000) {
                capturedBytes += embeddedBytes;
                const viewport = await page.evaluate(() => ({
                  width: innerWidth, height: innerHeight, scrollX, scrollY,
                }));
                visual = { state: "available", capturedAt: new Date().toISOString(),
                  mimeType: "image/jpeg", dataUrl: `data:image/jpeg;base64,${bytes.toString("base64")}`, viewport };
              }
            } catch {
              visual = { state: "unavailable", reason: "capture-error" };
            }
          }
          for (const candidate of pageCandidates) candidate.visual = visual;
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
    const candidatesByIdentity = new Map<string, DecidedCandidate>();
    for (const candidate of allCandidates) {
      const key = `${findingIdentityKey({ url: candidate.url, location: candidate.location, technique: candidate.technique.technique })}\0${candidate.technique.rawText}`;
      if (!candidatesByIdentity.has(key)) candidatesByIdentity.set(key, candidate);
    }
    const detailBundle: ScanDetailBundle = {
      version: 2,
      findings: result.findings.map((finding) => {
        const key = `${findingIdentityKey(finding)}\0${finding.evidence_text}`;
        const candidate = candidatesByIdentity.get(key);
        if (!candidate) throw new Error(`detail candidate missing for ${finding.id}`);
        return {
          findingId: finding.id, url: finding.url, location: finding.location,
          technique: finding.technique, rawText: finding.evidence_text,
          normalizedText: candidate.illegalAd.normalizedText ?? "",
          matchedTerms: candidate.illegalAd.matchedTerms,
          techniqueReason: candidate.technique.detail,
          destinationUrl: candidate.illegalAd.destinationUrl,
          observed: candidate.observed,
          visual: candidate.visual ?? { state: "unavailable", reason: "budget" },
        };
      }),
      coverage: {
        checkedPages: summary.pages.length,
        failedPages: summary.pages.filter((page) => page.status === 0 || page.status >= 400)
          .map((page) => ({ url: page.url, status: page.status,
            reason: page.status === 0 ? "navigation-or-analysis-failed" : `HTTP ${String(page.status)}` })),
        timedOut: summary.timedOut,
      },
    };
    const detailVerdict = validateScanDetailBundle(detailBundle, result);
    if (!detailVerdict.ok) throw new Error(`detail validation failed: ${detailVerdict.errors.join("; ")}`);
    progress.stage = "done";
    emit("session-finished", `done: ${String(result.findings.length)} findings`);
    return {
      result,
      json,
      pagesVisited: summary.pages.length,
      failedPages: summary.pages.filter((page) => page.status === 0 || page.status >= 400).length,
      timedOut: summary.timedOut,
      detailBundle,
    };
  } finally {
    await fixtureClose?.();
  }
}
