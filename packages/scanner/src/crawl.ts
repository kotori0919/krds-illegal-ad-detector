/**
 * Production crawler (GOAL Phase 3) on the Playwright API.
 *
 * KODEX policy honored:
 * - Playwright API drives navigation; no CLI-output scraping.
 * - External ad infrastructure observed, never recursively crawled.
 * - Hostile pages contained: popup/download suppression, request caps,
 *   per-page budget, hard global timeout, same-site bound, depth bound.
 * - Mutation settling: network-idle attempt + fixed settle windows so
 *   delayed (setTimeout) ad injection is observed without unbounded waits.
 */
import { chromium, type Browser, type BrowserContext, type Frame, type Page, type Request, type Response, type Route } from "playwright-core";
import { DEFAULT_SCAN_LIMITS, type ScanLimits } from "@krds-detector/contracts";
import { CrawlQueue, type ObservedExternal, type QueuedPage } from "./queue.js";
import { ScanDeadline, pageConcurrency } from "./deadline.js";
import { normalizeUrl } from "./urls.js";

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
}

export interface LiveFrame {
  frame: Frame;
  srcChain: string[];
  selectorChain: string[];
}

export interface CrawlEvents {
  onPageVisited?: (snapshot: PageSnapshot) => void;
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
  /** Called while the first and only navigated Page remains live. */
  onLivePage?: (page: Page, snapshot: PageSnapshot, frames: LiveFrame[]) => Promise<void>;
}

