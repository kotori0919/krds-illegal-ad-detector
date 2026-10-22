/**
 * Production crawler (GOAL Phase 3) on the Playwright API.
 *
 * KODEX policy honored:
 * - Playwright API drives navigation; no CLI-output scraping.
 * - External ad infrastructure observed, never recursively crawled.
 * - Hostile pages contained: popup/download suppression, request caps,
 *   per-page budget, hard global timeout, same-site bound, depth bound.
 * - Fixed parsed-document settle windows observe delayed injection.
 * - Access failures never reach detection; sitemap discovery is bounded.
 */
import { chromium, type Browser, type BrowserContext, type Frame, type Page, type Request, type Response, type Route } from "playwright-core";
import { performance } from "node:perf_hooks";
import { DEFAULT_SCAN_LIMITS, SCAN_POLICY, type ScanIssue, type ScanLimits } from "@krds-detector/contracts";
import { CrawlQueue, type DiscoveredPage, type ObservedExternal, type QueuedPage } from "./queue.js";
import { ScanDeadline } from "./deadline.js";
import { isSameSite, normalizeUrl } from "./urls.js";
import { classifyAccess, classifyPageError } from "./access.js";
import { CRAWLER_USER_AGENT, discoverSitemaps } from "./sitemap.js";
import { PublicNetworkPolicy, startPublicNetworkProxy, type PublicNetworkBoundary, type PublicNetworkProxy } from "./public-network.js";
import type { PinnedTransport } from "./pinned-transport.js";
import { createSelectorEngine } from "./selectors.js";
import { collectBoundedHtml, observeFrameOwner } from "./observation.js";

export interface FrameSnapshot {
  /** Absolute iframe src chain, outer → inner. */
  srcChain: string[];
  /** Selector chain locating each iframe in its parent, outer → inner. */
  selectorChain: string[];
  url: string;
  html: string;
}

export interface LocatedSnapshot {
  /** Owner-selector chain followed by the element selector. */
  location: string;
  selector: string;
  framePath: { src: string; selector: string }[];
  url: string;
}

export interface PageSnapshot {
  url: string;
  finalUrl: string;
  depth: number;
  status: number;
  html: string;
  links: string[];
  frames: FrameSnapshot[];
  externals: ObservedExternal[];
  duplicateContent: boolean;
  elapsedMs: number;
  failureReason?: string;
  issue?: ScanIssue;
  discoverySource?: "entry" | "link" | "sitemap";
  /** Bounded collection omissions, separate from page access failures. */
  collectionIssues?: string[];
}

export interface LiveFrame {
  frame: Frame;
  srcChain: string[];
  selectorChain: string[];
  visibilityContext?: ReturnType<typeof observeFrameOwner>;
}

export interface LiveImageResponse {
  response: Response;
  url: string;
  mediaType: string;
}

export interface CrawlEvents {
  onPageStarted?: (url: string, queuedPages: number) => void;
  onPageVisited?: (snapshot: PageSnapshot, queuedPages: number) => void;
  onPageQueued?: (queued: { url: string; depth: number; pending: number }) => void;
  onExternal?: (external: ObservedExternal) => void;
}

export interface CrawlOptions {
  /** Trusted source integration only; never accepted from UI/imported data. */
  publicTransport?: PinnedTransport;
  entryUrl: string;
  limits?: Partial<ScanLimits>;
  events?: CrawlEvents;
  /** Extra settle wait after load for delayed injection (ms). Default 1500. */
  settleMs?: number;
  /** Per-page wall budget (ms). Default 30000. */
  perPageMs?: number;
  /** Max response body inspected per page (bytes). Default 4 MiB. */
  maxBodyBytes?: number;
  /** Headless shell path override (uses installed browsers by default). */
  executablePath?: string;
  /** Installed-browser channel (e.g. msedge on Windows evaluators). */
  channel?: string;
  /** Shared whole-scan monotonic clock; standalone crawling creates its own. */
  deadline?: ScanDeadline;
  /** Fixed page worker count for benchmarks (1–4); defaults to CPU policy. */
  concurrency?: number;
  signal?: AbortSignal;
  /** Required for imported targets. Every runtime connection is public-only. */
  publicNetworkOnly?: boolean;
  entryKind?: "site" | "sitemap";
  /** Trusted prepared authorization or owned-fixture policy; never UI/worker input. */
  networkPolicy?: PublicNetworkBoundary;
  /** Called while the first and only navigated Page remains live. */
  onLivePage?: (page: Page, snapshot: PageSnapshot, frames: LiveFrame[], images: LiveImageResponse[], pageRank: number) => Promise<void>;
}

