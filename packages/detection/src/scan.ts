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
  SCAN_POLICY,
  findingIdentityKey,
  validateScanDetailBundle,
  type OfficialResult,
  type ExtraResult,
  type ScanDetailBundle,
  type ImageAnalysis,
  type ScanEvent,
  type ScanProgress,
  type VisualAnalysisCoverage,
  type VisualAnalysisReason,
  type VisualAnalysisLimit,
} from "@krds-detector/contracts";
import { crawlSite, ScanDeadline, type CrawlOptions } from "@krds-detector/scanner";
import { DEFAULT_SCAN_LIMITS } from "@krds-detector/contracts";
import { buildEvidenceGraph, buildExtraResult, groupSimilarCreatives, summarizeInfrastructure, LocalOcrBackend, type CreativeFingerprint, type GraphInput } from "@krds-detector/evidence";
import { semanticGate } from "./semantic.js";
import { livePageVisualSource, type CapturedVisualImage } from "./creative.js";
import { decideVisualImage } from "./visual-decision.js";
import { detectPageCandidates, type DecidedCandidate } from "./pipeline.js";
import { buildOfficialResult, serializeValidatedResult } from "./result-engine.js";
import { CaptureStore, VisualScheduler, VISUAL_LIMITS } from "./visual-scheduler.js";
import { CandidateAccumulator } from "./candidate-accumulator.js";

