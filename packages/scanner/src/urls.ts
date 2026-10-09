/**
 * URL normalization + dedup policy (Contract v0 §9).
 *
 * - Fragments never identify a page.
 * - Query parameter order never identifies a page.
 * - Query parameter VALUES are preserved (different values = different pages).
 * - Trailing-slash variants of the same path merge; http/https merge only
 *   when the evaluation logic requires it (kept separate by default here and
 *   merged at comparison time).
 */
export interface NormalizedUrl {
  /** Canonical key for visited/queue dedup. */
  key: string;
  /** Same-site comparison host. */
  host: string;
  /** Depth-safe href for navigation. */
  href: string;
}

export function normalizeUrlKey(raw: string): string {
  const u = new URL(raw);
  u.hash = "";
  const params = [...u.searchParams.entries()].sort(([a, ka], [b, kb]) =>
    a < b ? -1 : a > b ? 1 : ka < kb ? -1 : ka > kb ? 1 : 0,
  );
  const query = new URLSearchParams(params).toString();
  const path = u.pathname.length > 1 ? u.pathname.replace(/\/+$/, "") : "/";
  return `${u.protocol}//${u.host}${path}${query ? `?${query}` : ""}`;
}

export function normalizeUrl(raw: string): NormalizedUrl {
  const u = new URL(raw);
  const key = normalizeUrlKey(raw);
  return { key, host: u.host, href: u.href };
}

/** Same-site gate: identical host (port-aware). Subdomains are external. */
export function isSameSite(entryHost: string, candidate: string): boolean {
  try {
    return new URL(candidate).host === entryHost;
  } catch {
    return false;
  }
}

/** Content-hash dedup: identical bodies visited via different URLs collapse. */
export function contentKey(text: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = Math.imul(h2 + c, 31);
  }
  return `${(h1 >>> 0).toString(16)}:${(h2 >>> 0).toString(16)}`;
}
