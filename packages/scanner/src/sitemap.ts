import { performance } from "node:perf_hooks";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { ScanDeadline } from "./deadline.js";
import { normalizeUrlKey } from "./urls.js";
import { retryAfterMs } from "./access.js";

export const SITEMAP_LIMITS = Object.freeze({
  totalMs: 5000, requestMs: 2000, documents: 8, indexDepth: 2, urls: 1000,
  documentBytes: 512 * 1024, totalBytes: 2 * 1024 * 1024, robotsBytes: 128 * 1024, redirects: 3,
  queuedDocuments: 800,
});
export const CRAWLER_USER_AGENT = "KrdsDetector";

interface RobotsRule { allow: boolean; pattern: string }
interface RobotsGroup { agents: string[]; rules: RobotsRule[] }

export interface SitemapDiscovery {
  urls: string[];
  allows: (url: string) => boolean;
  deferUntilMs?: number;
}

function parseRobots(text: string): { groups: RobotsGroup[]; sitemaps: string[] } {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  let group: RobotsGroup | undefined;
  let hasRules = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key === "sitemap" && value) sitemaps.push(value);
    else if (key === "user-agent") {
      if (!group || hasRules) { group = { agents: [], rules: [] }; groups.push(group); hasRules = false; }
      group.agents.push(value.toLowerCase());
    } else if (group && (key === "allow" || key === "disallow")) {
      hasRules = true;
      if (value) group.rules.push({ allow: key === "allow", pattern: value });
    }
  }
  return { groups, sitemaps };
}

function normalizedOctets(value: string): string {
  return value.replace(/[\u0080-\u{10ffff}]/gu, (character) => encodeURIComponent(character))
    .replace(/%([\da-f]{2})/gi, (encoded, hex: string) => {
      const character = String.fromCharCode(Number.parseInt(hex, 16));
      return /^[\w.~-]$/.test(character) ? character : encoded.toUpperCase();
    });
}

/** Ordered substring matching avoids backtracking regexes from hostile rules. */
function matchesRule(path: string, parts: string[], anchored: boolean): boolean {
  if (!path.startsWith(parts[0]!)) return false;
  let offset = parts[0]!.length;
  if (parts.length === 1) return !anchored || offset === path.length;
  for (let i = 1; i < parts.length; i += 1) {
    const part = parts[i]!;
    if (anchored && i === parts.length - 1) return path.endsWith(part) && path.length - part.length >= offset;
    const found = path.indexOf(part, offset);
    if (found < 0) return false;
    offset = found + part.length;
  }
  return true;
}

function robotsPolicy(groups: RobotsGroup[]): (url: string) => boolean {
  const specific = groups.filter((group) => group.agents.includes(CRAWLER_USER_AGENT.toLowerCase()));
  const rules = (specific.length ? specific : groups.filter((group) => group.agents.includes("*"))).flatMap((group) => group.rules);
  const matchers = rules.map((rule) => {
    const anchored = rule.pattern.endsWith("$");
    const pattern = normalizedOctets(anchored ? rule.pattern.slice(0, -1) : rule.pattern);
    return { allow: rule.allow, length: pattern.replace(/\*/g, "").length, parts: pattern.split("*"), anchored };
  });
  return (url: string): boolean => {
    const parsed = new URL(url);
    const path = normalizedOctets(`${parsed.pathname}${parsed.search}`);
    let selected: { allow: boolean; length: number } | undefined;
    for (const rule of matchers) {
      if (matchesRule(path, rule.parts, rule.anchored) && (!selected || rule.length > selected.length || (rule.length === selected.length && rule.allow))) selected = rule;
    }
    return selected?.allow ?? true;
  };
}

function sameOriginUrl(raw: string, origin: string): string | undefined {
  try {
    const url = new URL(raw);
    if (url.origin !== origin || !["http:", "https:"].includes(url.protocol) || url.username || url.password || raw.length > 2048) return undefined;
    url.hash = "";
    return url.href;
  } catch { return undefined; }
}

