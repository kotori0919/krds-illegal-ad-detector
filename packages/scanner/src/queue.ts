/**
 * Bounded crawl queue (GOAL Phase 3).
 *
 * BFS by depth; same-site only; visited-key dedup; content-hash dedup hook;
 * maxPages / maxDepth enforced. The caller owns the one scan deadline.
 * External URLs are reported as
 * observed infrastructure, never enqueued.
 */
import { contentKey, isSameSite, normalizeUrlKey } from "./urls.js";
import { SCAN_POLICY } from "@krds-detector/contracts";

export interface CrawlLimits {
  maxPages: number;
  maxDepth: number;
}

export interface QueuedPage {
  url: string;
  key: string;
  depth: number;
  discoverySource: "entry" | "link" | "sitemap";
}

export interface DiscoveredPage {
  from: string;
  fromDepth: number;
  url: string;
  discoverySource: "link" | "sitemap";
}

export interface ObservedExternal {
  url: string;
  from: string;
  kind: "link" | "iframe" | "resource" | "redirect";
}

export class CrawlQueue {
  private queue: QueuedPage[] = [];
  private queuedKeys = new Set<string>();
  private visited = new Set<string>();
  private seenContent = new Set<string>();
  private externals = new Map<string, ObservedExternal>();

  constructor(
    readonly entryUrl: string,
    readonly entryHost: string,
    private limits: CrawlLimits,
  ) {
    this.enqueue(entryUrl, 0, "entry");
  }

  get pendingCount(): number {
    return this.queue.length;
  }

  get visitedCount(): number {
    return this.visited.size;
  }

  get observedExternals(): readonly ObservedExternal[] {
    return [...this.externals.values()];
  }

  private enqueue(url: string, depth: number, discoverySource: QueuedPage["discoverySource"]): boolean {
    if (depth > this.limits.maxDepth) return false;
    if (this.visited.size + this.queue.length >= this.limits.maxPages) return false;
    let key: string;
    try {
      key = normalizeUrlKey(url);
    } catch {
      return false;
    }
    if (this.visited.has(key)) return false;
    if (this.queuedKeys.has(key)) return false;
    this.queue.push({ url, key, depth, discoverySource });
    this.queuedKeys.add(key);
    return true;
  }

  next(): QueuedPage | undefined {
    const page = this.queue.shift();
    if (page) { this.visited.add(page.key); this.queuedKeys.delete(page.key); }
    return page;
  }

  /** Admit one complete BFS depth in normalized URL order. */
  nextFrontier(): QueuedPage[] {
    this.queue.sort((a, b) => a.depth - b.depth || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    const depth = this.queue[0]?.depth;
    if (depth === undefined) return [];
    let count = 0;
    while (this.queue[count]?.depth === depth) count += 1;
    const frontier = this.queue.splice(0, count);
    for (const page of frontier) { this.visited.add(page.key); this.queuedKeys.delete(page.key); }
    return frontier;
  }

  /** Register discovered hrefs; returns newly enqueued same-site pages. */
  discover(from: string, fromDepth: number, hrefs: string[]): QueuedPage[] {
    return this.discoverBatch(hrefs.map((url) => ({ from, fromDepth, url, discoverySource: "link" })));
  }

  /** Merge a complete frontier's discoveries before applying the page bound. */
  discoverBatch(candidates: DiscoveredPage[], allows: (url: string) => boolean = () => true): QueuedPage[] {
    const added: QueuedPage[] = [];
    const normalized: (DiscoveredPage & { key: string })[] = [];
    for (const candidate of candidates) {
      let absolute: string;
      try {
        const url = new URL(candidate.url, candidate.from);
        if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) continue;
        url.hash = "";
        absolute = url.href;
      } catch {
        continue;
      }
      if (!isSameSite(this.entryHost, absolute)) {
        this.observeExternal(absolute, candidate.from, "link");
        continue;
      }
      if (!allows(absolute)) continue;
      normalized.push({ ...candidate, url: absolute, key: normalizeUrlKey(absolute) });
    }
    normalized.sort((a, b) => a.fromDepth - b.fromDepth || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)
      || a.discoverySource.localeCompare(b.discoverySource) || a.from.localeCompare(b.from) || a.url.localeCompare(b.url));
    for (const candidate of normalized) {
      const before = this.queue.length;
      if (this.enqueue(candidate.url, candidate.fromDepth + 1, candidate.discoverySource)) {
        added.push(this.queue[before] as QueuedPage);
      }
    }
    return added;
  }

  /** Content dedup: true when body hash already visited. */
  isDuplicateContent(text: string): boolean {
    const key = contentKey(text);
    if (this.seenContent.has(key)) return true;
    this.seenContent.add(key);
    return false;
  }

  observeExternal(url: string, from: string, kind: ObservedExternal["kind"]): void {
    const key = `${url}\0${kind}`;
    if (!this.externals.has(key) && this.externals.size < SCAN_POLICY.collection.externalItems && url.length <= SCAN_POLICY.collection.urlCodeUnits) this.externals.set(key, { url, from, kind });
  }
}
