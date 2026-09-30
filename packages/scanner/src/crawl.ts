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
import { chromium, type Browser, type BrowserContext, type Page, type Request, type Response, type Route } from "playwright-core";
import { DEFAULT_SCAN_LIMITS, type ScanLimits } from "@krds-detector/contracts";
import { CrawlQueue, type ObservedExternal } from "./queue.js";
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

export interface CrawlEvents {
  onPageVisited?: (snapshot: PageSnapshot) => void;
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
}

export interface CrawlSummary {
  entryUrl: string;
  pages: PageSnapshot[];
  externals: ObservedExternal[];
  elapsedMs: number;
  timedOut: boolean;
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
  const entry = normalizeUrl(options.entryUrl);
  const queue = new CrawlQueue(options.entryUrl, entry.host, {
    maxPages: limits.maxPages,
    maxDepth: limits.maxDepth,
    timeoutSec: limits.timeoutSec,
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
    browser = await chromium.launch({ executablePath: options.executablePath });
    context = await browser.newContext({
      acceptDownloads: false,
      bypassCSP: false,
      javaScriptEnabled: true,
    });
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

    let next = queue.next();
    while (next && !queue.expired()) {
      const remaining = queue.remainingMs();
      if (remaining <= 0) {
        timedOut = true;
        break;
      }
      const pageStarted = Date.now();
      const page: Page = await context.newPage();
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
      await page.route("**/*", (route: Route) => {
        if (decide(route.request()) === "abort") {
          void route.abort().catch(() => undefined);
          return;
        }
        void route.continue().catch(() => undefined);
      });
      page.on("response", (res: Response) => {
        onResponse(res);
      });

      let snapshot: PageSnapshot | undefined;
      try {
        const budget = Math.min(perPageMs, Math.max(1000, remaining - 500));
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
        if (waited < settleBudget) await page.waitForTimeout(settleBudget - waited);
        // Frame snapshot after settle: resolve absolute srcs, capture nested html.
        const described = await describePage(page, limits.maxFrameDepth);
        const finalUrl = page.url();
        let html = "";
        try {
          // Live DOM after settle: captures delayed/mutated injection.
          // Raw bytes stay available via response body only for debugging.
          html = (await page.content()).slice(0, maxBodyBytes);
        } catch {
          html = "";
        }
        const duplicateContent = queue.isDuplicateContent(html.slice(0, 65536));
        const frameSnapshots: FrameSnapshot[] = [];
        const frameEls = page.frames();
        for (const f of frameEls.slice(1, 16)) {
          try {
            const fUrl = f.url();
            if (!fUrl || fUrl === "about:blank") continue;
            const fHtml = await f.content().catch(() => "");
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
              html: fHtml.slice(0, maxBodyBytes),
            });
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
        const added = queue.discover(next.url, next.depth, absoluteLinks);
        for (const a of added) {
          void a;
        }
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
          html: html.slice(0, maxBodyBytes),
          links: absoluteLinks,
          frames: frameSnapshots,
          externals: [...externals],
          duplicateContent,
          elapsedMs: Date.now() - pageStarted,
        };
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
        await page.close().catch(() => undefined);
      }
      if (snapshot) {
        pages.push(snapshot);
        options.events?.onPageVisited?.(snapshot);
      }
      if (queue.expired()) {
        timedOut = true;
        break;
      }
      next = queue.next();
    }
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