/** XML definitions are rejected; only predefined/numeric escaping is decoded. */
function sitemapLocations(xml: string): { index: boolean; locations: string[] } | undefined {
  try {
    if (/<!\s*(?:DOCTYPE|ENTITY)/i.test(xml) || /&(?!(?:amp|lt|gt|apos|quot|#\d+|#x[\da-fA-F]+);)[^\s<]*;/i.test(xml)) return undefined;
    if (XMLValidator.validate(xml) !== true) return undefined;
    const parser = new XMLParser({ ignoreAttributes: true, removeNSPrefix: true, parseTagValue: false,
      ignoreDeclaration: true, ignorePiTags: true, processEntities: true, isArray: (name) => name === "url" || name === "sitemap" });
    const parsed = parser.parse(xml) as Record<string, { url?: { loc?: unknown }[]; sitemap?: { loc?: unknown }[] }>;
    const index = parsed.sitemapindex !== undefined;
    if (Object.keys(parsed).length !== 1) return undefined;
    const root = index ? parsed.sitemapindex : parsed.urlset;
    if (!root || typeof root !== "object" || Array.isArray(root)) return undefined;
    const rows = index ? root.sitemap : root.url;
    if (!Array.isArray(rows)) return { index, locations: [] };
    return { index, locations: rows.flatMap((row) => typeof row.loc === "string" ? [row.loc.trim()] : []) };
  } catch { return undefined; }
}

/** Sequential bounded discovery keeps admission independent of HTTP completion order. */
export async function discoverSitemaps(entryUrl: string, deadline: ScanDeadline, signal?: AbortSignal, includeMaps = true): Promise<SitemapDiscovery> {
  const origin = new URL(entryUrl).origin;
  const expires = performance.now() + SITEMAP_LIMITS.totalMs;
  let totalBytes = 0;
  let rateLimited = false;
  let deferUntilMs: number | undefined;
  let allows: (url: string) => boolean = () => true;
  const urls = new Map<string, string>();
  const visited = new Set<string>();
  const remaining = (): number => Math.min(expires - performance.now(), deadline.operationTimeoutMs(SITEMAP_LIMITS.totalMs));
  const read = async (initial: string, byteLimit: number): Promise<string | undefined> => {
    if (signal?.aborted || rateLimited || remaining() <= 0) return undefined;
    const controller = new AbortController();
    const abort = (): void => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(abort, Math.min(SITEMAP_LIMITS.requestMs, remaining()));
    try {
      let url = initial;
      for (let redirects = 0; redirects <= SITEMAP_LIMITS.redirects; redirects += 1) {
        if (!sameOriginUrl(url, origin) || signal?.aborted) return undefined;
        const response = await fetch(url, { redirect: "manual", signal: controller.signal,
          headers: { "User-Agent": CRAWLER_USER_AGENT, Accept: "application/xml,text/plain;q=0.9" } });
        if (response.status === 429) {
          rateLimited = true;
          const delay = retryAfterMs(response.headers.get("retry-after") ?? undefined);
          if (delay !== undefined) deferUntilMs = performance.now() + delay;
        }
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get("location");
          await response.body?.cancel();
          if (!location || redirects === SITEMAP_LIMITS.redirects) return undefined;
          url = new URL(location, url).href;
          if (!sameOriginUrl(url, origin) || !allows(url)) return undefined;
          continue;
        }
        const length = Number(response.headers.get("content-length"));
        if (!response.ok || response.headers.get("cf-mitigated") === "challenge" || length > byteLimit || length > SITEMAP_LIMITS.totalBytes - totalBytes) {
          await response.body?.cancel(); return undefined;
        }
        if (!response.body) return "";
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let bytes = 0;
        try {
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            bytes += chunk.value.byteLength;
            totalBytes += chunk.value.byteLength;
            if (bytes > byteLimit || totalBytes > SITEMAP_LIMITS.totalBytes) { await reader.cancel(); return undefined; }
            chunks.push(chunk.value);
          }
        } finally { reader.releaseLock(); }
        return Buffer.concat(chunks).toString("utf8");
      }
    } catch { return undefined; }
    finally { clearTimeout(timer); signal?.removeEventListener("abort", abort); }
    return undefined;
  };
  const robots = await read(`${origin}/robots.txt`, SITEMAP_LIMITS.robotsBytes);
  const policy = parseRobots(robots ?? "");
  allows = robotsPolicy(policy.groups);
  if (!includeMaps || signal?.aborted) return { urls: [], allows, deferUntilMs };
  let frontier = [...policy.sitemaps, `${origin}/sitemap.xml`].flatMap((raw) => {
    const url = sameOriginUrl(raw, origin); return url ? [{ url, depth: 0 }] : [];
  });
  frontier.sort((a, b) => normalizeUrlKey(a.url).localeCompare(normalizeUrlKey(b.url)));
  frontier = frontier.slice(0, SITEMAP_LIMITS.queuedDocuments);
  let documents = 0;
  while (frontier.length && documents < SITEMAP_LIMITS.documents && urls.size < SITEMAP_LIMITS.urls && totalBytes < SITEMAP_LIMITS.totalBytes && remaining() > 0 && !signal?.aborted && !rateLimited) {
    frontier.sort((a, b) => a.depth - b.depth || normalizeUrlKey(a.url).localeCompare(normalizeUrlKey(b.url)));
    const current = frontier.shift()!;
    const key = normalizeUrlKey(current.url);
    if (visited.has(key) || current.depth > SITEMAP_LIMITS.indexDepth || !allows(current.url)) continue;
    visited.add(key);
    documents += 1;
    const body = await read(current.url, SITEMAP_LIMITS.documentBytes);
    const map = body === undefined ? undefined : sitemapLocations(body);
    if (!map) continue;
    const locations = map.locations.flatMap((raw) => { const url = sameOriginUrl(raw, origin); return url && allows(url) ? [url] : []; });
    locations.sort((a, b) => normalizeUrlKey(a).localeCompare(normalizeUrlKey(b)));
    for (const url of locations) {
      if (map.index) {
        if (current.depth < SITEMAP_LIMITS.indexDepth && frontier.length < SITEMAP_LIMITS.queuedDocuments) frontier.push({ url, depth: current.depth + 1 });
      } else if (urls.size < SITEMAP_LIMITS.urls) {
        const key = normalizeUrlKey(url);
        if (!urls.has(key)) urls.set(key, url);
      }
    }
  }
  return { urls: [...urls.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, url]) => url), allows, deferUntilMs };
}
