import type { Frame, Page } from "playwright-core";
import { createSelectorEngine, type LiveFrame, type LiveImageResponse, type ScanDeadline } from "@krds-detector/scanner";
import { blockAverageHash, sha256Hex, type CreativeFingerprint } from "@krds-detector/evidence";
import { normalizeFrameSrc, serializeFramePath, type CreativeImage } from "@krds-detector/contracts";
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

export type CapturedVisualImage = Omit<CreativeImage, "findingId"> & { candidate: VisualCandidate };

interface BrowserCandidate {
  sourceKind: VisualCandidate["sourceKind"];
  selector: string;
  resourceUrl?: string;
  destinationUrl?: string;
  candidateEvidence: string[];
}

/** Trusted browser source; page-controlled values only enter as data. */
function selectVisuals(selectors: ReturnType<typeof createSelectorEngine>): { candidates: BrowserCandidate[]; visibleTexts: string[] } {
  const hint = /(?:^|[^a-z])(ad|ads|banner)(?:$|[^a-z])|광고|배너/i;
  const candidates: BrowserCandidate[] = [];
  const textOwners = new Map<Element, string[]>();
  function visible(el: Element): boolean {
    const box = el.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) return false;
    for (let current: Element | null = el; current; current = current.parentElement) {
      const css = getComputedStyle(current);
      if (css.display === "none" || css.visibility !== "visible" || Number(css.opacity) === 0 || css.contentVisibility === "hidden") return false;
    }
    return true;
  }
  // Marker and link checks precede background/style work. Traversal and
  // retained candidates are bounded even on very large documents.
  const elements = document.querySelectorAll("*");
  for (let index = 0; index < Math.min(elements.length, 10_000) && candidates.length < 8; index += 1) {
    const el = elements[index]!;
    if (el.parentElement?.closest("svg,canvas")) continue;
    const parent = el.parentElement;
    const marker = `${el.getAttribute("alt") ?? ""} ${el.id} ${el.getAttribute("class") ?? ""} ${el.getAttribute("aria-label") ?? ""} ${parent?.id ?? ""} ${parent?.getAttribute("class") ?? ""}`;
    const link = el.closest("a[href]") as HTMLAnchorElement | null;
    const external = link !== null && /^https?:$/.test(link.protocol) && link.host !== location.host;
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
    if (box.width < 8 || box.height < 8 || box.width * box.height > 4_000_000) continue;
    const selector = selectors.buildSelectorFor(el, document);
    if (!selector || !selectors.roundTrips(document, el, selector)) continue;
    // Inline/blob images use page + selector provenance; asset bytes must not
    // leak into the metadata URL carried to the results workspace.
    if (resourceUrl && !/^https?:/i.test(resourceUrl)) resourceUrl = undefined;
    candidates.push({ sourceKind, selector, resourceUrl, destinationUrl: link?.href,
      candidateEvidence: [...(marked ? ["ad-marker"] : []), ...(external ? ["external-destination"] : [])] });
  }
  const walker = document.createTreeWalker(document.body ?? document.documentElement, NodeFilter.SHOW_TEXT);
  let inspected = 0;
  while (walker.nextNode() && inspected < 10_000 && textOwners.size < 200) {
    inspected += 1;
    const node = walker.currentNode;
    const parent = node.parentElement;
    if (!parent || parent.closest("svg,canvas,script,style,noscript,template") || !node.textContent?.trim() || !visible(parent)) continue;
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
      if (fragments) fragments.push(node.textContent); else textOwners.set(owner, [node.textContent]);
    }
  }
  return { candidates, visibleTexts: [...textOwners.values()].map((fragments) => fragments.join("")) };
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
          if (css.display === "none" || css.visibility !== "visible" || Number(css.opacity) === 0 || css.contentVisibility === "hidden") return false;
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
): Promise<{ prints: CreativeFingerprint[]; images: CapturedVisualImage[]; bytes: number }> {
  const prints: CreativeFingerprint[] = [];
  const images: CapturedVisualImage[] = [];
  let bytes = 0;
  const enoughTime = (): boolean => !signal?.aborted && deadline.operationTimeoutMs(2000) >= 500;
  if (!enoughTime() || maxBytes <= 0) return { prints, images, bytes };
  const scopes: { frame: Frame; path: { src: string; selector: string }[] }[] = [{ frame: page.mainFrame(), path: [] },
    ...frames.map((entry) => ({ frame: entry.frame,
      path: entry.srcChain.map((src, index) => ({ src: normalizeFrameSrc(src, page.url()), selector: entry.selectorChain[index]! })) }))];
  const selectedScopes: { frame: Frame; path: { src: string; selector: string }[]; selected: ReturnType<typeof selectVisuals> }[] = [];
  const pageTexts = new Set<string>();
  // Collect visible text once across all inspected documents before admitting
  // assets: reaching the asset cap must not hide an equivalent iframe caption.
  for (const { frame, path } of scopes) {
    if (!enoughTime()) break;
    try {
      if (!await frameIsVisible(frame, deadline, signal)) continue;
      const selected = await within(frame.evaluate(`(${selectVisuals.toString()})(${createSelectorEngine.toString()}())`) as Promise<ReturnType<typeof selectVisuals>>,
        Math.max(1, deadline.operationTimeoutMs(500)), signal);
      for (const text of selected.visibleTexts) if (semanticGate(text).passed) pageTexts.add(text);
      selectedScopes.push({ frame, path, selected });
    } catch {
      // Detached or unavailable frames cannot corroborate visible DOM text.
    }
  }
  const visibleDomAdTexts = [...pageTexts];
  for (const { frame, path, selected } of selectedScopes) {
    if (prints.length >= 8 || bytes >= maxBytes || !enoughTime()) break;
    try {
      for (const selectedCandidate of selected.candidates) {
        if (prints.length >= 8 || bytes >= maxBytes || !enoughTime()) break;
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
            if (declaredBytes > 250_000 || declaredBytes > maxBytes - bytes) continue;
            if (mediaType === "image/svg+xml" && candidate.sourceKind === "img") candidate.sourceKind = "svg";
            if (declaredBytes > 0 && mediaType !== "image/svg+xml") {
              body = await within(observed.response.body(), Math.max(1, deadline.operationTimeoutMs(1000)), signal);
              if (!body.length || body.length > 250_000 || bytes + body.length > maxBytes) continue;
            }
          }
          // Rasterize only candidates already admitted by marker/link/geometry
          // checks when reusable bounded original bytes are unavailable.
          if (!body) {
            if (!enoughTime()) continue;
            const locator = frame.locator(selectedCandidate.selector);
            if (await locator.count() !== 1) continue;
            await locator.scrollIntoViewIfNeeded({ timeout: Math.max(1, deadline.operationTimeoutMs(500)) });
            const box = await locator.boundingBox({ timeout: Math.max(1, deadline.operationTimeoutMs(500)) });
            if (!box || box.width < 8 || box.height < 8 || box.width * box.height > 4_000_000) continue;
            body = await locator.screenshot({ type: "png", timeout: Math.max(1, deadline.operationTimeoutMs(1000)), animations: "disabled" });
            mediaType = "image/png";
            const after = await locator.boundingBox({ timeout: Math.max(1, deadline.operationTimeoutMs(500)) });
            if (!after || after.x !== box.x || after.y !== box.y || after.width !== box.width || after.height !== box.height) continue;
          }
          if (!enoughTime() || !body.length || body.length > 250_000 || bytes + body.length > maxBytes) continue;
          const decoded = await within(page.evaluate(async ({ imageBytes, type }) => {
            const bitmap = await createImageBitmap(new Blob([new Uint8Array(imageBytes)], { type }));
            try {
              if (bitmap.width < 8 || bitmap.height < 8 || bitmap.width * bitmap.height > 4_000_000) return undefined;
              const canvas = document.createElement("canvas"); canvas.width = 8; canvas.height = 8;
              const context = canvas.getContext("2d", { willReadFrequently: true });
              if (!context) return undefined;
              context.drawImage(bitmap, 0, 0, 8, 8);
              return { width: bitmap.width, height: bitmap.height, rgba: Array.from(context.getImageData(0, 0, 8, 8).data) };
            } finally { bitmap.close(); }
          }, { imageBytes: Array.from(body), type: mediaType }), Math.max(1, deadline.operationTimeoutMs(1000)), signal);
          if (!decoded || signal?.aborted) continue;
          bytes += body.length;
          const sha256 = sha256Hex(body);
          prints.push({ sha256, perceptualHash: blockAverageHash(new Uint8Array(decoded.rgba), 8, 8),
            width: decoded.width, height: decoded.height, mediaType, sourceUrl, sourceHost: new URL(sourceUrl).host });
          if (mediaType === "image/png" || mediaType === "image/jpeg" || mediaType === "image/webp") images.push({
            sourceUrl, sha256, mimeType: mediaType, dataUrl: `data:${mediaType};base64,${body.toString("base64")}`,
            width: decoded.width, height: decoded.height, capturedAt: new Date().toISOString(), candidate });
        } catch {
          // Failed optional visual evidence never changes official findings.
        }
      }
    } catch {
      // Detached frames and exhausted capture budgets retain earlier evidence.
    }
  }
  return { prints, images, bytes };
}