export interface CrawlSummary {
  entryUrl: string;
  pages: PageSnapshot[];
  externals: ObservedExternal[];
  elapsedMs: number;
  timedOut: boolean;
  cancelled: boolean;
}

async function boundedMap<T, R>(items: readonly T[], concurrency: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const worker = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await task(items[index] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

const POPUP_BLOCK_JS = `(() => {
  window.open = () => null;
  window.alert = () => {};
  window.confirm = () => false;
  window.prompt = () => null;
  window.print = () => {};
})();`;

// Playwright ElementHandle.evaluate needs a callable function (a string is an
// expression and receives no element argument). Compose only trusted source.
const selectFrameOwner = new Function("el", `return (${createSelectorEngine.toString()}()).buildSelectorFor(el);`) as (el: Element) => string | undefined;

function isNavigable(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

function compareExternal(a: ObservedExternal, b: ObservedExternal): number {
  return a.url.localeCompare(b.url) || a.from.localeCompare(b.from) || a.kind.localeCompare(b.kind);
}

/** Extract iframe descriptors + anchors from a live page. */
async function describePage(page: Page): Promise<{ links: string[]; truncated: boolean }> {
  return page.evaluate((limits) => {
    const links: string[] = [];
    const seen = new Set<string>();
    const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_ELEMENT);
    let visited = 0;
    let truncated = false;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (++visited > limits.linkElements || links.length >= limits.linksPerPage) { truncated = true; break; }
      if (!(node instanceof HTMLAnchorElement)) continue;
      const href = node.getAttribute("href");
      if (href && href.length <= limits.linkUrlCodeUnits && !seen.has(href)) { links.push(href); seen.add(href); }
      else if (href && href.length > limits.linkUrlCodeUnits) truncated = true;
    }
    return { links, truncated };
  }, SCAN_POLICY.collection);
}

export async function crawlSite(options: CrawlOptions): Promise<CrawlSummary> {
  const t0 = performance.now();
  const limits: ScanLimits = { ...DEFAULT_SCAN_LIMITS, ...options.limits };
  const deadline = options.deadline ?? new ScanDeadline(limits.timeoutSec);
  const concurrency = options.concurrency ?? SCAN_POLICY.scan.concurrency.default;
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) {
    throw new RangeError("page concurrency must be between 1 and 4");
  }
  const entry = normalizeUrl(options.entryUrl);
  const queue = new CrawlQueue(options.entryUrl, entry.host, {
    // The sitemap seed is consumed as discovery metadata, not a page attempt.
    maxPages: limits.maxPages + (options.entryKind === "sitemap" ? 1 : 0),
    maxDepth: limits.maxDepth,
  });
  const settleMs = options.settleMs ?? SCAN_POLICY.collection.settleMs;
  const perPageMs = options.perPageMs ?? SCAN_POLICY.collection.perPageMs;
  const maxBodyBytes = options.maxBodyBytes ?? SCAN_POLICY.collection.maxBodyBytes;
  if (!Number.isInteger(maxBodyBytes) || maxBodyBytes < 1 || maxBodyBytes > SCAN_POLICY.collection.maxBodyBytes) throw new RangeError("snapshot byte limit must be between 1 and 4194304");

  const pages: PageSnapshot[] = [];
  const externals = new Map<string, ObservedExternal>();
  const pushExternal = (e: ObservedExternal): void => {
    const key = `${e.url}\0${e.kind}`;
    if (externals.has(key) || externals.size >= SCAN_POLICY.collection.externalItems || e.url.length > SCAN_POLICY.collection.urlCodeUnits) return;
    externals.set(key, e);
    queue.observeExternal(e.url, e.from, e.kind);
    options.events?.onExternal?.(e);
  };

  let browser: Browser | undefined;
  let context: BrowserContext | undefined;
  let networkProxy: PublicNetworkProxy | undefined;
  let timedOut = false;
  let teardownRequested = false;
  let queuedPages = 0;
  const activePages = new Set<Page>();
  const policyDeniedTargets = new Set<string>();
  const wasPolicyDenied = (url: string): boolean => {
    try { return policyDeniedTargets.has(url) || policyDeniedTargets.has(new URL(url).origin + "/"); }
    catch { return false; }
  };
  const abortPages = (): void => {
    teardownRequested = true;
    for (const page of activePages) void page.close().catch(() => undefined);
    // Page/context disposal can wait for transport settlement. Cancellation
    // must start independent resource shutdown without waiting for either.
    void browser?.close().catch(() => undefined);
    void networkProxy?.close().catch(() => undefined);
  };
  options.signal?.addEventListener("abort", abortPages, { once: true });
  const launchBudgetMs = deadline.operationTimeoutMs(30_000);
  if (options.signal?.aborted || !deadline.canStartPage() || launchBudgetMs < 1) {
    options.signal?.removeEventListener("abort", abortPages);
    return { entryUrl: options.entryUrl, pages, externals: [...externals.values()], elapsedMs: performance.now() - t0,
      timedOut: !options.signal?.aborted, cancelled: options.signal?.aborted ?? false };
  }
  // Standalone callers need the same resource shutdown as an aborted session.
  // A page-close transport wait must not prevent reaching outer finalization.
  const deadlineTimer = setTimeout(() => {
    if (!options.signal?.aborted) timedOut = true;
    abortPages();
  }, Math.max(1, deadline.operationTimeoutMs(deadline.remainingMs())));
  try {
    const networkPolicy = options.networkPolicy ?? (options.publicNetworkOnly ? new PublicNetworkPolicy(undefined, options.publicTransport)
      : await PublicNetworkPolicy.forManualEntry(options.entryUrl, options.signal, deadline.operationTimeoutMs(2000), options.publicTransport));
    if (networkPolicy) {
      await networkPolicy.resolveTarget(options.entryUrl, options.signal, deadline.operationTimeoutMs(2000));
      networkProxy = await startPublicNetworkProxy(networkPolicy, deadline, options.signal, (url) => {
        try { if (policyDeniedTargets.size < SCAN_POLICY.collection.externalItems && url.length <= SCAN_POLICY.collection.urlCodeUnits) policyDeniedTargets.add(new URL(url).href); }
        catch { /* A malformed denied transport target has no document identity. */ }
      });
    }
    try { browser = await chromium.launch({
      chromiumSandbox: true,
      executablePath: options.executablePath,
      channel: options.channel,
      args: [...(networkPolicy ? ["--proxy-bypass-list=<-loopback>", "--disable-quic", "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
        "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"] : [])],
      proxy: networkProxy?.proxy,
      timeout: launchBudgetMs,
    }); } catch (error) {
      // Never silently retry with disabled isolation. Preserve cause for the
      // diagnostic boundary, while presenting an actionable operator error.
      throw new Error("브라우저 격리 실행에 실패했습니다. 지원되는 일반 사용자 환경과 브라우저 설치를 확인한 뒤 다시 실행해 주세요.", { cause: error });
    }
    context = await browser.newContext({
      acceptDownloads: false,
      bypassCSP: false,
      javaScriptEnabled: true,
      userAgent: CRAWLER_USER_AGENT,
      serviceWorkers: networkPolicy ? "block" : "allow",
    });
    const activeContext = context;
    await context.addInitScript({ content: POPUP_BLOCK_JS });
    // Download suppression + popup containment, registered once.
    context.on("page", (p: Page) => {
      p.on("download", (d) => {
        void d.cancel();
      });
      void p.opener().then((opener) => {
        if (opener) void p.close().catch(() => undefined);
      }).catch(() => undefined);
    });

    const discovery = await discoverSitemaps(options.entryUrl, deadline, options.signal,
      options.entryKind === "sitemap" || (limits.maxDepth > 0 && limits.maxPages > 1), {
        networkPolicy, initialSitemap: options.entryKind === "sitemap" ? options.entryUrl : undefined,
      });
    let sitemapPages = discovery.urls;
    let nextRequestAt = discovery.deferUntilMs ?? 0;
    const deferRequests = async (): Promise<boolean> => {
      while (nextRequestAt > performance.now()) {
        const delay = Math.ceil(nextRequestAt - performance.now());
        if (options.signal?.aborted || deadline.operationTimeoutMs(delay + 2000) < delay + 2000) return false;
        await new Promise<void>((resolve) => {
          const finish = (): void => { clearTimeout(timer); options.signal?.removeEventListener("abort", finish); resolve(); };
          const timer = setTimeout(finish, delay);
          options.signal?.addEventListener("abort", finish, { once: true });
        });
      }
      return !options.signal?.aborted && deadline.canStartPage();
    };

    const processPage = async (next: QueuedPage & { pageRank: number }): Promise<PageSnapshot | undefined> => {
      if (options.signal?.aborted || !deadline.canStartPage() || !await deferRequests()) return undefined;
      queuedPages -= 1;
      options.events?.onPageStarted?.(next.url, queuedPages);
      const pageStarted = performance.now();
      const page: Page = await activeContext.newPage();
      activePages.add(page);
      const pageExternals = new Map<string, ObservedExternal>();
      const collectionIssues = new Set<string>();
      const imageResponses: LiveImageResponse[] = [];
      const observeExternal = (external: ObservedExternal): void => {
        const key = `${external.url}\0${external.kind}`;
        if (pageExternals.has(key)) return;
        if (pageExternals.size >= SCAN_POLICY.collection.externalItemsPerPage || external.url.length > SCAN_POLICY.collection.urlCodeUnits) { collectionIssues.add("external-observation-limit"); return; }
        pageExternals.set(key, external);
        pushExternal(external);
      };
      let pageTimer: ReturnType<typeof setTimeout> | undefined;
      let pageTimedOut = false;
      let navigating = true;
      let status = 0;
      let finalUrl = next.url;
      let issue: ScanIssue | undefined;
      const requireSameSiteDocument = (): void => {
        finalUrl = page.url();
        if (isSameSite(entry.host, finalUrl)) return;
        observeExternal({ url: finalUrl, from: next.url, kind: "redirect" });
        issue = { kind: wasPolicyDenied(finalUrl) ? "network-policy" : "navigation", retryable: false };
        throw new Error("external-redirect");
      };
      // Hostile-page caps: abort oversized media/fonts, record externals.
      let seenRequests = 0;
      const decide = (req: Request): "abort" | "continue" => {
        const url = req.url();
        if (!isNavigable(url)) return "abort";
        try {
          if (new URL(url).host !== entry.host) {
            observeExternal({ url, from: next?.url ?? entry.href, kind: "resource" });
          }
        } catch {
          /* ignore malformed */
        }
        const type = req.resourceType();
        seenRequests += 1;
        if ((type === "media" || type === "font") && seenRequests > 200) return "abort";
        if (seenRequests > 500) { collectionIssues.add("request-limit"); return "abort"; }
        return "continue";
      };
      const onResponse = (res: Response): void => {
        const url = res.url();
        const status = res.status();
        if (wasPolicyDenied(url)) collectionIssues.add("network-policy-denied");
        if (res.request().resourceType() === "image" && status >= 200 && status < 300 && imageResponses.length < SCAN_POLICY.visual.candidatesPerDocument * 2) {
          const mediaType = (res.headers()["content-type"] ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
          // Retain descriptors, never response bodies. The gated collector
          // rejects declared oversized assets and rasterizes missing-length ones.
          if (["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"].includes(mediaType)) {
            imageResponses.push({ response: res, url, mediaType });
          }
        }
        // Redirect follow-up requests bypass routes; their final observed
        // response still contributes its external resource address.
        if ((status >= 300 && status < 400) || status >= 400 || res.request().redirectedFrom() !== null) {
          try {
            if (new URL(url).host !== entry.host) {
              observeExternal({ url, from: page.url() || (next?.url ?? entry.href),
                kind: status >= 300 ? "redirect" : "resource" });
            }
          } catch {
            /* ignore */
          }
        }
      };
      let snapshot: PageSnapshot | undefined;
      const liveFrames: LiveFrame[] = [];
      try {
        if (options.signal?.aborted) throw new Error("scan cancelled");
        if (!discovery.allows(next.url)) { issue = { kind: "denied", retryable: false }; throw new Error("robots-disallowed"); }
        const budget = Math.min(perPageMs, deadline.operationTimeoutMs(perPageMs));
        if (budget < 1000) throw new Error("scan deadline reached before page navigation");
        pageTimer = setTimeout(() => { pageTimedOut = true; void page.close().catch(() => undefined); }, budget);
        page.setDefaultTimeout(budget);
        page.setDefaultNavigationTimeout(budget);
        await page.route("**/*", (route: Route) => {
          if (decide(route.request()) === "abort") {
            void route.abort().catch(() => undefined);
            return;
          }
          void route.continue().catch(() => undefined);
        });
        page.on("response", onResponse);
        page.on("requestfailed", (request) => {
          if (!wasPolicyDenied(request.url())) return;
          collectionIssues.add("network-policy-denied");
          if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
            finalUrl = request.url(); issue = { kind: "network-policy", retryable: false };
          }
        });
        const settleBudget = Math.min(settleMs, Math.max(0, budget - 1000));
        const response = await page.goto(next.url, {
          waitUntil: "commit",
          timeout: Math.min(budget, 20000),
        });
        status = response?.status() ?? 0;
        requireSameSiteDocument();
        navigating = false;
        const headers = response?.headers() ?? {};
        issue = wasPolicyDenied(finalUrl) ? { kind: "network-policy", retryable: false } : classifyAccess(status, headers);
        if (issue?.kind === "rate-limit" && issue.retryAfterMs !== undefined) nextRequestAt = Math.max(nextRequestAt, performance.now() + issue.retryAfterMs);
        if (issue?.kind === "network-policy") throw new Error("network-policy-denied");
        if (issue?.kind === "challenge") throw new Error("access-challenge");
        // A commit can precede script execution by seconds under load. Start
        // the injection settle window only after the document is parsed, while
        // retaining time for analysis and whole-scan finalization.
        const remainingPageMs = (): number => Math.max(0, budget - (performance.now() - pageStarted) - 1000);
        const loadMs = Math.min(5000, remainingPageMs(), deadline.operationTimeoutMs(5000));
        if (loadMs > 0) {
          await page.waitForLoadState("domcontentloaded", { timeout: loadMs }).catch(() => undefined);
        }
        requireSameSiteDocument();
        const readAccessDocument = async () => page.evaluate(() => ({
          title: document.title,
          passwordForm: document.querySelector("form input[type=password]") !== null,
          challengeElement: document.querySelector("#challenge-running, #challenge-form, #cf-challenge-running, script[src*='/cdn-cgi/challenge-platform/']") !== null,
        }));
        issue = classifyAccess(status, headers, await readAccessDocument());
        if (issue) throw new Error(`access-${issue.kind}`);
        const waitMs = Math.min(settleBudget, remainingPageMs(), deadline.operationTimeoutMs(settleBudget));
        if (waitMs > 0) await page.waitForTimeout(waitMs);
        requireSameSiteDocument();
        if (waitMs > 0) issue = classifyAccess(status, headers, await readAccessDocument());
        if (issue) throw new Error(`access-${issue.kind}`);
        // Frame snapshot after settle: resolve absolute srcs, capture nested html.
        const described = await describePage(page);
        if (described.truncated) collectionIssues.add("link-discovery-limit");
        requireSameSiteDocument();
        const frameSnapshots: FrameSnapshot[] = [];
        const frameEls = page.frames();
        if (frameEls.length > SCAN_POLICY.collection.frameCount + 1) collectionIssues.add("frame-count-limit");
        for (const f of frameEls.slice(1, SCAN_POLICY.collection.frameCount + 1)) {
          try {
            const fUrl = f.url();
            // Ancestor chain: walk parentFrame() up to main, resolving each
            // level's selector via its frameElement handle.
            const chain: { src: string; selector: string }[] = [];
            const visibilityContext: ReturnType<typeof observeFrameOwner> = { transparent: false, offscreen: false,
              transparentDetail: "", offscreenDetail: "", unsupported: [] };
            let cursor = f;
            let guard = 0;
            while (cursor && cursor.parentFrame() && guard <= limits.maxFrameDepth) {
                const ownerHandle = await cursor.frameElement();
                try {
                  // Trusted selector factory source only. No page values enter
                  // source code; owner element is supplied by Playwright.
                  const selector = await ownerHandle.evaluate(selectFrameOwner);
                  if (typeof selector !== "string") throw new Error("frame owner has no unique selector");
                  const ownerVisibility = await ownerHandle.evaluate(observeFrameOwner, SCAN_POLICY.visibility);
                  visibilityContext.transparent ||= ownerVisibility.transparent;
                  visibilityContext.offscreen ||= ownerVisibility.offscreen;
                  if (ownerVisibility.transparentDetail) visibilityContext.transparentDetail += `${ownerVisibility.transparentDetail}; `;
                  if (ownerVisibility.offscreenDetail) visibilityContext.offscreenDetail += `${ownerVisibility.offscreenDetail}; `;
                  visibilityContext.unsupported.push(...ownerVisibility.unsupported);
                  chain.unshift({ src: cursor.url() || "about:blank", selector });
                } finally { await ownerHandle.dispose(); }
              const parent = cursor.parentFrame();
              if (!parent || parent === page.mainFrame()) break;
              cursor = parent;
              guard += 1;
            }
            if (chain.length === 0 || chain.length > limits.maxFrameDepth) { collectionIssues.add("frame-depth-limit"); continue; }
            frameSnapshots.push({
              srcChain: chain.map((c) => c.src),
              selectorChain: chain.map((c) => c.selector),
              url: fUrl,
              html: "",
            });
            liveFrames.push({ frame: f, srcChain: chain.map((c) => c.src), selectorChain: chain.map((c) => c.selector), visibilityContext });
            if (isNavigable(fUrl)) observeExternal({ url: fUrl, from: finalUrl, kind: "iframe" });
          } catch {
            collectionIssues.add("frame-observation-unavailable");
          }
        }
        const absoluteLinks = described.links
          .map((h) => {
            try {
              return new URL(h, finalUrl).href;
            } catch {
              return undefined;
            }
          })
          .filter((h): h is string => h !== undefined && isNavigable(h));
        snapshot = {
          url: next.url,
          finalUrl,
          depth: next.depth,
          status,
          html: "",
          links: absoluteLinks,
          frames: frameSnapshots,
          externals: [...pageExternals.values()].sort(compareExternal),
          duplicateContent: false,
          elapsedMs: performance.now() - pageStarted,
          discoverySource: next.discoverySource,
        };
        requireSameSiteDocument();
        if (options.onLivePage) await options.onLivePage(page, snapshot, liveFrames, imageResponses, next.pageRank);
        // Snapshot copies are optional evidence; official live detection has
        // already run and gets the shared deadline first.
        if (deadline.operationTimeoutMs(1000) > 0) {
          // Live production analysis needs only a small content signature for
          // deduplication. Standalone callers may retain a bounded replay DOM.
          let remaining = options.onLivePage ? Math.min(maxBodyBytes, 64 * 1024) : maxBodyBytes;
          const main = await page.evaluate(collectBoundedHtml, { maxBytes: remaining, limits: SCAN_POLICY.collection });
          snapshot.html = main.html;
          remaining -= main.bytes;
          if (main.truncated) collectionIssues.add("html-snapshot-truncated");
          for (let i = 0; i < liveFrames.length; i += 1) {
            if (options.onLivePage || remaining <= 0 || deadline.operationTimeoutMs(1000) <= 0) break;
            const frame = frameSnapshots[i];
            if (frame) {
              const captured = await liveFrames[i]!.frame.evaluate(collectBoundedHtml, { maxBytes: remaining, limits: SCAN_POLICY.collection });
              frame.html = captured.html; remaining -= captured.bytes;
              if (captured.truncated) collectionIssues.add("frame-snapshot-truncated");
            }
          }
        }
        if (collectionIssues.size) snapshot.collectionIssues = [...new Set([...(snapshot.collectionIssues ?? []), ...collectionIssues])].sort();
      } catch (error) {
        if (wasPolicyDenied(finalUrl)) issue = { kind: "network-policy", retryable: false };
        issue ??= classifyPageError(error, pageTimedOut, navigating);
        snapshot = {
          url: next.url,
          finalUrl,
          depth: next.depth,
          status,
          html: "",
          links: [],
          frames: [],
          externals: [...pageExternals.values()].sort(compareExternal),
          duplicateContent: false,
          elapsedMs: performance.now() - pageStarted,
          issue,
          ...(collectionIssues.size ? { collectionIssues: [...collectionIssues].sort() } : {}),
          discoverySource: next.discoverySource,
          failureReason: options.signal?.aborted ? "cancelled-during-analysis"
            : error instanceof Error && ["robots-disallowed", "external-redirect"].includes(error.message) ? error.message : `access-${issue.kind}`,
        };
      } finally {
        activePages.delete(page);
        if (pageTimer) clearTimeout(pageTimer);
        // Disposal ends document loading through trusted Chromium control;
        // page scripts cannot replace this operation as they can window.stop.
        // A page already closed by the page timer or by scan cancellation has
        // no loader left to stop, and attaching a CDP session while the
        // browser is being torn down can wait forever: the attach request
        // never settles once the closing connection drops it.
        if (!page.isClosed() && !pageTimedOut && !teardownRequested) {
          const session = await activeContext.newCDPSession(page).catch(() => undefined);
          if (session) {
            await session.send("Page.stopLoading").catch(() => undefined);
            await session.detach().catch(() => undefined);
          }
        }
        await page.close().catch(() => undefined);
      }
      if (!snapshot) throw new Error("page processing did not produce a snapshot");
      options.events?.onPageVisited?.(snapshot, queuedPages);
      return snapshot;
    };

    if (options.entryKind === "sitemap") {
      queue.nextFrontier();
      if (!sitemapPages.length && !options.signal?.aborted && deadline.canStartPage()) {
        throw new Error("sitemap discovery produced no admissible page URLs");
      }
      const seeds = queue.discoverBatch(sitemapPages.map((url) => ({ from: options.entryUrl, fromDepth: -1, url, discoverySource: "sitemap" })), discovery.allows);
      sitemapPages = [];
      for (const item of seeds) options.events?.onPageQueued?.({ url: item.url, depth: item.depth, pending: queue.pendingCount });
    }
    let frontier = queue.nextFrontier();
    let admittedPages = 0;
    while (frontier.length > 0 && !options.signal?.aborted && deadline.canStartPage()) {
      const rankedFrontier = frontier.map((next, index) => ({ ...next, pageRank: admittedPages + index }));
      admittedPages += rankedFrontier.length;
      queuedPages = rankedFrontier.length;
      const completed = await boundedMap(rankedFrontier, concurrency, processPage);
      const discovered: DiscoveredPage[] = [];
      // boundedMap preserves frontier order even when worker completion differs.
      for (const snapshot of completed) {
        if (!snapshot) {
          if (!options.signal?.aborted) timedOut = true;
          continue;
        }
        if (!snapshot.issue) snapshot.duplicateContent = queue.isDuplicateContent(snapshot.html.slice(0, 65536));
        // Live analysis and deduplication are finished. Do not retain replay
        // strings that production never consumes across all visited pages.
        if (options.onLivePage) snapshot.html = "";
        pages.push(snapshot);
        if (!snapshot.issue) discovered.push(...snapshot.links.map((url) => ({ from: snapshot.url, fromDepth: snapshot.depth, url, discoverySource: "link" as const })));
      }
      discovered.push(...sitemapPages.map((url) => ({ from: options.entryUrl, fromDepth: 0, url, discoverySource: "sitemap" as const })));
      sitemapPages = [];
      const added = queue.discoverBatch(discovered, discovery.allows);
      for (const item of added) options.events?.onPageQueued?.({ url: item.url, depth: item.depth, pending: queue.pendingCount });
      frontier = queue.nextFrontier();
    }
    if (!options.signal?.aborted && (frontier.length > 0 || deadline.expired() || !deadline.canStartPage())) timedOut = true;
  } finally {
    clearTimeout(deadlineTimer);
    options.signal?.removeEventListener("abort", abortPages);
    // Start every closer before awaiting: context disposal must not prevent
    // browser termination or the enforcing proxy from releasing its sockets.
    await Promise.all([
      context?.close().catch(() => undefined),
      browser?.close().catch(() => undefined),
      networkProxy?.close(),
    ]);
  }
  return {
    entryUrl: options.entryUrl,
    pages,
    externals: [...queue.observedExternals].sort(compareExternal),
    elapsedMs: performance.now() - t0,
    timedOut,
    cancelled: options.signal?.aborted ?? false,
  };
}
