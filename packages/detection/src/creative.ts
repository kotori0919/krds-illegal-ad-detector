import type { Frame, Page } from "playwright-core";
import { createSelectorEngine, type LiveFrame, type LiveImageResponse, type ScanDeadline } from "@krds-detector/scanner";
import { blockAverageHash, sha256Hex, type CreativeFingerprint, type VisualSource } from "@krds-detector/evidence";
import { SCAN_POLICY, normalizeFrameSrc, serializeFramePath, type CreativeImage, type VisualAnalysisCoverage, type VisualAnalysisReason, type VisualAnalysisLimit } from "@krds-detector/contracts";
import { semanticGate } from "./semantic.js";

export interface VisualCandidate {
  sourceKind: "img" | "background-image" | "svg" | "canvas";
  pageUrl: string;
  frameUrl: string;
  location: string;
  resourceUrl?: string;
  destinationUrl?: string;
  candidateEvidence: string[];
  visibleDomAdTexts: string[];
}

export type CapturedVisualImage = Omit<CreativeImage, "findingId" | "dataUrl"> & {
  dataUrl: string; candidate: VisualCandidate; animationFrame?: { index: number; timestampMs: number };
};

export interface LiveVisualRequest {
  page: Page; frames: LiveFrame[]; responses: LiveImageResponse[];
  deadline: ScanDeadline; maxBytes: number; signal?: AbortSignal;
}
export const livePageVisualSource: VisualSource<LiveVisualRequest, Awaited<ReturnType<typeof collectPageCreatives>>> = {
  id: "live-playwright-visuals", version: 1, availability: { state: "available" },
  limits: { bytesPerPage: SCAN_POLICY.visual.bytesPerPage, candidatesPerDocument: SCAN_POLICY.visual.candidatesPerDocument,
    elementsPerDocument: SCAN_POLICY.visual.elementsPerDocument, maxImagePixels: SCAN_POLICY.visual.maxImagePixels },
  failurePolicy: "return-unavailable-no-retry",
  async acquire({ page, frames, responses, deadline, maxBytes, signal }) {
    if (!Number.isSafeInteger(maxBytes)) return { state: "unavailable", issue: { code: "INVALID_INPUT", retryable: false } };
    if (signal?.aborted) return { state: "unavailable", issue: { code: "CANCELLED", retryable: false } };
    if (maxBytes <= 0 || deadline.operationTimeoutMs(2000) < 500) return { state: "unavailable", issue: { code: "BUDGET", retryable: false } };
    if (page.isClosed()) return { state: "unavailable", issue: { code: "CAPTURE_FAILED", retryable: false } };
    try {
      const value = await collectPageCreatives(page, frames, responses, deadline, Math.min(maxBytes, SCAN_POLICY.visual.bytesPerPage), signal);
      return { state: "available", value, degradation: value.coverage.skips.length ? [{ code: "PARTIAL_CAPTURE", retryable: false }] : [] };
    } catch { return { state: "unavailable", issue: { code: signal?.aborted ? "CANCELLED" : "CAPTURE_FAILED", retryable: false } }; }
  },
};

interface BrowserCandidate {
  sourceKind: VisualCandidate["sourceKind"];
  selector: string;
  resourceUrl?: string;
  destinationUrl?: string;
  candidateEvidence: string[];
}

