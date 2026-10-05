/**
 * Bounded crawl queue (GOAL Phase 3).
 *
 * BFS by depth; same-site only; visited-key dedup; content-hash dedup hook;
 * maxPages / maxDepth enforced. The caller owns the one scan deadline.
 * External URLs are reported as
 * observed infrastructure, never enqueued.
 */
import { contentKey, isSameSite, normalizeUrlKey } from "./urls.js";

export interface CrawlLimits {
  maxPages: number;
  maxDepth: number;
}

export interface QueuedPage {
  url: string;
  key: string;
  depth: number;
}

export interface ObservedExternal {
  url: string;
  from: string;
  kind: "link" | "iframe" | "resource" | "redirect";
}

export class CrawlQueue {
  private queue: QueuedPage[] = [];
  private visited = new Set<string>();
  private seenContent = new Set<string>();
  private externals: ObservedExternal[] = [];

  constructor(
    readonly entryUrl: string,
    readonly entryHost: string,
    private limits: CrawlLimits,
  ) {
    this.enqueue(entryUrl, 0);
  }

  get pendingCount(): number {
    return this.queue.length;
  }

  get visitedCount(): number {
    return this.visited.size;
  }

  get observedExternals(): readonly ObservedExternal[] {
    return this.externals;
  }

  private enqueue(url: string, depth: number): boolean {
    if (depth > this.limits.maxDepth) return false;
    if (this.visited.size + this.queue.length >= this.limits.maxPages) return false;
    let key: string;
    try {
      key = normalizeUrlKey(url);
    } catch {
      return false;
    }
    if (this.visited.has(key)) return false;
    if (this.queue.some((q) => q.key === key)) return false;
    this.queue.push({ url, key, depth });
    return true;
  }

  next(): QueuedPage | undefined {
    const page = this.queue.shift();
    if (page) this.visited.add(page.key);
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
    for (const page of frontier) this.visited.add(page.key);
    return frontier;
  }

  /** Register discovered hrefs; returns newly enqueued same-site pages. */
  discover(from: string, fromDepth: number, hrefs: string[]): QueuedPage[] {
    const added: QueuedPage[] = [];
    for (const href of hrefs) {
      let absolute: string;
      try {
        absolute = new URL(href, from).href;
      } catch {
        continue;
      }
      if (!isSameSite(this.entryHost, absolute)) {
        this.externals.push({ url: absolute, from, kind: "link" });
        continue;
      }
      const before = this.queue.length;
      if (this.enqueue(absolute, fromDepth + 1)) {
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
    this.externals.push({ url, from, kind });
  }
}
