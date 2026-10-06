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
import type { Frame, Page } from "playwright-core";
import {
  initialProgress,
  findingIdentityKey,
  validateScanDetailBundle,
  type OfficialResult,
  type ExtraResult,
  type ScanDetailBundle,
  type CreativeImage,
  type ImageAnalysis,
  type ScanEvent,
  type ScanProgress,
} from "@krds-detector/contracts";
import { crawlSite, ScanDeadline, type CrawlOptions } from "@krds-detector/scanner";
import { DEFAULT_SCAN_LIMITS } from "@krds-detector/contracts";
import { startFixtureServer } from "@krds-detector/synth-eval/serve.js";
import { buildEvidenceGraph, buildExtraResult, LocalOcrBackend, RuleDecisionModel, type CreativeFingerprint } from "@krds-detector/evidence";
import { semanticGate } from "./semantic.js";
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
  signal?: AbortSignal;
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
  const ocr = new LocalOcrBackend();
  if (input.fixturePort) {
    const started = startFixtureServer(input.fixturePort);
    fixtureClose = started.close;
    entryUrl = `${started.url}${input.entryUrl}`;
  }
  try {
    const allCandidates: DecidedCandidate[] = [];
    const adTextSources: { url: string; location: string; evidenceText: string; analysisText: string }[] = [];
    const confirmedIdentities = new Set<string>();
    const creatives: CreativeFingerprint[] = [];
    const creativeImages = new Map<string, Omit<CreativeImage, "findingId">>();
    const recognizedImages = new Map<string, Promise<ImageAnalysis["ocr"]>>();
    const observedImages = new Map<string, { image: Omit<CreativeImage, "findingId">; pages: Set<string> }>();
    let capturedPages = 0;
    let capturedBytes = 0;
    let capturedElements = 0;
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
      signal: input.signal,
      onLivePage: async (page, snapshot, liveFrames, images, pageRank) => {
        const pageCandidates: DecidedCandidate[] = [];
        const candidateGroups = new Map<Page | Frame, Map<string, DecidedCandidate[]>>();
        const collect = (found: DecidedCandidate[], url: string, scope: Page | Frame): void => {
          let groups = candidateGroups.get(scope);
          if (!groups) { groups = new Map(); candidateGroups.set(scope, groups); }
          for (const candidate of found) {
            const targetKey = `${candidate.selector}\0${candidate.evidenceSelector ?? candidate.selector}`;
            const group = groups.get(targetKey);
            if (group) group.push(candidate); else groups.set(targetKey, [candidate]);
          }
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
          onAdText: (source) => { adTextSources.push(source); },
        }), snapshot.url, page);
        for (const live of liveFrames) {
          if (!deadline.canStartPage(0)) break;
          const chain = live.srcChain.map((src, index) => ({ src, selector: live.selectorChain[index] ?? "iframe" }));
          try {
            const found = await detectPageCandidates(live.frame, {
              pageUrl: live.frame.url(),
              framePath: chain,
              baseUrl: snapshot.finalUrl,
              onElementsAnalyzed: (count) => { progress.elementsAnalyzed += count; },
              onAdText: (source) => { adTextSources.push(source); },
            });
            progress.framesInspected += 1;
            collect(found, live.frame.url(), live.frame);
          } catch {
            // A detached or inaccessible frame does not discard page findings.
          }
        }
        if (pageCandidates.length > 0) {
          let visual: DecidedCandidate["visual"] = { state: "unavailable", reason: "budget" };
          const beforeBoxes = new Map<DecidedCandidate, DecidedCandidate["observed"]["box"]>();
          if (capturedPages < 6 && capturedBytes < 2_000_000 && deadline.operationTimeoutMs(5000) >= 1000) {
            capturedPages += 1;
            try {
              const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, scrollX, scrollY, deviceScaleFactor: devicePixelRatio }));
              for (const [scope, groups] of candidateGroups) {
                for (const group of groups.values()) {
                  if (deadline.operationTimeoutMs(1000) < 100) break;
                  const candidate = group[0]!;
                  try {
                    const locator = scope.locator(candidate.evidenceSelector ?? candidate.selector);
                    if ((await scope.locator(candidate.selector).textContent({ timeout: deadline.operationTimeoutMs(1000) })) !== candidate.technique.rawText) continue;
                    const box = await locator.boundingBox({ timeout: Math.max(1, deadline.operationTimeoutMs(1000)) });
                    if (box) beforeBoxes.set(candidate, box);
                  } catch { /* Target metadata is optional evidence. */ }
                }
              }
              if (deadline.operationTimeoutMs(5000) < 100) throw new Error("capture budget exhausted");
              const bytes = await page.screenshot({ type: "jpeg", quality: 65, timeout: Math.max(1, deadline.operationTimeoutMs(5000)) });
              const afterViewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, scrollX, scrollY }));
              if (viewport.width !== afterViewport.width || viewport.height !== afterViewport.height
                || viewport.scrollX !== afterViewport.scrollX || viewport.scrollY !== afterViewport.scrollY) throw new Error("viewport changed during capture");
              // The manifest embeds this page image in every matching
              // finding. Budget the serialized copies, not just one capture.
              const embeddedBytes = bytes.length * pageCandidates.length;
              if (capturedBytes + embeddedBytes <= 2_000_000 && bytes.length <= 500_000) {
                capturedBytes += embeddedBytes;
                visual = { state: "available", capturedAt: new Date().toISOString(),
                  mimeType: "image/jpeg", dataUrl: `data:image/jpeg;base64,${bytes.toString("base64")}`, viewport };
              }
            } catch {
              visual = { state: "unavailable", reason: deadline.operationTimeoutMs(1000) < 100 ? "budget" : "capture-error" };
            }
          }
          for (const [scope, groups] of candidateGroups) {
            for (const group of groups.values()) {
              const candidate = group[0]!;
              if (visual.state !== "available" || !visual.viewport) { for (const item of group) item.visual = visual; continue; }
              const capture: NonNullable<DecidedCandidate["visual"]> = { ...visual,
                target: { state: "unavailable", reason: "target-unavailable" },
                element: { state: "unavailable", reason: "budget" } };
              for (const item of group) item.visual = capture;
              if (deadline.operationTimeoutMs(1000) < 100) continue;
              try {
                const locator = scope.locator(candidate.evidenceSelector ?? candidate.selector);
                const timeout = deadline.operationTimeoutMs(1000);
                if ((await scope.locator(candidate.selector).textContent({ timeout })) !== candidate.technique.rawText) {
                  capture.element = { state: "unavailable", reason: "target-unavailable" }; continue;
                }
                // Playwright reports child-frame boxes in main-frame viewport coordinates.
                const box = await locator.boundingBox({ timeout: Math.max(1, deadline.operationTimeoutMs(1000)) });
                const before = beforeBoxes.get(candidate);
                if (!box || !before || box.width <= 0 || box.height <= 0
                  || box.x !== before.x || box.y !== before.y || box.width !== before.width || box.height !== before.height) {
                  capture.element = { state: "unavailable", reason: "target-unavailable" }; continue;
                }
                capture.target = { state: "available", coordinateSpace: "main-viewport", box };
                const viewport = visual.viewport;
                let left = Math.max(0, box.x); let top = Math.max(0, box.y);
                let right = Math.min(viewport.width, box.x + box.width);
                let bottom = Math.min(viewport.height, box.y + box.height);
                if ("frameElement" in scope) {
                  let frame: Frame | null = scope;
                  for (let depth = 0; frame?.parentFrame() && depth < 4; depth += 1) {
                    const owner = await frame.frameElement();
                    try {
                      const frameBox = await owner.boundingBox();
                      if (!frameBox) throw new Error("frame bounds unavailable");
                      left = Math.max(left, frameBox.x); top = Math.max(top, frameBox.y);
                      right = Math.min(right, frameBox.x + frameBox.width);
                      bottom = Math.min(bottom, frameBox.y + frameBox.height);
                    } finally { await owner.dispose(); }
                    frame = frame.parentFrame();
                  }
                }
                const x = Math.ceil(left); const y = Math.ceil(top);
                const width = Math.floor(right) - x; const height = Math.floor(bottom) - y;
                if (width <= 0 || height <= 0) {
                  capture.element = { state: "unavailable", reason: "outside-viewport" }; continue;
                }
                if (capturedElements >= 6 || deadline.operationTimeoutMs(1000) < 100) continue;
                capturedElements += 1;
                const clip = { x, y, width, height };
                const bytes = await page.screenshot({ type: "jpeg", quality: 65, clip,
                  timeout: Math.max(1, deadline.operationTimeoutMs(1000)) });
                const after = await locator.boundingBox({ timeout: Math.max(1, deadline.operationTimeoutMs(1000)) });
                if (!after || after.x !== box.x || after.y !== box.y || after.width !== box.width || after.height !== box.height) {
                  capture.element = { state: "unavailable", reason: "target-unavailable" }; continue;
                }
                const copies = group.length;
                if (bytes.length > 500_000 || capturedBytes + bytes.length * copies > 2_000_000) continue;
                capturedBytes += bytes.length * copies;
                capture.element = { state: "available", capturedAt: new Date().toISOString(),
                  mimeType: "image/jpeg", dataUrl: `data:image/jpeg;base64,${bytes.toString("base64")}`, box: clip };
              } catch {
                capture.element = { state: "unavailable", reason: deadline.operationTimeoutMs(1000) < 100 ? "budget" : "capture-error" };
              }
            }
          }
        }
        if (pageRank < 8 && !input.signal?.aborted) {
          const captured = await collectPageCreatives(page, liveFrames.map((live) => live.frame), images,
            deadline, 250_000);
          creatives.push(...captured.prints);
          for (const image of captured.images) {
            const key = `${image.sourceUrl}\0${image.sha256}`;
            creativeImages.set(key, image);
            const prior = observedImages.get(key);
            if (prior) prior.pages.add(snapshot.url);
            else observedImages.set(key, { image, pages: new Set([snapshot.url]) });
            if (recognizedImages.has(image.sha256) || recognizedImages.size >= 6) continue;
            const timeoutMs = deadline.operationTimeoutMs(8000);
            recognizedImages.set(image.sha256, timeoutMs < 500 || input.signal?.aborted
              ? Promise.resolve({ state: "unavailable", backend: ocr.name, reason: "budget" })
              : ocr.recognize({ sourceId: image.sourceUrl, imageBytes: Buffer.from(image.dataUrl.split(",")[1]!, "base64"),
                width: image.width, height: image.height, mediaType: image.mimeType }, timeoutMs, input.signal)
                .then((text): ImageAnalysis["ocr"] => ({ state: "available", backend: text.backend,
                  text: text.text, confidence: text.confidence }))
                .catch((error: unknown): ImageAnalysis["ocr"] => ({ state: "unavailable", backend: ocr.name,
                  reason: input.signal?.aborted || error instanceof Error && error.message === "OCR budget exhausted"
                    ? "budget" : "recognition-error" })));
          }
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
    if (!summary.cancelled && !summary.pages.some((page) => page.status >= 200 && page.status < 300)) {
      throw new Error("no successfully analyzed pages");
    }

    // OCR started only for bounded image candidates while pages were live.
    // Its own deadline/abort closes the worker; await it before timestamps
    // and terminal state so no analysis outlives the preserved session.
    await Promise.all(recognizedImages.values());
    const cancelled = summary.cancelled || (input.signal?.aborted ?? false);
    const finishedAt = new Date().toISOString();
    progress.stage = "finalizing";
    emit("stage-changed", "finalizing result.json");
    const result = buildOfficialResult(
      { topic: "TOPIC", entryUrl: input.entryUrl, startedAt, finishedAt },
      allCandidates,
    );
    const json = serializeValidatedResult(result);
    const graph = buildEvidenceGraph(summary.pages.map((page) => ({
      pageUrl: page.url,
      links: page.links,
      frames: page.frames.map((frame) => ({ url: frame.url })),
      externals: page.externals.map((external) => ({ url: external.url, kind: external.kind })),
    })));
    const zeroWidthCases = [...new Map(adTextSources.filter((source) => /[\u200B-\u200D\uFEFF]/.test(source.analysisText)).map((source) => [
      `${source.url}\0${source.location}\0${source.evidenceText}`,
      source,
    ])).values()].sort((a, b) => `${a.url}\0${a.location}\0${a.evidenceText}`.localeCompare(`${b.url}\0${b.location}\0${b.evidenceText}`));
    const extraResult = buildExtraResult({
      topic: "TOPIC", entryUrl: input.entryUrl, startedAt, finishedAt,
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
      imageAnalysis: await Promise.all([...observedImages.values()].sort((a, b) => a.image.sourceUrl.localeCompare(b.image.sourceUrl))
        .map(async ({ image, pages }): Promise<ImageAnalysis> => {
          const recognition = await recognizedImages.get(image.sha256)
            ?? { state: "unavailable", backend: ocr.name, reason: "budget" };
          const gate = semanticGate(recognition.state === "available" ? recognition.text : "");
          const decision = new RuleDecisionModel().resolveAmbiguity({ rawText: "", normalizedText: gate.normalizedText,
            ocrText: recognition.state === "available" && gate.passed ? recognition.text : undefined,
            technique: "image-ocr", infrastructureRefs: pages.size, creativeSimilarity: pages.size >= 2 ? 0 : -1,
            semanticMatch: gate.passed });
          return { sourceUrl: image.sourceUrl, pageUrls: [...pages].sort(), ocr: recognition,
            matchedTerms: gate.matchedTerms, normalizedText: gate.normalizedText, decision };
        })),
      pageOutcomes: summary.pages.map((page) => ({ url: page.url, finalUrl: page.finalUrl,
        depth: page.depth, status: page.status,
        outcome: page.status > 0 && page.status < 400 ? "checked" : "failed",
        reason: page.failureReason ?? (page.status >= 400 ? `HTTP ${String(page.status)}` : undefined) })),
      creativeImages: extraResult.findings.flatMap((finding) => {
        if (finding.extra_finding !== "REUSED_AD_CREATIVE") return [];
        const print = creatives.find((item) => item.sourceUrl === finding.url
          && finding.evidence_text.includes(item.perceptualHash));
        const image = print && creativeImages.get(`${print.sourceUrl}\0${print.sha256}`);
        return image ? [{ ...image, findingId: finding.id }] : [];
      }),
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
        checkedPages: summary.pages.filter((page) => page.status > 0 && page.status < 400).length,
        failedPages: summary.pages.filter((page) => page.status === 0 || page.status >= 400)
          .map((page) => ({ url: page.url, status: page.status,
            reason: page.failureReason ?? (page.status === 0 ? "navigation-or-analysis-failed" : `HTTP ${String(page.status)}`) })),
        timedOut: summary.timedOut,
        cancelled,
      },
    };
    const detailVerdict = validateScanDetailBundle(detailBundle, result, extraResult);
    if (!detailVerdict.ok) throw new Error(`detail validation failed: ${detailVerdict.errors.join("; ")}`);
    progress.stage = cancelled ? "cancelled" : "succeeded";
    emit(cancelled ? "session-cancelled" : "session-finished", `done: ${String(result.findings.length)} findings`);
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
    await ocr.close();
    await fixtureClose?.();
  }
}