export interface CrawlSummary {
  entryUrl: string;
  pages: PageSnapshot[];
  externals: ObservedExternal[];
  elapsedMs: number;
  timedOut: boolean;
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
  const t0 = Date.now();
  const limits: ScanLimits = { ...DEFAULT_SCAN_LIMITS, ...options.limits };
  const deadline = options.deadline ?? new ScanDeadline(limits.timeoutSec);
  const concurrency = options.concurrency ?? pageConcurrency();
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) {
    throw new RangeError("page concurrency must be between 1 and 4");
  }
  const entry = normalizeUrl(options.entryUrl);
  const queue = new CrawlQueue(options.entryUrl, entry.host, {
    maxPages: limits.maxPages,
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
  let timedOut = false;
  try {
    browser = await chromium.launch({ executablePath: options.executablePath, channel: options.channel, args: ["--no-sandbox"] });
    context = await browser.newContext({
      acceptDownloads: false,
      bypassCSP: false,
      javaScriptEnabled: true,
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

    const processPage = async (next: QueuedPage): Promise<PageSnapshot | undefined> => {
      if (!deadline.canStartPage()) return undefined;
      const pageStarted = Date.now();
      const page: Page = await activeContext.newPage();
      let pageTimer: ReturnType<typeof setTimeout> | undefined;
      // Hostile-page caps: abort oversized media/fonts, record externals.
      const seenRequests: string[] = [];
      const decide = (req: Request): "abort" | "continue" => {
        const url = req.url();
        if (!isNavigable(url)) return "abort";
        try {
          if (new URL(url).host !== entry.host) {
            pushExternal({ url, from: next?.url ?? entry.href, kind: "resource" });
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
        if ((status >= 300 && status < 400) || status >= 400) {
          try {
            if (new URL(url).host !== entry.host) {
              pushExternal({ url, from: page.url() || (next?.url ?? entry.href), kind: "redirect" });
            }
          } catch {
            /* ignore */
          }
        }
      };
      let snapshot: PageSnapshot | undefined;
      const liveFrames: LiveFrame[] = [];
      try {
        const budget = Math.min(perPageMs, deadline.operationTimeoutMs(perPageMs));
        if (budget < 1000) throw new Error("scan deadline reached before page navigation");
        pageTimer = setTimeout(() => { void page.close().catch(() => undefined); }, budget);
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
        const navStart = Date.now();
        const response = await page.goto(next.url, {
          waitUntil: "commit",
          timeout: Math.min(budget, 20000),
        });
        const status = response?.status() ?? 0;
        // Settle clock starts at navigation start: delayed injection is a
        // wall-clock race, and domcontentloaded/networkidle already consume it.
        const waited = Date.now() - navStart;
        if (waited < settleBudget) {
          const waitMs = Math.min(settleBudget - waited, deadline.operationTimeoutMs(settleBudget));
          if (waitMs > 0) await page.waitForTimeout(waitMs);
        }
        // Frame snapshot after settle: resolve absolute srcs, capture nested html.
        const described = await describePage(page, limits.maxFrameDepth);
        const finalUrl = page.url();
        const frameSnapshots: FrameSnapshot[] = [];
        const frameEls = page.frames();
        for (const f of frameEls.slice(1, 16)) {
          try {
            const fUrl = f.url();
            if (!fUrl || fUrl === "about:blank") continue;
            // Ancestor chain: walk parentFrame() up to main, resolving each
            // level's selector via its frameElement handle.
            const chain: { url: string; selector: string }[] = [];
            let cursor = f;
            let guard = 0;
            while (cursor && cursor.parentFrame() && guard < 5) {
              let selector = "iframe";
              try {
                const ownerHandle = await cursor.frameElement();
                const resolved: unknown = await ownerHandle.evaluate((el: Element) => {
                  if (el.id && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(el.id)) return `#${el.id}`;
                  const parent = el.parentElement;
                  if (!parent) return "iframe";
                  const sibs = Array.from(parent.children).filter(
                    (s) => s.tagName.toLowerCase() === "iframe",
                  );
                  const index = sibs.indexOf(el) + 1;
                  return el.id ? `iframe#${el.id}` : `iframe:nth-of-type(${String(index)})`;
                }).catch(() => "iframe");
                if (typeof resolved === "string" && resolved.length > 0) selector = resolved;
                await ownerHandle.dispose().catch(() => undefined);
              } catch {
                /* cross-origin owner: keep generic selector */
              }
              chain.unshift({ url: cursor.url() || fUrl, selector });
              const parent = cursor.parentFrame();
              if (!parent || parent === page.mainFrame()) break;
              cursor = parent;
              guard += 1;
            }
            if (chain.length === 0) chain.push({ url: fUrl, selector: "iframe" });
            frameSnapshots.push({
              srcChain: chain.map((c) => c.url),
              selectorChain: chain.map((c) => c.selector),
              url: fUrl,
              html: "",
            });
            liveFrames.push({ frame: f, srcChain: chain.map((c) => c.url), selectorChain: chain.map((c) => c.selector) });
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
            pushExternal({ url: abs, from: finalUrl, kind: "iframe" });
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
          externals: [...externals],
          duplicateContent: false,
          elapsedMs: Date.now() - pageStarted,
        };
        if (options.onLivePage) await options.onLivePage(page, snapshot, liveFrames);
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
        snapshot = {
          url: next.url,
          finalUrl: next.url,
          depth: next.depth,
          status: 0,
          html: "",
          links: [],
          frames: [],
          externals: [...externals],
          duplicateContent: false,
          elapsedMs: Date.now() - pageStarted,
        };
        void error;
      } finally {
        if (pageTimer) clearTimeout(pageTimer);
        await page.close().catch(() => undefined);
      }
      if (!snapshot) throw new Error("page processing did not produce a snapshot");
      return snapshot;
    };

    let frontier = queue.nextFrontier();
    while (frontier.length > 0 && deadline.canStartPage()) {
      const completed = await boundedMap(frontier, concurrency, processPage);
      // boundedMap preserves frontier order even when worker completion differs.
      for (const snapshot of completed) {
        if (!snapshot) {
          timedOut = true;
          continue;
        }
        snapshot.duplicateContent = queue.isDuplicateContent(snapshot.html.slice(0, 65536));
        pages.push(snapshot);
        options.events?.onPageVisited?.(snapshot);
        const added = queue.discover(snapshot.url, snapshot.depth, [...snapshot.links].sort());
        for (const item of added) {
          options.events?.onPageQueued?.({ url: item.url, depth: item.depth, pending: queue.pendingCount });
        }
      }
      frontier = queue.nextFrontier();
    }
    if (frontier.length > 0 || deadline.expired() || !deadline.canStartPage()) timedOut = true;
  } finally {
    await context?.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
  }
  return {
    entryUrl: options.entryUrl,
    pages,
    externals: [...queue.observedExternals, ...externals].filter(
      (e, i, all) => all.findIndex((x) => x.url === e.url && x.kind === e.kind) === i,
    ),
    elapsedMs: Date.now() - t0,
    timedOut,
  };
}
