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
import { DEFAULT_SCAN_LIMITS, type ScanIssue, type ScanLimits } from "@krds-detector/contracts";
import { CrawlQueue, type DiscoveredPage, type ObservedExternal, type QueuedPage } from "./queue.js";
import { ScanDeadline, pageConcurrency } from "./deadline.js";
import { isSameSite, normalizeUrl } from "./urls.js";
import { classifyAccess, classifyPageError } from "./access.js";
import { CRAWLER_USER_AGENT, discoverSitemaps } from "./sitemap.js";
import { PublicNetworkPolicy, startPublicNetworkProxy, type PublicNetworkBoundary, type PublicNetworkProxy } from "./public-network.js";

export interface FrameSnapshot {
  /** Absolute iframe src chain, outer → inner. */
  srcChain: string[];
  /** Selector chain locating each iframe in its parent, outer → inner. */
  selectorChain: string[];
  url: string;
  html: string;
}

export interface LocatedSnapshot {
  /** Contract-conformant location: iframe[src="ABS"] >>> selector. */
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
}

export interface LiveFrame {
  frame: Frame;
  srcChain: string[];
  selectorChain: string[];
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
  /** Trusted owned-fixture code only; never accepted from UI/worker arguments. */
  networkPolicyForTesting?: PublicNetworkBoundary;
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

function isNavigable(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

function compareExternal(a: ObservedExternal, b: ObservedExternal): number {
  return a.url.localeCompare(b.url) || a.from.localeCompare(b.from) || a.kind.localeCompare(b.kind);
}

/** Extract iframe descriptors + anchors from a live page. */
async function describePage(page: Page, frameDepth: number): Promise<{ links: string[]; frames: { src: string; selector: string }[] }> {
  return page.evaluate((maxDepth: number) => {
    const links: string[] = [];
    const anchors = document.querySelectorAll("a[href]");
    for (let i = 0; i < anchors.length; i += 1) {
      const href = anchors[i]?.getAttribute("href");
      if (href) links.push(href);
    }
    const frames: { src: string; selector: string }[] = [];
    const doc = document as Document;
    const walk = (root: Document | Element, depth: number, prefix: string): void => {
      if (depth > maxDepth) return;
      const iframes = root.querySelectorAll(":scope iframe");
      iframes.forEach((el, i) => {
        const src = el.getAttribute("src") ?? "";
        const id = el.getAttribute("id");
        const sel = id ? `iframe#${id}` : `${prefix}iframe:nth-of-type(${String(i + 1)})`;
        frames.push({ src, selector: sel });
        try {
          const child = (el as HTMLIFrameElement).contentDocument;
          if (child) walk(child as unknown as Element, depth + 1, `${sel} `);
        } catch {
          /* cross-origin: src recorded, content unreachable */
        }
      });
      void doc;
    };
    walk(document, 1, "");
    return { links, frames };
  }, frameDepth);
}

export async function crawlSite(options: CrawlOptions): Promise<CrawlSummary> {
  const t0 = performance.now();
  const limits: ScanLimits = { ...DEFAULT_SCAN_LIMITS, ...options.limits };
  const deadline = options.deadline ?? new ScanDeadline(limits.timeoutSec);
  const concurrency = options.concurrency ?? pageConcurrency();
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) {
    throw new RangeError("page concurrency must be between 1 and 4");
  }
  const entry = normalizeUrl(options.entryUrl);
  const queue = new CrawlQueue(options.entryUrl, entry.host, {
    // The sitemap seed is consumed as discovery metadata, not a page attempt.
    maxPages: limits.maxPages + (options.entryKind === "sitemap" ? 1 : 0),
    maxDepth: limits.maxDepth,
  });
  const settleMs = options.settleMs ?? 1500;
  const perPageMs = options.perPageMs ?? 30000;
  const maxBodyBytes = options.maxBodyBytes ?? 4 * 1024 * 1024;

  const pages: PageSnapshot[] = [];
  const externals: ObservedExternal[] = [];
  const pushExternal = (e: ObservedExternal): void => {
    externals.push(e);
    queue.observeExternal(e.url, e.from, e.kind);
    options.events?.onExternal?.(e);
  };

  let browser: Browser | undefined;
  let context: BrowserContext | undefined;
  let networkProxy: PublicNetworkProxy | undefined;
  let timedOut = false;
  let queuedPages = 0;
  const activePages = new Set<Page>();
  const abortPages = (): void => {
    for (const page of activePages) void page.close().catch(() => undefined);
  };
  options.signal?.addEventListener("abort", abortPages, { once: true });
  const launchBudgetMs = deadline.operationTimeoutMs(30_000);
  if (options.signal?.aborted || !deadline.canStartPage() || launchBudgetMs < 1) {
    options.signal?.removeEventListener("abort", abortPages);
    return { entryUrl: options.entryUrl, pages, externals, elapsedMs: performance.now() - t0,
      timedOut: !options.signal?.aborted, cancelled: options.signal?.aborted ?? false };
  }
  try {
    const networkPolicy = options.publicNetworkOnly ? options.networkPolicyForTesting ?? new PublicNetworkPolicy() : undefined;
    if (networkPolicy) {
      await networkPolicy.resolveTarget(options.entryUrl, options.signal, deadline.operationTimeoutMs(2000));
      networkProxy = await startPublicNetworkProxy(networkPolicy, deadline, options.signal);
    }
    browser = await chromium.launch({
      executablePath: options.executablePath,
      channel: options.channel,
      args: ["--no-sandbox", ...(networkPolicy ? ["--proxy-bypass-list=<-loopback>", "--disable-quic", "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
        "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"] : [])],
      proxy: networkProxy?.proxy,
      timeout: launchBudgetMs,
    });
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
      const pageExternals: ObservedExternal[] = [];
      const imageResponses: LiveImageResponse[] = [];
      const observeExternal = (external: ObservedExternal): void => {
        pageExternals.push(external);
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
        issue = { kind: "navigation", retryable: false };
        throw new Error("external-redirect");
      };
      // Hostile-page caps: abort oversized media/fonts, record externals.
      const seenRequests: string[] = [];
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
        if ((type === "media" || type === "font") && seenRequests.length > 200) return "abort";
        seenRequests.push(url);
        if (seenRequests.length > 500) return "abort";
        return "continue";
      };
      const onResponse = (res: Response): void => {
        const url = res.url();
        const status = res.status();
        if (res.request().resourceType() === "image" && status >= 200 && status < 300 && imageResponses.length < 16) {
          const mediaType = (res.headers()["content-type"] ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
          // Retain descriptors, never response bodies. The gated collector
          // rejects declared oversized assets and rasterizes missing-length ones.
          if (["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(mediaType)) {
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
        const settleBudget = Math.min(settleMs, Math.max(0, budget - 1000));
        const response = await page.goto(next.url, {
          waitUntil: "commit",
          timeout: Math.min(budget, 20000),
        });
        status = response?.status() ?? 0;
        requireSameSiteDocument();
        navigating = false;
        const headers = response?.headers() ?? {};
        issue = classifyAccess(status, headers);
        if (issue?.kind === "rate-limit" && issue.retryAfterMs !== undefined) nextRequestAt = Math.max(nextRequestAt, performance.now() + issue.retryAfterMs);
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
        const described = await describePage(page, limits.maxFrameDepth);
        requireSameSiteDocument();
        const frameSnapshots: FrameSnapshot[] = [];
        const frameEls = page.frames();
        for (const f of frameEls.slice(1, 16)) {
          try {
            const fUrl = f.url();
            if (!fUrl || fUrl === "about:blank") continue;
            // Ancestor chain: walk parentFrame() up to main, resolving each
            // level's selector via its frameElement handle.
            const chain: { src: string; selector: string }[] = [];
            let cursor = f;
            let guard = 0;
            while (cursor && cursor.parentFrame() && guard < 5) {
              let selector = "iframe";
              let absoluteSrc = cursor.url() || fUrl;
              try {
                const ownerHandle = await cursor.frameElement();
                const resolved = await ownerHandle.evaluate((el: Element) => {
                  const rawSrc = el.getAttribute("src");
                  const src = rawSrc ? new URL(rawSrc, el.ownerDocument.baseURI).href : "";
                  if (el.id && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(el.id)) return { selector: `#${el.id}`, src };
                  const parent = el.parentElement;
                  if (!parent) return { selector: "iframe", src };
                  const sibs = Array.from(parent.children).filter(
                    (s) => s.tagName.toLowerCase() === "iframe",
                  );
                  const index = sibs.indexOf(el) + 1;
                  return { selector: `iframe:nth-of-type(${String(index)})`, src };
                }).catch(() => ({ selector: "iframe", src: "" }));
                if (resolved.selector) selector = resolved.selector;
                if (resolved.src) absoluteSrc = resolved.src;
                await ownerHandle.dispose().catch(() => undefined);
              } catch {
                  /* cross-origin owner: keep generic selector */
              }
              chain.unshift({ src: absoluteSrc, selector });
              const parent = cursor.parentFrame();
              if (!parent || parent === page.mainFrame()) break;
              cursor = parent;
              guard += 1;
            }
            if (chain.length === 0) chain.push({ src: fUrl, selector: "iframe" });
            if (chain.length > limits.maxFrameDepth) continue;
            frameSnapshots.push({
              srcChain: chain.map((c) => c.src),
              selectorChain: chain.map((c) => c.selector),
              url: fUrl,
              html: "",
            });
            liveFrames.push({ frame: f, srcChain: chain.map((c) => c.src), selectorChain: chain.map((c) => c.selector) });
          } catch {
            /* cross-origin frame: recorded via describe, content skipped */
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
        for (const fr of described.frames) {
          if (!fr.src) continue;
          try {
            const abs = new URL(fr.src, finalUrl).href;
            observeExternal({ url: abs, from: finalUrl, kind: "iframe" });
          } catch {
            /* ignore */
          }
        }
        snapshot = {
          url: next.url,
          finalUrl,
          depth: next.depth,
          status,
          html: "",
          links: absoluteLinks,
          frames: frameSnapshots,
          externals: [...pageExternals].sort(compareExternal),
          duplicateContent: false,
          elapsedMs: performance.now() - pageStarted,
          discoverySource: next.discoverySource,
        };
        requireSameSiteDocument();
        if (options.onLivePage) await options.onLivePage(page, snapshot, liveFrames, imageResponses, next.pageRank);
        // Snapshot copies are optional evidence; official live detection has
        // already run and gets the shared deadline first.
        if (deadline.operationTimeoutMs(1000) > 0) {
          snapshot.html = (await page.content().catch(() => "")).slice(0, maxBodyBytes);
          for (let i = 0; i < liveFrames.length; i += 1) {
            if (deadline.operationTimeoutMs(1000) <= 0) break;
            const frame = frameSnapshots[i];
            if (frame) frame.html = (await liveFrames[i]!.frame.content().catch(() => "")).slice(0, maxBodyBytes);
          }
        }
      } catch (error) {
        issue ??= classifyPageError(error, pageTimedOut, navigating);
        snapshot = {
          url: next.url,
          finalUrl,
          depth: next.depth,
          status,
          html: "",
          links: [],
          frames: [],
          externals: [...pageExternals].sort(compareExternal),
          duplicateContent: false,
          elapsedMs: performance.now() - pageStarted,
          issue,
          discoverySource: next.discoverySource,
          failureReason: options.signal?.aborted ? "cancelled-during-analysis"
            : error instanceof Error && ["robots-disallowed", "external-redirect"].includes(error.message) ? error.message : `access-${issue.kind}`,
        };
      } finally {
        activePages.delete(page);
        if (pageTimer) clearTimeout(pageTimer);
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
    options.signal?.removeEventListener("abort", abortPages);
    await context?.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
    await networkProxy?.close();
  }
  return {
    entryUrl: options.entryUrl,
    pages,
    externals: [...queue.observedExternals, ...externals].sort(compareExternal)
      .filter(
      (e, i, all) => all.findIndex((x) => x.url === e.url && x.kind === e.kind) === i,
    ),
    elapsedMs: performance.now() - t0,
    timedOut,
    cancelled: options.signal?.aborted ?? false,
  };
}
