/** Unique, deterministic selectors shared by live text extraction and scanners. */
export interface SelectorCandidate {
  selector: string;
  strategy: "id" | "attribute" | "class" | "path" | "nth-of-type";
}

/** Self-contained factory: callers may serialize this trusted function into a browser context. */
export function createSelectorEngine() {
  const attributes = ["data-testid", "data-test-id", "data-qa", "data-cy", "name", "aria-label", "title", "alt", "href"];
  function escapeIdent(value: string): string {
    let escaped = "";
    for (let index = 0; index < value.length; index += 1) {
      const code = value.charCodeAt(index);
      const char = value[index]!;
      if (code === 0) escaped += "\uFFFD";
      else if (code <= 31 || code === 127 || (index === 0 && code >= 48 && code <= 57) || (index === 1 && code >= 48 && code <= 57 && value[0] === "-")) escaped += "\\" + code.toString(16) + " ";
      else if (index === 0 && char === "-" && value.length === 1) escaped += "\\-";
      else if (code >= 128 || /[a-zA-Z0-9_-]/.test(char)) escaped += char;
      else escaped += "\\" + char;
    }
    return escaped;
  }
  function escapeString(value: string): string {
    let escaped = "";
    for (let index = 0; index < value.length; index += 1) {
      const code = value.charCodeAt(index);
      const char = value[index]!;
      if (code === 0) escaped += "\uFFFD";
      else if (char === '"' || char === "\\") escaped += "\\" + char;
      else if (code <= 31 || code === 127) escaped += "\\" + code.toString(16) + " ";
      else escaped += char;
    }
    return escaped;
  }
  function candidatesFor(el: Element): string[] {
    const tag = escapeIdent(el.localName);
    const candidates: string[] = [];
    if (el.id) candidates.push("#" + escapeIdent(el.id));
    for (const attribute of attributes) {
      const value = el.getAttribute(attribute);
      if (value) candidates.push(tag + "[" + attribute + '="' + escapeString(value) + '"]');
    }
    const classes = Array.from(el.classList).filter((value) => !/^(active|open|show|hidden|collapsed|selected|focus|hover)(?:-|$)/i.test(value)).slice(0, 2);
    if (classes.length) candidates.push(tag + "." + classes.map(escapeIdent).join("."));
    candidates.push(tag);
    return candidates;
  }
  function segmentFor(el: Element): string {
    return candidatesFor(el)[0]!;
  }
  function countMatches(doc: Document, selector: string): number {
    try { return doc.querySelectorAll(selector).length; } catch { return -1; }
  }
  function roundTrips(doc: Document, el: Element, selector: string): boolean {
    try {
      const matches = doc.querySelectorAll(selector);
      return matches.length === 1 && matches[0] === el;
    } catch { return false; }
  }
  function buildSelectorFor(el: Element, doc: Document = el.ownerDocument): string | undefined {
    if (el.ownerDocument !== doc || !el.isConnected) return undefined;
    for (const candidate of candidatesFor(el)) {
      if (roundTrips(doc, el, candidate)) return candidate;
    }
    const parts = [segmentFor(el)];
    for (let parent = el.parentElement; parent; parent = parent.parentElement) {
      parts.unshift(segmentFor(parent));
      const selector = parts.join(" > ");
      if (roundTrips(doc, el, selector)) return selector;
    }
    // Walk to the actual root: repeated ancestry can require more than eight levels.
    const fallback: string[] = [];
    for (let target: Element | null = el; target; target = target.parentElement) {
      const tag = escapeIdent(target.localName);
      let index = 1;
      for (let sibling = target.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
        if (sibling.localName === target.localName) index += 1;
      }
      fallback.unshift(tag + ":nth-of-type(" + index + ")");
      const selector = fallback.join(" > ");
      if (roundTrips(doc, el, selector)) return selector;
    }
    return undefined;
  }
  return { segmentFor, buildSelectorFor, countMatches, roundTrips };
}

export const { segmentFor, buildSelectorFor, countMatches, roundTrips } = createSelectorEngine();
