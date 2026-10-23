/** Frame-owner observations are deliberately distinct from child text style.
 * Serialized trusted function, with bounded ancestor traversal.
 */
export function observeFrameOwner(el: Element, limits: { ancestors: number; tinyClippedExtentCssPx: number }): { transparent: boolean; offscreen: boolean; transparentDetail: string; offscreenDetail: string; unsupported: string[] } {
  const transparent: string[] = [];
  const offscreen: string[] = [];
  const unsupported: string[] = [];
  const owner = el.getBoundingClientRect();
  let left = owner.left; let right = owner.right; let top = owner.top; let bottom = owner.bottom;
  if (owner.width <= 0 || owner.height <= 0) offscreen.push("zero-size frame owner");
  if (owner.right <= 0 || owner.bottom <= 0) offscreen.push("frame owner above or left of document");
  let cursor: Element | null = el;
  let depth = 0;
  for (; cursor && depth < limits.ancestors; cursor = cursor.parentElement, depth += 1) {
    const style = getComputedStyle(cursor);
    if (Number.parseFloat(style.opacity) === 0) transparent.push("frame owner/ancestor opacity:0");
    if (style.display === "none" || (depth === 0 && (style.visibility === "hidden" || style.visibility === "collapse"))) offscreen.push(`frame owner/ancestor ${style.display}/${style.visibility}`);
    const box = cursor.getBoundingClientRect();
    if (cursor instanceof HTMLElement && cursor !== document.body && cursor !== document.documentElement && style.display !== "contents") {
      if (/^(hidden|clip|auto|scroll)$/.test(style.overflowX)) { left = Math.max(left, box.left + cursor.clientLeft); right = Math.min(right, box.left + cursor.clientLeft + cursor.clientWidth); }
      if (/^(hidden|clip|auto|scroll)$/.test(style.overflowY)) { top = Math.max(top, box.top + cursor.clientTop); bottom = Math.min(bottom, box.top + cursor.clientTop + cursor.clientHeight); }
    }
    if (style.clipPath !== "none") {
      const match = style.clipPath.match(/^inset\(([^()]+)\)$/);
      const tokens = match?.[1]?.split(/\s+round\s+/)[0]?.trim().split(/\s+/);
      if (tokens && tokens.length >= 1 && tokens.length <= 4 && tokens.every((value) => /^-?[\d.]+(?:px|%)?$/.test(value))) {
        const values = [tokens[0]!, tokens[1] ?? tokens[0]!, tokens[2] ?? tokens[0]!, tokens[3] ?? tokens[1] ?? tokens[0]!];
        const lengths = values.map((value, index) => Number.parseFloat(value) * (value.endsWith("%") ? (index % 2 ? box.width : box.height) / 100 : 1));
        left = Math.max(left, box.left + lengths[3]!); right = Math.min(right, box.right - lengths[1]!);
        top = Math.max(top, box.top + lengths[0]!); bottom = Math.min(bottom, box.bottom - lengths[2]!);
      } else unsupported.push("unsupported frame clip-path");
    }
  }
  if (cursor) unsupported.push("frame ancestor observation limit");
  if (right <= left || bottom <= top) offscreen.push("frame owner fully clipped");
  const width = right - left; const height = bottom - top; const extent = limits.tinyClippedExtentCssPx;
  if (owner.width > extent && owner.height > extent && width > 0 && height > 0 && width <= extent && height <= extent) {
    offscreen.push(`frame owner clipped from ${owner.width}x${owner.height} to ${width}x${height} CSS px (limit ${extent})`);
  }
  return { transparent: transparent.length > 0, offscreen: offscreen.length > 0,
    transparentDetail: [...new Set(transparent)].join("; "), offscreenDetail: [...new Set(offscreen)].join("; "), unsupported };
}

/** Bounded optional replay snapshot. Never builds full outerHTML/page.content.
 * UTF-8 byte count, node/depth/attribute bounds apply before appending.
 * This is a partial DOM snapshot, not a byte-identical HTTP response.
 */
export function collectBoundedHtml(input: { maxBytes: number; limits: { snapshotNodes: number; maxDomDepth: number; maxAttributes: number; maxAttributeCodeUnits: number } }): { html: string; bytes: number; truncated: boolean } {
  const { maxBytes, limits } = input;
  const encoder = new TextEncoder();
  const chunks: string[] = [];
  let bytes = 0; let nodes = 0; let truncated = false;
  const append = (value: string): boolean => {
    const cost = encoder.encode(value).byteLength;
    if (bytes + cost > maxBytes) { truncated = true; return false; }
    chunks.push(value); bytes += cost; return true;
  };
  const escape = (value: string): string => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
  const visit = (node: Node, depth: number): boolean => {
    if (++nodes > limits.snapshotNodes || depth > limits.maxDomDepth) { truncated = true; return false; }
    if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.COMMENT_NODE) {
      const raw = node.nodeValue ?? "";
      // Reading the DOM string is unavoidable; copying/escaping it is bounded.
      const cap = Math.max(0, Math.floor((maxBytes - bytes) / 6));
      const text = escape(raw.slice(0, cap));
      if (raw.length > cap) truncated = true;
      return append(node.nodeType === Node.COMMENT_NODE ? `<!--${text.replace(/--/g, "- -")}-->` : text) && !truncated;
    }
    if (!(node instanceof Element)) return true;
    const name = node.localName;
    if (!append(`<${name}`)) return false;
    for (let index = 0; index < node.attributes.length; index += 1) {
      if (index >= limits.maxAttributes) { truncated = true; break; }
      const attribute = node.attributes[index]!;
      if (attribute.value.length > limits.maxAttributeCodeUnits) truncated = true;
      if (!append(` ${attribute.name}="${escape(attribute.value.slice(0, limits.maxAttributeCodeUnits))}"`)) return false;
    }
    if (!append(">")) return false;
    for (let child = node.firstChild; child; child = child.nextSibling) if (!visit(child, depth + 1)) return false;
    return voidTags.has(name) || append(`</${name}>`);
  };
  visit(document.documentElement, 0);
  return { html: chunks.join(""), bytes, truncated };
}