export interface ScanInput {
  entryUrl: string;
  crawl?: Omit<CrawlOptions, "entryUrl" | "events" | "deadline" | "onLivePage">;
  onEvent?: (event: ScanEvent) => void;
  signal?: AbortSignal;
  deadline?: ScanDeadline;
  /** Mandatory output port, invoked before any optional finalization. */
  commitOfficial?: (json: string) => void;
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
  const deadline = input.deadline ?? new ScanDeadline(input.crawl?.limits?.timeoutSec ?? DEFAULT_SCAN_LIMITS.timeoutSec);
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
  const entryUrl = input.entryUrl;
  const ocr = new LocalOcrBackend();
  try {
    const candidates = new CandidateAccumulator();
    const adTextSources: { url: string; location: string; evidenceText: string; analysisText: string }[] = [];
    let adTextBytes = 0;
    const creativeOccurrences: { print: CreativeFingerprint; pageUrl: string; image: CapturedVisualImage }[] = [];
    const creativeImages = new Map<string, CapturedVisualImage>();
    const visualScheduler = new VisualScheduler();
    const captureStore = new CaptureStore();
    const analysisIssues: string[] = [];
    const visualAnalysisCoverage: VisualAnalysisCoverage = {
      pagesConsidered: 0, pagesNotConsidered: 0, candidatesObserved: 0, candidateTotal: null,
      imagesAcquired: 0, imageAnalysisRecords: 0, ocrImagesAttempted: 0, ocrImagesCompleted: 0, ocrImagesUnavailable: 0,
      limits: { pages: input.crawl?.limits?.maxPages ?? DEFAULT_SCAN_LIMITS.maxPages, candidatesPerDocument: SCAN_POLICY.visual.candidatesPerDocument, elementsPerDocument: SCAN_POLICY.visual.elementsPerDocument,
        bytesPerPage: VISUAL_LIMITS.bytesPerPage, distinctOcrImages: VISUAL_LIMITS.ocrImages },
      limitsReached: [], skips: [],
    };
    const visualSkip = (reason: VisualAnalysisReason, unit: "page" | "document" | "candidate" | "image", count = 1): void => {
      if (count <= 0) return;
      const prior = visualAnalysisCoverage.skips.find((item) => item.reason === reason && item.unit === unit);
      if (prior) prior.count += count; else visualAnalysisCoverage.skips.push({ reason, unit, count });
      if (["page-limit", "candidate-limit", "element-limit", "byte-limit", "ocr-image-limit", "deadline"].includes(reason)
        && !visualAnalysisCoverage.limitsReached.includes(reason as VisualAnalysisLimit)) visualAnalysisCoverage.limitsReached.push(reason as VisualAnalysisLimit);
    };
    // Discovery and detection share the same live Page, Frame tree and clock.
    const summary = await crawlSite({
      entryUrl,
      limits: input.crawl?.limits,
      settleMs: input.crawl?.settleMs,
      perPageMs: input.crawl?.perPageMs,
      executablePath: input.crawl?.executablePath,
      channel: input.crawl?.channel,
      concurrency: input.crawl?.concurrency,
      publicNetworkOnly: input.crawl?.publicNetworkOnly,
      entryKind: input.crawl?.entryKind,
      networkPolicyForTesting: input.crawl?.networkPolicyForTesting,
      publicTransport: input.crawl?.publicTransport,
      deadline,
      signal: input.signal,
      onLivePage: async (page, snapshot, liveFrames, images) => {
        let capturedElements = 0;
        for (const issue of snapshot.collectionIssues ?? []) analysisIssues.push(issue);
        const pageCandidates: DecidedCandidate[] = [];
        const candidateGroups = new Map<Page | Frame, Map<string, DecidedCandidate[]>>();
        const addPageIssue = (issue: string): void => {
          analysisIssues.push(issue);
          snapshot.collectionIssues = [...new Set([...(snapshot.collectionIssues ?? []), issue])];
        };
        const adTextSource = (source: typeof adTextSources[number]): void => {
          if (!/[\u200B-\u200D\uFEFF]/.test(source.analysisText)) return;
          const cost = Buffer.byteLength(JSON.stringify(source), "utf8");
          if (adTextSources.length >= SCAN_POLICY.evidence.findings || adTextBytes + cost > SCAN_POLICY.evidence.retainedBytes) {
            addPageIssue("AUXILIARY_TEXT_COLLECTION_LIMIT"); return;
          }
          adTextSources.push(source); adTextBytes += cost;
        };
        const collect = (found: DecidedCandidate[], url: string, scope: Page | Frame): void => {
          const priorCount = candidates.coverage().retainedFindings;
          candidates.offer(found, snapshot.url);
          const accepted = found.filter((candidate) => candidates.contains(candidate));
          if (accepted.length < found.length) addPageIssue("FINDING_COLLECTION_LIMIT");
          let groups = candidateGroups.get(scope);
          if (!groups) { groups = new Map(); candidateGroups.set(scope, groups); }
          for (const candidate of accepted) {
            const targetKey = `${candidate.selector}\0${candidate.evidenceSelector ?? candidate.selector}`;
            const group = groups.get(targetKey);
            if (group) group.push(candidate); else groups.set(targetKey, [candidate]);
          }
          pageCandidates.push(...accepted);
          progress.candidates += found.length;
          progress.confirmedFindings = candidates.coverage().retainedFindings;
          const added = Math.max(0, progress.confirmedFindings - priorCount);
          if (added > 0) emit("finding-confirmed", `${String(added)} findings on ${url}`, url, added);
        };
        collect(await detectPageCandidates(page, {
          pageUrl: snapshot.url,
          onTextCollectionIssue: (issue) => { addPageIssue(`${issue.code}: ${issue.detail}`); },
          onElementsAnalyzed: (count) => { progress.elementsAnalyzed += count; },
          onAdText: adTextSource,
        }), snapshot.url, page);
        for (const live of liveFrames) {
          if (!deadline.canStartPage(0)) break;
          const chain = live.srcChain.map((src, index) => ({ src, selector: live.selectorChain[index] ?? "iframe" }));
          try {
            const found = await detectPageCandidates(live.frame, {
              pageUrl: snapshot.finalUrl,
              framePath: chain,
              frameVisibility: live.visibilityContext,
              baseUrl: snapshot.finalUrl,
              onTextCollectionIssue: (issue) => { addPageIssue(`${issue.code}: ${issue.detail}`); },
              onElementsAnalyzed: (count) => { progress.elementsAnalyzed += count; },
              onAdText: adTextSource,
            });
            progress.framesInspected += 1;
            collect(found, snapshot.finalUrl, live.frame);
          } catch {
            analysisIssues.push("frame-detection-unavailable");
          }
        }
        if (pageCandidates.length > 0) {
          let visual: DecidedCandidate["visual"] = { state: "unavailable", reason: "budget" };
          const beforeBoxes = new Map<DecidedCandidate, DecidedCandidate["observed"]["box"]>();
          if (deadline.operationTimeoutMs(5000) >= 1000) {
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
              const assetId = captureStore.add(bytes);
              if (assetId) {
                visual = { state: "available", capturedAt: new Date().toISOString(),
                  mimeType: "image/jpeg", assetId, viewport };
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
                const assetId = captureStore.add(bytes);
                if (!assetId) continue;
                capture.element = { state: "available", capturedAt: new Date().toISOString(),
                  mimeType: "image/jpeg", assetId, box: clip };
              } catch {
                capture.element = { state: "unavailable", reason: deadline.operationTimeoutMs(1000) < 100 ? "budget" : "capture-error" };
              }
            }
          }
        }
        if (!input.signal?.aborted) {
          visualAnalysisCoverage.pagesConsidered += 1;
          const outcome = await livePageVisualSource.acquire({ page, frames: liveFrames, responses: images,
            deadline, maxBytes: VISUAL_LIMITS.bytesPerPage, signal: input.signal });
          if (outcome.state === "unavailable") {
            analysisIssues.push(`visual-source:${outcome.issue.code}`);
            visualSkip(input.signal?.aborted ? "cancelled" : deadline.operationTimeoutMs(2000) < 500 ? "deadline" : "capture-error", "page");
            return;
          }
          const captured = outcome.value;
          for (const issue of outcome.degradation) analysisIssues.push(`visual-source:${issue.code}`);
          visualAnalysisCoverage.candidatesObserved += captured.coverage.candidatesObserved;
          visualAnalysisCoverage.imagesAcquired += captured.images.length;
          for (const item of captured.coverage.skips) visualSkip(item.reason, item.unit, item.count);
          visualScheduler.offer(snapshot.url, captured.images, captured.prints);
        } else {
          visualAnalysisCoverage.pagesNotConsidered += 1;
          visualSkip(input.signal?.aborted ? "cancelled" : "page-limit", "page");
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
          const failed = snapshot.issue !== undefined || snapshot.status === 0 || snapshot.status >= 400;
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
    const allCandidates = candidates.values();
    const limitedPages = new Set(candidates.coverage().limitedPages);
    for (const page of summary.pages) if (limitedPages.has(page.url)) page.collectionIssues = [...new Set([...(page.collectionIssues ?? []), "FINDING_COLLECTION_LIMIT"])];
    if (limitedPages.size) analysisIssues.push("FINDING_COLLECTION_LIMIT");

    const cancelled = summary.cancelled || (input.signal?.aborted ?? false);
    const finishedAt = new Date().toISOString();
    progress.stage = "finalizing";
    emit("stage-changed", "finalizing result.json");
    const result = buildOfficialResult(
      { topic: "TOPIC", entryUrl: input.entryUrl, startedAt, finishedAt },
      allCandidates,
    );
    const json = serializeValidatedResult(result);
    input.commitOfficial?.(json);
    const officialFinalizedAt = new Date().toISOString();
    // All useful pages contributed already-acquired bounded bytes. Optional
    // OCR selects once over the complete retained scope, after official commit.
    // A closed canvas is never revisited or promised a later acquisition.
    const retained = [...visualScheduler.retained()];
    const observations = retained.sort((a,b)=>a.key.localeCompare(b.key)).map((record)=>({image:record.image,pages:new Set([record.pageUrl])}));
    for (const record of retained) {
      creativeOccurrences.push({ print: record.print, pageUrl: record.pageUrl, image: record.image });
      creativeImages.set(`${record.image.sourceUrl}\0${record.image.sha256}`, record.image);
    }
    const selection = visualScheduler.coverage();
    visualAnalysisCoverage.selection = selection;
    if (selection.excludedRecords > 0) visualSkip("byte-limit", "image", selection.excludedRecords);
    if (selection.retainedAssets > VISUAL_LIMITS.ocrImages) visualSkip("ocr-image-limit", "image", selection.retainedAssets - VISUAL_LIMITS.ocrImages);
    const recognitions = new Map<string, ImageAnalysis["ocr"]>();
    for (const { image } of visualScheduler.selectOcr()) {
      const timeoutMs = deadline.operationTimeoutMs(SCAN_POLICY.visual.ocrTimeoutMs);
      if (timeoutMs < 500 || input.signal?.aborted) {
        visualSkip(input.signal?.aborted ? "cancelled" : "deadline", "image");
        recognitions.set(image.sha256, { state: "unavailable", backend: ocr.name, reason: "budget" }); continue;
      }
      visualAnalysisCoverage.ocrImagesAttempted += 1;
      if (visualAnalysisCoverage.ocrImagesAttempted === VISUAL_LIMITS.ocrImages && !visualAnalysisCoverage.limitsReached.includes("ocr-image-limit")) visualAnalysisCoverage.limitsReached.push("ocr-image-limit");
      try {
        const text = await ocr.recognize({ sourceId: image.sourceUrl, imageBytes: Buffer.from(image.dataUrl.split(",")[1]!, "base64"),
          width: image.width, height: image.height, mediaType: image.mimeType }, timeoutMs, input.signal);
        visualAnalysisCoverage.ocrImagesCompleted += 1;
        recognitions.set(image.sha256, { state: "available", backend: text.backend, text: text.text, confidence: text.confidence });
      } catch (error) {
        visualAnalysisCoverage.ocrImagesUnavailable += 1;
        const exhausted = error instanceof Error && error.message === "OCR budget exhausted";
        visualSkip(input.signal?.aborted ? "cancelled" : exhausted ? "deadline" : "image-unavailable", "image");
        recognitions.set(image.sha256, { state: "unavailable", backend: ocr.name, reason: input.signal?.aborted || exhausted ? "budget" : "recognition-error" });
      }
    }
    for (const page of summary.pages) analysisIssues.push(...(page.collectionIssues ?? []));
    // Evicted capture bytes have already been released. References are now
    // normalized to an explicit unavailable state rather than dangling IDs.
    for (const candidate of allCandidates) {
      const visual = candidate.visual;
      if (visual?.state !== "available") continue;
      if (!captureStore.has(visual.assetId)) { candidate.visual = { state: "unavailable", reason: "budget" }; continue; }
      if (visual.element?.state === "available" && !captureStore.has(visual.element.assetId)) visual.element = { state: "unavailable", reason: "budget" };
    }
    const eligible = creativeOccurrences.filter(({image}) => image.candidate.candidateEvidence.includes("ad-marker"));
    // Repetition needs advertisement context and distinct observed pages.
    // External-linked logos alone remain observed resources.
    for (const occurrence of creativeOccurrences) {
      const recognition = recognitions.get(occurrence.image.sha256);
      if (!eligible.includes(occurrence) && recognition?.state === "available" && semanticGate(recognition.text).passed) eligible.push(occurrence);
    }
    eligible.sort((a,b)=>`${a.print.sourceUrl}\0${a.print.sha256}\0${a.pageUrl}`.localeCompare(`${b.print.sourceUrl}\0${b.print.sha256}\0${b.pageUrl}`));
    const occurrenceByPrint = new Map(eligible.map((entry)=>[entry.print,entry]));
    const recurringGroups = groupSimilarCreatives(eligible.map((entry)=>entry.print), 5,
      { onIssue: (issue) => analysisIssues.push(`similarity:${issue.code}`) }).filter((group)=>
      new Set(group.map((print)=>occurrenceByPrint.get(print)?.pageUrl)).size >= 2);
    const creatives = recurringGroups.flat();
    const recurringShas = new Set(creatives.map((print)=>print.sha256));
    const imageAnalysis = await Promise.all(observations.map(async ({image,pages},index): Promise<ImageAnalysis> => {
      const recognition = recognitions.get(image.sha256)
        ?? {state:"unavailable",backend:ocr.name,reason:"budget"};
      const verdict = decideVisualImage(image.candidate,recognition,recurringShas.has(image.sha256));
      return { analysisId:`image-${String(index+1)}`,assetId:`visual-${image.sha256}`,
        sourceKind:image.candidate.sourceKind,sourceUrl:image.sourceUrl,frameUrl:image.candidate.frameUrl,pageUrls:[...pages].sort(),
        location:image.candidate.location,destinationUrl:image.candidate.destinationUrl,
        candidateEvidence:image.candidate.candidateEvidence,visibleDomEquivalent:verdict.visibleDomEquivalent,
        ocr:recognition,matchedTerms:verdict.gate.matchedTerms,normalizedText:verdict.gate.normalizedText,decision:verdict.decision };
    }));
    const imageOnlyCases = imageAnalysis.flatMap((analysis,index)=> analysis.decision.passed && analysis.ocr.state==="available"
      ? [{url:observations[index]!.image.candidate.frameUrl,location:analysis.location!,evidenceText:analysis.ocr.text}] : []);
    const adEvidence = new Map<string, NonNullable<GraphInput["adEvidence"]>>();
    const witness = (pageUrl:string,evidence:NonNullable<GraphInput["adEvidence"]>[number]):void => {
      const items=adEvidence.get(pageUrl) ?? []; items.push(evidence);adEvidence.set(pageUrl,items);
    };
    const candidatesByIdentity = new Map<string, DecidedCandidate>();
    for (const candidate of allCandidates) {
      const key = `${findingIdentityKey({ url: candidate.url, location: candidate.location, technique: candidate.technique.technique })}\0${candidate.technique.rawText}`;
      if (!candidatesByIdentity.has(key)) candidatesByIdentity.set(key,candidate);
    }
    for (const finding of result.findings) {
      const candidate=candidatesByIdentity.get(`${findingIdentityKey(finding)}\0${finding.evidence_text}`);
      if (candidate) witness(candidates.pageOf(candidate) ?? candidate.url,{findingId:finding.id,location:finding.location,
        destinationUrl:candidate.illegalAd.destinationUrl,reason:"official-finding"});
    }
    for (const [index,analysis] of imageAnalysis.entries()) {
      const image=observations[index]!.image;
      const positive=analysis.ocr.state==="available" && semanticGate(analysis.ocr.text).passed;
      if (!positive && !recurringShas.has(image.sha256)) continue;
      for (const pageUrl of analysis.pageUrls) witness(pageUrl,{location:image.candidate.location,
        resourceUrl:image.candidate.resourceUrl ?? (image.sourceUrl!==image.candidate.pageUrl ? image.sourceUrl : undefined),
        destinationUrl:image.candidate.destinationUrl,creativeId:image.sha256,
        reason:positive ? "ocr-positive-ad-creative" : "repeated-ad-creative"});
      if (image.candidate.resourceUrl && image.sourceUrl!==image.candidate.resourceUrl) {
        for (const pageUrl of analysis.pageUrls) witness(pageUrl,{location:image.candidate.location,
          resourceUrl:image.sourceUrl,creativeId:image.sha256,reason:"ad-candidate-resource-redirect"});
      }
    }
    let graph: ReturnType<typeof buildEvidenceGraph> | undefined;
    let infrastructure: ReturnType<typeof summarizeInfrastructure> = [];
    try {
      graph=buildEvidenceGraph(summary.pages.map((page)=>({pageUrl:page.url,links:page.links,
        frames:page.frames.map((frame)=>({url:frame.url})),
        externals:page.externals.map((external)=>({url:external.url,kind:external.kind})),adEvidence:adEvidence.get(page.url)})));
      infrastructure=summarizeInfrastructure(graph,[new URL(entryUrl).host]);
      if (graph.truncated) analysisIssues.push("graph-collection-truncated");
    } catch { analysisIssues.push("graph-analysis-unavailable"); }
    const zeroWidthCases = [...new Map(adTextSources.filter((source) => /[\u200B-\u200D\uFEFF]/.test(source.analysisText)).map((source) => [
      `${source.url}\0${source.location}\0${source.evidenceText}`,
      source,
    ])).values()].sort((a, b) => `${a.url}\0${a.location}\0${a.evidenceText}`.localeCompare(`${b.url}\0${b.location}\0${b.evidenceText}`));
    let extraResult: ReturnType<typeof buildExtraResult>;
    try {
      extraResult = buildExtraResult({
        topic: "TOPIC", entryUrl: input.entryUrl, startedAt, finishedAt,
        creatives: creatives.sort((a, b) => a.sourceUrl.localeCompare(b.sourceUrl) || a.sha256.localeCompare(b.sha256)),
        graph:graph ?? {nodes:[],edges:[]},zeroWidthCases,imageOnlyCases,
        onIssue: (issue) => { analysisIssues.push(`${issue.code}: ${issue.scope}`); },
      });
    } catch {
      analysisIssues.push("extra-analysis-unavailable");
      extraResult = {meta:result.meta,findings:[]};
    }
    for (const [index,analysis] of imageAnalysis.entries()) {
      analysis.extraFindingId=extraResult.findings.find((finding)=>finding.extra_finding==="IMAGE_ONLY_ILLEGAL_AD"
        && finding.url===observations[index]!.image.candidate.frameUrl && finding.location===analysis.location)?.id;
    }
    const extraJson = `${JSON.stringify(extraResult, null, 2)}\n`;
    visualAnalysisCoverage.imageAnalysisRecords = imageAnalysis.length;
    visualAnalysisCoverage.limitsReached.sort();
    visualAnalysisCoverage.skips.sort((a,b) => a.reason.localeCompare(b.reason) || a.unit.localeCompare(b.unit));
    const detailBundle: ScanDetailBundle = {
      version: 2,
      timing: { workerStartedAt: startedAt, officialFinalizedAt, analysisFinishedAt: new Date().toISOString(), analysisElapsedMs: performance.now() - t0 },
      visualAnalysisCoverage,
      imageAnalysis,evidenceGraph:graph,infrastructure,
      pageOutcomes: summary.pages.map((page) => ({ url: page.url, finalUrl: page.finalUrl,
        depth: page.depth, status: page.status,
        outcome: !page.issue && page.status > 0 && page.status < 400 ? "checked" : "failed",
        issue: page.issue, discoverySource: page.discoverySource,
        collectionIssues: page.collectionIssues,
        reason: page.failureReason ?? (page.status >= 400 ? `HTTP ${String(page.status)}` : undefined) })),
      creativeImages: extraResult.findings.flatMap((finding) => {
        if (finding.extra_finding !== "REUSED_AD_CREATIVE") return [];
        const print = creatives.find((item) => item.sourceUrl === finding.url
          && finding.evidence_text.includes(item.perceptualHash));
        const image = print && creativeImages.get(`${print.sourceUrl}\0${print.sha256}`);
        if (!image) return [];
        return [{ findingId: finding.id, assetId: `visual-${image.sha256}`, sourceUrl: image.sourceUrl,
          sha256: image.sha256, mimeType: image.mimeType, width: image.width, height: image.height, capturedAt: image.capturedAt }];
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
          textPolicy: candidate.textPolicy,
          destinationUrl: candidate.illegalAd.destinationUrl,
          observed: candidate.observed,
          visual: candidate.visual ?? { state: "unavailable", reason: "budget" },
        };
      }),
      coverage: {
        checkedPages: summary.pages.filter((page) => !page.issue && page.status > 0 && page.status < 400).length,
        failedPages: summary.pages.filter((page) => page.issue !== undefined || page.status === 0 || page.status >= 400)
          .map((page) => ({ url: page.url, status: page.status,
            reason: page.failureReason ?? (page.status === 0 ? "navigation-or-analysis-failed" : `HTTP ${String(page.status)}`) })),
        timedOut: summary.timedOut,
        cancelled,
      },
    };
    const assets=new Map(observations.map(({image})=>
      [image.sha256,{assetId:`visual-${image.sha256}`,mimeType:image.mimeType,dataUrl:image.dataUrl}] as const));
    const captureIds = new Set(detailBundle.findings.flatMap((finding) => finding.visual.state === "available"
      ? [finding.visual.assetId, finding.visual.element?.state === "available" ? finding.visual.element.assetId : undefined].filter((id): id is string => id !== undefined) : []));
    detailBundle.visualAssets=[...assets.values(),...captureStore.values().filter((asset) => captureIds.has(asset.assetId))];
    detailBundle.analysisIssues=[...new Set(analysisIssues)];
    const manifestBytes=():number=>Buffer.byteLength(JSON.stringify(detailBundle),"utf8");
    if (graph && manifestBytes()>8_000_000) {
      const edges=graph.edges.filter((edge)=>edge.adRelated);
      const ids=new Set(edges.flatMap((edge)=>[edge.from,edge.to]));
      detailBundle.evidenceGraph={nodes:graph.nodes.filter((node)=>node.adRelated || ids.has(node.id)),edges};
      analysisIssues.push("observed-graph-omitted-budget");
      if (manifestBytes()>8_000_000) { delete detailBundle.evidenceGraph; analysisIssues.push("graph-unavailable-budget"); }
    }
    const detailVerdict = validateScanDetailBundle(detailBundle, result, extraResult);
    if (!detailVerdict.ok) analysisIssues.push("detail-validation-failed");
    detailBundle.analysisIssues=[...new Set(analysisIssues)];
    await ocr.close();
    detailBundle.timing!.analysisFinishedAt = new Date().toISOString();
    detailBundle.timing!.analysisElapsedMs = performance.now() - t0;
    progress.stage = cancelled ? "cancelled" : "succeeded";
    emit(cancelled ? "session-cancelled" : "session-finished", `done: ${String(result.findings.length)} findings`);
    return {
      result,
      json,
      extraResult,
      extraJson,
      pagesVisited: summary.pages.length,
      failedPages: summary.pages.filter((page) => page.issue !== undefined || page.status === 0 || page.status >= 400).length,
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
  }
}
