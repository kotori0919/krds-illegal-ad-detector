/**
 * Deterministic CSS selector builder (GOAL Phase 4).
 *
 * Priority (KODEX §8): stable unique ID → stable attribute → tag + meaningful
 * class → parent-child path → nth-of-type fallback. No finding may be emitted
 * with an ambiguous selector: every built selector must match exactly one
 * element in its document.
 *
 * `buildSelectorFor` resolves a unique selector for one element in its
 * document; `countMatches` validates uniqueness; `roundTrips` validates the
 * selector resolves to exactly the intended element. Frame documents resolve
 * per-document and join with the frozen `>>>` convention in the caller.
 */
export interface SelectorCandidate {
  selector: string;
  strategy: "id" | "attribute" | "class" | "path" | "nth-of-type";
}

const STABLE_ATTRIBUTES = [
  "data-testid",
  "data-test-id",
  "data-qa",
  "data-cy",
  "name",
  "aria-label",
  "title",
  "alt",
  "href",
] as const;

function cssEscapeIdent(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
}

function uniqueIn(doc: Document, selector: string): boolean {
  try {
    return doc.querySelectorAll(selector).length === 1;
  } catch {
    return false;
  }
}

function meaningfulClasses(el: Element): string[] {
  const raw = el.getAttribute("class") ?? "";
  return raw
    .split(/\s+/)
    .filter((c) => c.length > 0)
    .filter((c) => !/^(active|open|show|hidden|collapsed|selected|focus|hover)-?/i.test(c))
    .slice(0, 2);
}

function tagOf(el: Element): string {
  return el.tagName.toLowerCase();
}

/** Single-element segment without ancestry (may be ambiguous alone). */
export function segmentFor(el: Element): string {
  const tag = tagOf(el);
  if (el.id && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(el.id)) return `#${cssEscapeIdent(el.id)}`;
  for (const attr of STABLE_ATTRIBUTES) {
    const value = el.getAttribute(attr);
    if (value && value.length > 0 && value.length < 80 && !/\s{2,}/.test(value)) {
      return `${tag}[${attr}="${value.replace(/"/g, '\\"')}"]`;
    }
  }
  const classes = meaningfulClasses(el);
  if (classes.length > 0) return `${tag}.${classes.map(cssEscapeIdent).join(".")}`;
  return tag;
}

/** Full unique selector for `el` within `doc`, or undefined when impossible. */
export function buildSelectorFor(el: Element, doc: Document = document): string | undefined {
  if (el.ownerDocument !== doc) return undefined;
  const direct = segmentFor(el);
  if (uniqueIn(doc, direct)) return direct;
  // Parent-child path, nearest scope first.
  const parts: string[] = [direct];
  let node: Element | null = el.parentElement;
  while (node && node !== doc.documentElement) {
    const seg = segmentFor(node);
    parts.unshift(seg);
    const joined = parts.join(" > ");
    if (uniqueIn(doc, joined)) return joined;
    node = node.parentElement;
    if (parts.length > 6) break;
  }
  // nth-of-type fallback on the target within its parent chain.
  let target: Element | null = el;
  const fallback: string[] = [];
  while (target && target !== doc.documentElement) {
    const parent: Element | null = target.parentElement;
    if (!parent) {
      fallback.unshift(segmentFor(target));
      break;
    }
    const tag = tagOf(target);
    const siblings = parent.children;
    const sameTag: Element[] = [];
    for (let i = 0; i < siblings.length; i += 1) {
      const s = siblings[i];
      if (s && tagOf(s) === tag) sameTag.push(s);
    }
    if (sameTag.length === 1) {
      fallback.unshift(segmentFor(target));
    } else {
      const index = sameTag.indexOf(target) + 1;
      fallback.unshift(`${segmentFor(target)}:nth-of-type(${String(index)})`);
    }
    const joined = fallback.join(" > ");
    if (uniqueIn(doc, joined)) return joined;
    target = parent;
    if (fallback.length > 8) break;
  }
  const full = fallback.join(" > ");
  return uniqueIn(doc, full) ? full : undefined;
}

/** Count matches for uniqueness validation. */
export function countMatches(doc: Document, selector: string): number {
  try {
    return doc.querySelectorAll(selector).length;
  } catch {
    return -1;
  }
}

/** Round-trip: selector resolves to exactly the intended element. */
export function roundTrips(doc: Document, el: Element, selector: string): boolean {
  try {
    const found = doc.querySelector(selector);
    return found === el;
  } catch {
    return false;
  }
}