/** Trusted browser source; page-controlled values only enter as data. */
function selectVisuals(selectors: ReturnType<typeof createSelectorEngine>, limits: { elementsPerDocument: number; candidatesPerDocument: number; maxImagePixels: number }): { candidates: BrowserCandidate[]; visibleTexts: string[]; candidateLimit: boolean; elementLimit: boolean } {
  const hint = /(?:^|[^a-z])(ad|ads|banner)(?:$|[^a-z])|광고|배너/i;
  const candidates: BrowserCandidate[] = [];
  const textOwners = new Map<Element, string[]>();
  function visible(el: Element): boolean {
    const box = el.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) return false;
    for (let current: Element | null = el; current; current = current.parentElement) {
      const css = getComputedStyle(current);
      if (css.display === "none" || (current === el && css.visibility !== "visible") || Number(css.opacity) === 0 || css.contentVisibility === "hidden") return false;
    }
    return true;
  }
  // Marker and link checks precede background/style work. Traversal and
  // retained candidates are bounded even on very large documents.
  const elements = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_ELEMENT);
  let inspectedElements = 0;
  for (let node = elements.nextNode(); node && inspectedElements < limits.elementsPerDocument && candidates.length < limits.candidatesPerDocument; node = elements.nextNode()) {
    inspectedElements += 1;
    const el = node as Element;
    if (el.parentElement?.closest("svg,canvas")) continue;
    const parent = el.parentElement;
    const marker = `${el.getAttribute("alt") ?? ""} ${el.id} ${el.getAttribute("class") ?? ""} ${el.getAttribute("aria-label") ?? ""} ${parent?.id ?? ""} ${parent?.getAttribute("class") ?? ""}`;
    const link = el.closest("a[href]") as HTMLAnchorElement | null;
    let destinationUrl = link?.href;
    if (!link) {
      for (let owner: Element | null = el, depth = 0; owner && depth < 8; owner = owner.parentElement, depth += 1) {
        if (!(owner instanceof HTMLButtonElement)) continue;
        const raw = owner.getAttribute("data-banner-href") ?? owner.getAttribute("data-href");
        if (raw) {
          try {
            const destination = new URL(raw, document.baseURI);
            if (/^https?:$/.test(destination.protocol) && !destination.username && !destination.password) destinationUrl = destination.href;
          } catch { /* Invalid observed destinations do not admit a candidate. */ }
        }
        break;
      }
    }
    let external = false;
    if (destinationUrl) {
      try { const destination = new URL(destinationUrl); external = /^https?:$/.test(destination.protocol) && destination.host !== location.host; } catch { /* Invalid link. */ }
    }
    const marked = hint.test(marker);
    if (!marked && !external) continue;
    let sourceKind: BrowserCandidate["sourceKind"];
    let resourceUrl: string | undefined;
    if (el instanceof HTMLImageElement) {
      resourceUrl = el.currentSrc || el.src;
      sourceKind = /\.svg(?:[?#]|$)/i.test(resourceUrl) || /^data:image\/svg\+xml/i.test(resourceUrl) ? "svg" : "img";
    } else if (el instanceof SVGSVGElement) sourceKind = "svg";
    else if (el instanceof HTMLCanvasElement) sourceKind = "canvas";
    else {
      const background = getComputedStyle(el).backgroundImage;
      const match = background.match(/^url\((?:"([^"]+)"|'([^']+)'|([^)]*))\)$/);
      const rawUrl = match?.[1] ?? match?.[2] ?? match?.[3];
      if (!rawUrl) continue;
      try { resourceUrl = new URL(rawUrl.trim(), document.baseURI).href; } catch { continue; }
      sourceKind = "background-image";
    }
    if (!visible(el)) continue;
    const box = el.getBoundingClientRect();
    if (box.width < 8 || box.height < 8 || box.width * box.height > limits.maxImagePixels) continue;
    const selector = selectors.buildSelectorFor(el, document);
    if (!selector || !selectors.roundTrips(document, el, selector)) continue;
    // Inline/blob images use page + selector provenance; asset bytes must not
    // leak into the metadata URL carried to the results workspace.
    if (resourceUrl && !/^https?:/i.test(resourceUrl)) resourceUrl = undefined;
    candidates.push({ sourceKind, selector, resourceUrl, destinationUrl,
      candidateEvidence: [...(marked ? ["ad-marker"] : []), ...(external ? ["external-destination"] : [])] });
  }
  const walker = document.createTreeWalker(document.body ?? document.documentElement, NodeFilter.SHOW_TEXT);
  let inspected = 0;
  let textCharacters = 0;
  while (walker.nextNode() && inspected < limits.elementsPerDocument && textOwners.size < 200 && textCharacters < 65_536) {
    inspected += 1;
    const node = walker.currentNode;
    const parent = node.parentElement;
    if (!parent || parent.closest("svg,canvas,script,style,noscript,template") || !node.textContent?.trim() || !visible(parent)) continue;
    const text = node.textContent.slice(0, Math.min(4096, 65_536 - textCharacters));
    textCharacters += text.length;
    const css = getComputedStyle(parent);
    if (Number.parseFloat(css.fontSize) <= 1 || css.color === "rgba(0, 0, 0, 0)" || css.color === "transparent" || css.color === css.backgroundColor) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const rect = range.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      let owner: Element = parent;
      for (let ancestor: Element | null = parent; ancestor; ancestor = ancestor.parentElement) {
        owner = ancestor;
        if (/^(a|button|label|p|li|dt|dd|h[1-6]|td|th|caption|legend|summary|pre|div|section|article|main|nav|aside|header|footer|figure|figcaption|address|blockquote|form|fieldset|details|dialog)$/i.test(ancestor.localName)) break;
        if (ancestor === document.body || ancestor === document.documentElement) { owner = parent; break; }
        const display = getComputedStyle(ancestor).display;
        if (display !== "contents" && !display.startsWith("inline")) break;
      }
      const fragments = textOwners.get(owner);
      if (fragments) fragments.push(text); else textOwners.set(owner, [text]);
    }
  }
  return { candidates, visibleTexts: [...textOwners.values()].map((fragments) => fragments.join("")),
    candidateLimit: candidates.length === limits.candidatesPerDocument, elementLimit: inspectedElements === limits.elementsPerDocument };
}

async function within<T>(promise: Promise<T>, ms: number, signal?: AbortSignal): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: (() => void) | undefined;
  try {
    if (signal?.aborted) throw new Error("creative capture cancelled");
    return await Promise.race([promise, new Promise<T>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error("creative capture timed out")), ms);
      abort = () => reject(new Error("creative capture cancelled"));
      signal?.addEventListener("abort", abort, { once: true });
    })]);
  } finally {
    if (timer) clearTimeout(timer);
    if (abort) signal?.removeEventListener("abort", abort);
  }
}

