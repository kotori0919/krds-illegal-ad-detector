/**
 * TRANSPARENT + OFFSCREEN detectors over live computed style + geometry.
 *
 * These run in the page (Playwright evaluate) where getComputedStyle and
 * getBoundingClientRect are available — never CSS-string matching from Node.
 * Each returns per-element signals with the raw text preserved; the two-axis
 * gate (semantic AND technique) applies in the caller.
 *
 * TRANSPARENT (§5): color:transparent, zero alpha, opacity 0 (self or
 * ancestor chain), fg/bg equivalence. Content relevance: signals attach to
 * the text element itself.
 *
 * OFFSCREEN (§6): display:none, 0–1px font, large negative position,
 * zero-size box, offscreen transform, clip/overflow concealment. Judged from
 * actual boxes + computed values, not class names.
 */

export interface ElementSignalInput {
  selector: string;
  rawText: string;
  href?: string;
}

export interface ElementSignal {
  selector: string;
  rawText: string;
  href?: string;
  transparent: boolean;
  transparentDetail: string;
  offscreen: boolean;
  offscreenDetail: string;
  box: { x: number; y: number; width: number; height: number };
}

/** Page-side collector: serializable, runs via page.evaluate. Paste-safe. */
export function collectElementSignals(inputs: ElementSignalInput[]): ElementSignal[] {
  const out: ElementSignal[] = [];
  for (const input of inputs) {
    const el = document.querySelector(input.selector) as HTMLElement | undefined;
    if (!el) continue;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();

    // --- TRANSPARENT ---
    let transparent = false;
    const transparentReasons: string[] = [];
    if (style.color === "rgba(0, 0, 0, 0)" || style.color === "transparent") {
      transparent = true;
      transparentReasons.push(`color=${style.color}`);
    }
    const opacity = Number.parseFloat(style.opacity);
    if (Number.isFinite(opacity) && opacity === 0) {
      transparent = true;
      transparentReasons.push("opacity:0");
    }
    let ancestor = el.parentElement;
    let depth = 0;
    while (ancestor && depth < 8) {
      const aOpacity = Number.parseFloat(getComputedStyle(ancestor).opacity);
      if (Number.isFinite(aOpacity) && aOpacity === 0) {
        transparent = true;
        transparentReasons.push("ancestor opacity:0");
        break;
      }
      ancestor = ancestor.parentElement;
      depth += 1;
    }
    const fg = style.color;
    const bg = style.backgroundColor;
    if (fg && bg && fg === bg && fg !== "rgba(0, 0, 0, 0)") {
      transparent = true;
      transparentReasons.push(`fg==bg ${fg}`);
    }

    // --- OFFSCREEN ---
    let offscreen = false;
    const offscreenReasons: string[] = [];
    if (style.display === "none") {
      offscreen = true;
      offscreenReasons.push("display:none");
    }
    const fontSize = Number.parseFloat(style.fontSize);
    if (Number.isFinite(fontSize) && fontSize <= 1) {
      offscreen = true;
      offscreenReasons.push(`font-size:${style.fontSize}`);
    }
    if (rect.width === 0 && rect.height === 0 && input.rawText.trim().length > 0) {
      offscreen = true;
      offscreenReasons.push("zero-size box with text");
    }
    if (rect.x + rect.width < 0 || rect.y + rect.height < 0) {
      offscreen = true;
      offscreenReasons.push(`negative box x=${String(Math.round(rect.x))} y=${String(Math.round(rect.y))}`);
    }
    const transform = style.transform;
    if (transform && transform !== "none") {
      const m = transform.match(/matrix\(([^)]+)\)/);
      if (m?.[1]) {
        const parts = m[1].split(",").map((s) => Number.parseFloat(s.trim()));
        const tx = parts[4] ?? 0;
        const ty = parts[5] ?? 0;
        if (tx < -2000 || ty < -2000 || tx > 10000 || ty > 10000) {
          offscreen = true;
          offscreenReasons.push(`transform translate ${String(tx)},${String(ty)}`);
        }
      }
    }
    if (style.clipPath && style.clipPath !== "none" && rect.width > 0) {
      const inset = style.clipPath.match(/inset\(\s*0/);
      if (inset && rect.width <= 2 && rect.height <= 2) {
        offscreen = true;
        offscreenReasons.push(`clip-path ${style.clipPath}`);
      }
    }
    if (
      (style.overflow === "hidden" || style.overflowX === "hidden") &&
      rect.width <= 1 &&
      rect.height <= 1 &&
      input.rawText.trim().length > 0
    ) {
      offscreen = true;
      offscreenReasons.push("overflow-hidden micro box with text");
    }

    out.push({
      selector: input.selector,
      rawText: el.textContent ?? input.rawText,
      href: input.href ?? (el instanceof HTMLAnchorElement ? el.href : undefined),
      transparent,
      transparentDetail: transparentReasons.join("; ") || "visible rendering",
      offscreen,
      offscreenDetail: offscreenReasons.join("; ") || "in-flow geometry",
      box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    });
  }
  return out;
}
