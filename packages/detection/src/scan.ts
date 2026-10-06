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
  type ExtraResult,
  type ScanDetailBundle,
  type ScanEvent,
  type ScanProgress,
} from "@krds-detector/contracts";
import { crawlSite, ScanDeadline, type CrawlOptions } from "@krds-detector/scanner";
import { DEFAULT_SCAN_LIMITS } from "@krds-detector/contracts";
import { startFixtureServer } from "@krds-detector/synth-eval/serve.js";
import { buildEvidenceGraph, buildExtraResult, type CreativeFingerprint } from "@krds-detector/evidence";
import { collectPageCreatives } from "./creative.js";
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
  extraResult: ExtraResult;
  extraJson: string;
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
  const progress: ScanProgress = initialProgress("running");
  const emit = (kind: ScanEvent["kind"], message?: string, pageUrl?: string, findingCount?: number): void => {
    progress.sequence += 1;
    progress.elapsedSec = (performance.now() - t0) / 1000;
    if (kind === "session-started" || kind === "finding-confirmed" || kind === "page-failed" || kind === "stage-changed"
      || kind === "session-finished" || kind === "session-cancelled" || kind === "session-failed") {
      progress.recentActivity = [{ sequence: progress.sequence, kind, elapsedSec: progress.elapsedSec,
        stage: progress.stage, pageUrl, findingCount }, ...progress.recentActivity].slice(0, 5);
    }
    input.onEvent?.({ kind, sessionId, at: new Date().toISOString(),
      progress: { ...progress, currentPages: [...progress.currentPages], recentActivity: [...progress.recentActivity] }, message, pageUrl });
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
    const confirmedIdentities = new Set<string>();
    const creatives: CreativeFingerprint[] = [];
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
      onLivePage: async (page, snapshot, liveFrames, images, pageRank) => {
        const pageCandidates: DecidedCandidate[] = [];
        const collect = (found: DecidedCandidate[], url: string): void => {
          pageCandidates.push(...found);
          allCandidates.push(...found);
          progress.candidates += found.length;
          let added = 0;
          for (const candidate of found) {
            const identity = findingIdentityKey({ url: candidate.url, location: candidate.location,
              technique: candidate.technique.technique });
            if (!confirmedIdentities.has(identity)) { confirmedIdentities.add(identity); added += 1; }
          }
          progress.confirmedFindings = confirmedIdentities.size;
          if (added > 0) emit("finding-confirmed", `${String(added)} findings on ${url}`, url, added);
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
        if (pageRank < 8) {
          const captured = await collectPageCreatives(page, liveFrames.map((live) => live.frame), images,
            deadline, 250_000);
          creatives.push(...captured.prints);
        }
      },
      events: {
        onPageStarted: (url, queuedPages) => {
          progress.currentPages.push(url);
          progress.queuedPages = queuedPages;
          emit("page-started", undefined, url);
        },
        onPageVisited: (snapshot, queuedPages) => {
          progress.visitedPages += 1;
          progress.queuedPages = queuedPages;
          progress.currentPages = progress.currentPages.filter((url) => url !== snapshot.url);
          const failed = snapshot.status === 0 || snapshot.status >= 400;
          if (failed) progress.failedPages += 1;
          emit(failed ? "page-failed" : "page-visited", undefined, snapshot.url);
        },
        onPageQueued: (queued) => {
          progress.queuedPages = queued.pending;
          emit("page-queued", `${String(queued.pending)} pages queued`, queued.url);
        },
      },
    });
    progress.visitedPages = summary.pages.length;
    progress.queuedPages = 0;
    progress.currentPages = [];
    if (!summary.pages.some((page) => page.status >= 200 && page.status < 300)) {
      throw new Error("no successfully analyzed pages");
    }

    const finishedAt = new Date().toISOString();
    progress.stage = "finalizing";
    emit("stage-changed", "finalizing result.json");
    const result = buildOfficialResult(
      { topic: input.topic ?? "", entryUrl: input.entryUrl, startedAt, finishedAt },
      allCandidates,
    );
    const json = serializeValidatedResult(result);
    const graph = buildEvidenceGraph(summary.pages.map((page) => ({
      pageUrl: page.url,
      links: page.links,
      frames: page.frames.map((frame) => ({ url: frame.url })),
      externals: page.externals.map((external) => ({ url: external.url, kind: external.kind })),
    })));
    const zeroWidthCases = [...new Map(allCandidates.map((candidate) => [
      `${candidate.url}\0${candidate.location}\0${candidate.technique.rawText}`,
      { url: candidate.url, location: candidate.location, evidenceText: candidate.technique.rawText },
    ])).values()].sort((a, b) => `${a.url}\0${a.location}\0${a.evidenceText}`.localeCompare(`${b.url}\0${b.location}\0${b.evidenceText}`));
    const extraResult = buildExtraResult({
      topic: input.topic ?? "", entryUrl: input.entryUrl, startedAt, finishedAt,
      creatives: creatives.sort((a, b) => a.sourceUrl.localeCompare(b.sourceUrl) || a.sha256.localeCompare(b.sha256)),
      graph, zeroWidthCases,
    });
    const extraJson = `${JSON.stringify(extraResult, null, 2)}\n`;
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
    progress.stage = "succeeded";
    emit("session-finished", `done: ${String(result.findings.length)} findings`);
    return {
      result,
      json,
      extraResult,
      extraJson,
      pagesVisited: summary.pages.length,
      failedPages: summary.pages.filter((page) => page.status === 0 || page.status >= 400).length,
      timedOut: summary.timedOut,
      detailBundle,
    };
  } catch (error) {
    progress.currentPages = [];
    progress.queuedPages = 0;
    progress.stage = "failed";
    emit("session-failed", error instanceof Error ? error.message : "scan failed");
    throw error;
  } finally {
    await fixtureClose?.();
  }
}