/** A child document's styles do not expose concealment on its frame owners. */
async function frameIsVisible(frame: Frame, deadline: ScanDeadline, signal?: AbortSignal): Promise<boolean> {
  for (let child: Frame | null = frame; child?.parentFrame(); child = child.parentFrame()) {
    if (signal?.aborted || deadline.operationTimeoutMs(500) < 100) return false;
    const owner = await within(child.frameElement(), Math.max(1, deadline.operationTimeoutMs(500)), signal);
    try {
      const rendered = await within(owner.evaluate((element) => {
        if (!(element instanceof Element)) return false;
        const box = element.getBoundingClientRect();
        if (box.width <= 0 || box.height <= 0 || box.right <= 0 || box.bottom <= 0) return false;
        for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
          const css = getComputedStyle(ancestor);
          if (css.display === "none" || (ancestor === element && css.visibility !== "visible") || Number(css.opacity) === 0 || css.contentVisibility === "hidden") return false;
        }
        return true;
      }), Math.max(1, deadline.operationTimeoutMs(500)), signal);
      if (!rendered) return false;
    } finally { await owner.dispose(); }
  }
  return true;
}

/** Collect bounded, gated visual evidence while the navigated page is live. */
export async function collectPageCreatives(
  page: Page,
  frames: LiveFrame[],
  responses: LiveImageResponse[],
  deadline: ScanDeadline,
  maxBytes: number,
  signal?: AbortSignal,
): Promise<{ prints: CreativeFingerprint[]; images: CapturedVisualImage[]; bytes: number;
  coverage: Pick<VisualAnalysisCoverage, "candidatesObserved" | "skips" | "limitsReached"> }> {
  const prints: CreativeFingerprint[] = [];
  const images: CapturedVisualImage[] = [];
  let bytes = 0;
  const coverage: Pick<VisualAnalysisCoverage, "candidatesObserved" | "skips" | "limitsReached"> = {
    candidatesObserved: 0, skips: [], limitsReached: [],
  };
  const skip = (reason: VisualAnalysisReason, unit: "document" | "candidate", count = 1): void => {
    if (count <= 0) return;
    const prior = coverage.skips.find((item) => item.reason === reason && item.unit === unit);
    if (prior) prior.count += count; else coverage.skips.push({ reason, unit, count });
    if (["candidate-limit", "element-limit", "byte-limit", "deadline"].includes(reason)
      && !coverage.limitsReached.includes(reason as VisualAnalysisLimit)) coverage.limitsReached.push(reason as VisualAnalysisLimit);
  };
  const unavailableReason = (): VisualAnalysisReason => signal?.aborted ? "cancelled" : !enoughTime() ? "deadline" : "capture-error";
  const enoughTime = (): boolean => !signal?.aborted && deadline.operationTimeoutMs(2000) >= 500;
  if (!enoughTime() || maxBytes <= 0) {
    skip(maxBytes <= 0 ? "byte-limit" : unavailableReason(), "document");
    return { prints, images, bytes, coverage };
  }
  const scopes: { frame: Frame; path: { src: string; selector: string }[] }[] = [{ frame: page.mainFrame(), path: [] },
    ...frames.map((entry) => ({ frame: entry.frame,
      path: entry.srcChain.map((src, index) => ({ src: normalizeFrameSrc(src, page.url()), selector: entry.selectorChain[index]! })) }))];
  const selectedScopes: { frame: Frame; path: { src: string; selector: string }[]; selected: ReturnType<typeof selectVisuals> }[] = [];
  const pageTexts = new Set<string>();
  // Collect visible text once across all inspected documents before admitting
  // assets: reaching the asset cap must not hide an equivalent iframe caption.
  for (const [index, { frame, path }] of scopes.entries()) {
    if (!enoughTime()) { skip(unavailableReason(), "document", scopes.length - index); break; }
    try {
      if (!await frameIsVisible(frame, deadline, signal)) { skip(!enoughTime() ? unavailableReason() : "target-unavailable", "document"); continue; }
      const selected = await within(frame.evaluate(`(${selectVisuals.toString()})(${createSelectorEngine.toString()}(), ${JSON.stringify(SCAN_POLICY.visual)})`) as Promise<ReturnType<typeof selectVisuals>>,
        Math.max(1, deadline.operationTimeoutMs(500)), signal);
      for (const text of selected.visibleTexts) if (semanticGate(text).passed) pageTexts.add(text);
      coverage.candidatesObserved += selected.candidates.length;
      if (selected.candidateLimit) skip("candidate-limit", "document");
      if (selected.elementLimit) skip("element-limit", "document");
      selectedScopes.push({ frame, path, selected });
    } catch {
      skip(!enoughTime() ? unavailableReason() : "document-unavailable", "document");
      // Detached or unavailable frames cannot corroborate visible DOM text.
    }
  }
  const visibleDomAdTexts = [...pageTexts];
  for (const { frame, path, selected } of selectedScopes) {
    if (prints.length >= SCAN_POLICY.visual.candidatesPerDocument || bytes >= maxBytes || !enoughTime()) {
      skip(prints.length >= SCAN_POLICY.visual.candidatesPerDocument ? "candidate-limit" : bytes >= maxBytes ? "byte-limit" : unavailableReason(), "candidate", selected.candidates.length); continue;
    }
    try {
      for (const [index, selectedCandidate] of selected.candidates.entries()) {
        if (prints.length >= SCAN_POLICY.visual.candidatesPerDocument || bytes >= maxBytes || !enoughTime()) {
          skip(prints.length >= SCAN_POLICY.visual.candidatesPerDocument ? "candidate-limit" : bytes >= maxBytes ? "byte-limit" : unavailableReason(), "candidate", selected.candidates.length - index); break;
        }
        const candidate: VisualCandidate = { sourceKind: selectedCandidate.sourceKind, pageUrl: page.url(), frameUrl: frame.url(),
          location: serializeFramePath({ framePath: path, selector: selectedCandidate.selector }),
          resourceUrl: selectedCandidate.resourceUrl, destinationUrl: selectedCandidate.destinationUrl,
          candidateEvidence: selectedCandidate.candidateEvidence, visibleDomAdTexts };
        try {
          let body: Buffer | undefined;
          let mediaType = "image/png";
          let sourceUrl = candidate.resourceUrl ?? candidate.pageUrl;
          const observed = candidate.resourceUrl && responses.find((response) => {
            if (response.url === candidate.resourceUrl) return true;
            let request = response.response.request().redirectedFrom();
            for (let hop = 0; request && hop < 20; hop += 1) {
              if (request.url() === candidate.resourceUrl) return true;
              request = request.redirectedFrom();
            }
            return false;
          });
          if (observed) {
            mediaType = observed.mediaType; sourceUrl = observed.url;
            const declaredBytes = Number(observed.response.headers()["content-length"] ?? 0);
            if (declaredBytes > SCAN_POLICY.visual.assetBytes || declaredBytes > maxBytes - bytes) { skip("byte-limit", "candidate"); continue; }
            if (mediaType === "image/svg+xml" && candidate.sourceKind === "img") candidate.sourceKind = "svg";
            if (declaredBytes > 0 && mediaType !== "image/svg+xml") {
              body = await within(observed.response.body(), Math.max(1, deadline.operationTimeoutMs(1000)), signal);
              if (!body.length || body.length > SCAN_POLICY.visual.assetBytes || bytes + body.length > maxBytes) { skip(body.length ? "byte-limit" : "image-unavailable", "candidate"); continue; }
            }
          }
          // Rasterize only candidates already admitted by marker/link/geometry
          // checks when reusable bounded original bytes are unavailable.
          if (!body) {
            if (!enoughTime()) { skip(unavailableReason(), "candidate"); continue; }
            const locator = frame.locator(selectedCandidate.selector);
            if (await locator.count() !== 1) { skip("target-unavailable", "candidate"); continue; }
            await locator.scrollIntoViewIfNeeded({ timeout: Math.max(1, deadline.operationTimeoutMs(500)) });
            const loaded = await within(locator.evaluate(async (element) => {
              if (!(element instanceof HTMLImageElement)) return true;
              if (!element.complete || !element.naturalWidth) await element.decode();
              return element.naturalWidth > 0;
            }), Math.max(1, deadline.operationTimeoutMs(1000)), signal);
            if (!loaded) { skip("image-unavailable", "candidate"); continue; }
            const box = await locator.boundingBox({ timeout: Math.max(1, deadline.operationTimeoutMs(500)) });
            if (!box || box.width < 8 || box.height < 8 || box.width * box.height > SCAN_POLICY.visual.maxImagePixels) { skip("target-unavailable", "candidate"); continue; }
            body = await locator.screenshot({ type: "png", timeout: Math.max(1, deadline.operationTimeoutMs(1000)), animations: "disabled" });
            mediaType = "image/png";
            const after = await locator.boundingBox({ timeout: Math.max(1, deadline.operationTimeoutMs(500)) });
            if (!after || after.x !== box.x || after.y !== box.y || after.width !== box.width || after.height !== box.height) { skip("target-unavailable", "candidate"); continue; }
          }
          if (!enoughTime() || !body.length || body.length > SCAN_POLICY.visual.assetBytes || bytes + body.length > maxBytes) {
            skip(!enoughTime() ? unavailableReason() : body.length ? "byte-limit" : "image-unavailable", "candidate"); continue;
          }
          const decodeTimeout = Math.max(1, deadline.operationTimeoutMs(mediaType === "image/gif" ? 3000 : 1000));
          const decoded = await within(page.evaluate(async ({ imageBytes, type, maxImagePixels, framesPerCandidate, animationFrames, assetBytes, budgetMs }) => {
            interface Decoded {
              width: number; height: number; rgba: number[]; normalizedDataUrl?: string;
              animationFrame?: { index: number; timestampMs: number }; singleFrame?: boolean; partialAnimation?: boolean;
            }
            const thumbnail = document.createElement("canvas"); thumbnail.width = 8; thumbnail.height = 8;
            const context = thumbnail.getContext("2d", { willReadFrequently: true });
            if (!context) return [];
            const sample = (image: CanvasImageSource, width: number, height: number): Decoded | undefined => {
              if (width < 8 || height < 8 || width * height > maxImagePixels) return undefined;
              context.clearRect(0, 0, 8, 8); context.drawImage(image, 0, 0, 8, 8);
              return { width, height, rgba: Array.from(context.getImageData(0, 0, 8, 8).data) };
            };
            const encode = (image: CanvasImageSource, frame: Decoded): boolean => {
              const canvas = document.createElement("canvas"); canvas.width = frame.width; canvas.height = frame.height;
              const full = canvas.getContext("2d");
              if (!full) return false;
              full.drawImage(image, 0, 0);
              const dataUrl = canvas.toDataURL("image/png");
              const encoded = dataUrl.slice(dataUrl.indexOf(",") + 1);
              const bytes = encoded.length * 3 / 4 - (encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0);
              if (bytes > assetBytes) return false;
              frame.normalizedDataUrl = dataUrl; return true;
            };
            const Decoder = (globalThis as typeof globalThis & { ImageDecoder?: new (options: { data: Uint8Array; type: string; preferAnimation: boolean }) => {
              tracks: { ready: Promise<void>; selectedTrack?: { frameCount: number } };
              decode: (options: { frameIndex: number; completeFramesOnly: boolean }) => Promise<{ image: VideoFrame }>;
              close: () => void;
            } }).ImageDecoder;
            if (type === "image/gif" && Decoder) {
              const decoder = new Decoder({ data: new Uint8Array(imageBytes), type, preferAnimation: true });
              const detail = document.createElement("canvas"); detail.width = 128; detail.height = 32;
              const detailContext = detail.getContext("2d", { willReadFrequently: true });
              if (!detailContext) { decoder.close(); return []; }
              let selected: { frame: Decoded; score: number; luma: number[] }[] = [];
              const distance = (a: number[], b: number[]): number => {
                let sum = 0;
                for (let pixel = 0; pixel < a.length; pixel += 1) sum += Math.abs(a[pixel]! - b[pixel]!);
                return sum;
              };
              const seen = new Set<string>();
              const expires = performance.now() + budgetMs;
              try {
                await decoder.tracks.ready;
                const total = decoder.tracks.selectedTrack?.frameCount ?? 1;
                const count = Math.min(animationFrames, total);
                let inspected = 0;
                for (let index = 0; index < count && performance.now() < expires; index += 1) {
                  const { image } = await decoder.decode({ frameIndex: index, completeFramesOnly: true });
                  inspected += 1;
                  try {
                    const frame = sample(image, image.displayWidth, image.displayHeight);
                    if (!frame) continue;
                    detailContext.clearRect(0, 0, 128, 32);
                    detailContext.drawImage(image, 0, 0, 128, 32);
                    const rgba = detailContext.getImageData(0, 0, 128, 32).data;
                    // A tiny global thumbnail can erase readable brief text.
                    // Keep this finer signature separate from the creative hash.
                    const signature = Array.from(rgba, value => String.fromCharCode(value >> 4)).join("");
                    if (seen.has(signature)) continue;
                    seen.add(signature);
                    const luma = Array.from({ length: 4096 }, (_, pixel) => {
                      const offset = pixel * 4, alpha = rgba[offset + 3]! / 255;
                      return (rgba[offset]! * 0.299 + rgba[offset + 1]! * 0.587 + rgba[offset + 2]! * 0.114) * alpha + 255 * (1 - alpha);
                    });
                    let score = 0;
                    for (let pixel = 0; pixel < 4096; pixel += 1) {
                      if (pixel % 128) score += Math.abs(luma[pixel]! - luma[pixel - 1]!);
                      if (pixel >= 128) score += Math.abs(luma[pixel]! - luma[pixel - 128]!);
                    }
                    if (!score && selected.some(item => item.score > 0)) continue;
                    frame.animationFrame = { index, timestampMs: image.timestamp / 1000 };
                    if (!score && selected.length) continue;
                    const proposal = [...selected.filter(item => !score || item.score > 0), { frame, score, luma }];
                    if (proposal.length > framesPerCandidate) {
                      // Edge-rich decorations can displace brief text even in
                      // a temporal bucket. Retain different spatial content;
                      // edge sum only resolves equally diverse selections.
                      const distances = proposal.map(a => proposal.map(b => distance(a.luma, b.luma)));
                      let remove = proposal.length - 1, bestMinimum = -1, bestTotal = -1, bestDetail = -1;
                      for (let omitted = proposal.length - 1; omitted >= 0; omitted -= 1) {
                        let minimum = Infinity, totalDistance = 0, detailScore = 0;
                        for (let a = 0; a < proposal.length; a += 1) {
                          if (a === omitted) continue;
                          detailScore += proposal[a]!.score;
                          for (let b = 0; b < a; b += 1) {
                            if (b === omitted) continue;
                            const pair = distances[a]![b]!;
                            minimum = Math.min(minimum, pair); totalDistance += pair;
                          }
                        }
                        if (minimum > bestMinimum || (minimum === bestMinimum && (totalDistance > bestTotal
                          || (totalDistance === bestTotal && detailScore > bestDetail)))) {
                          remove = omitted; bestMinimum = minimum; bestTotal = totalDistance; bestDetail = detailScore;
                        }
                      }
                      proposal.splice(remove, 1);
                    }
                    if (proposal.some(item => item.frame === frame) && encode(image, frame)) selected = proposal;
                  } finally { image.close(); }
                }
                // Uniform flashes cannot displace readable frames. A wholly
                // uniform asset retains one honest observation, not an offer.
                const useful = selected.filter((item) => item.score > 0);
                return (useful.length ? useful : selected.slice(0, 1)).map((item) => ({ ...item.frame, partialAnimation: inspected < total || seen.size > selected.length }));
              } finally { decoder.close(); }
            }
            const bitmap = await createImageBitmap(new Blob([new Uint8Array(imageBytes)], { type }));
            try {
              const frame = sample(bitmap, bitmap.width, bitmap.height);
              if (!frame) return [];
              if (type === "image/gif") {
                if (!encode(bitmap, frame)) return [];
                frame.singleFrame = true;
              }
              return [frame];
            } finally { bitmap.close(); }
          }, { imageBytes: Array.from(body), type: mediaType, maxImagePixels: SCAN_POLICY.visual.maxImagePixels,
            framesPerCandidate: SCAN_POLICY.visual.framesPerCandidate, animationFrames: SCAN_POLICY.visual.animationFrames,
            assetBytes: SCAN_POLICY.visual.assetBytes, budgetMs: Math.max(1, decodeTimeout - 100) }), decodeTimeout, signal);
          if (!decoded.length || signal?.aborted) { skip(signal?.aborted ? "cancelled" : "image-unavailable", "candidate"); continue; }
          for (const [frameIndex, image] of decoded.entries()) {
            if (prints.length >= SCAN_POLICY.visual.candidatesPerDocument) { skip("candidate-limit", "candidate", decoded.length - frameIndex); break; }
            const imageBody = image.normalizedDataUrl ? Buffer.from(image.normalizedDataUrl.split(",")[1]!, "base64") : body;
            const imageType = image.normalizedDataUrl ? "image/png" : mediaType;
            if (imageBody.length > SCAN_POLICY.visual.assetBytes || bytes + imageBody.length > maxBytes) { skip("byte-limit", "candidate"); continue; }
            bytes += imageBody.length;
            if (bytes === maxBytes && !coverage.limitsReached.includes("byte-limit")) coverage.limitsReached.push("byte-limit");
            const sha256 = sha256Hex(imageBody);
            prints.push({ sha256, perceptualHash: blockAverageHash(new Uint8Array(image.rgba), 8, 8),
              width: image.width, height: image.height, mediaType: imageType, sourceUrl, sourceHost: new URL(sourceUrl).host });
            if (imageType === "image/png" || imageType === "image/jpeg" || imageType === "image/webp") images.push({
              sourceUrl, sha256, mimeType: imageType, dataUrl: `data:${imageType};base64,${imageBody.toString("base64")}`,
              width: image.width, height: image.height, capturedAt: new Date().toISOString(),
              animationFrame: image.animationFrame, candidate: image.singleFrame || image.partialAnimation
                ? { ...candidate, candidateEvidence: [...candidate.candidateEvidence, image.singleFrame ? "animation-single-frame" : "animation-partial"] } : candidate });
          }
        } catch {
          skip(unavailableReason(), "candidate");
          // Failed optional visual evidence never changes official findings.
        }
      }
    } catch {
      skip(unavailableReason(), "document");
      // Detached frames and exhausted capture budgets retain earlier evidence.
    }
  }
  return { prints, images, bytes, coverage };
}
