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

export interface FrameVisibilityContext {
  transparent: boolean;
  offscreen: boolean;
  transparentDetail: string;
  offscreenDetail: string;
  unsupported?: string[];
}

export interface RenderingObservationLimits { textNodes: number; textRectangles: number; ancestors: number; tinyClippedExtentCssPx: number }

export interface ElementSignal {
  selector: string;
  rawText: string;
  href?: string;
  transparent: boolean;
  transparentDetail: string;
  offscreen: boolean;
  offscreenDetail: string;
  collapsedNavigation: boolean;
  /** Unsupported observations are uncertainty, never proof of concealment. */
  renderingIssues?: string[];
  box: { x: number; y: number; width: number; height: number };
  css: { color: string; backgroundColor: string; opacity: string; display: string; fontSize: string; position: string };
}

/** Page-side collector: serializable, runs via page.evaluate. Paste-safe. */
export function collectElementSignals(payload: { inputs: ElementSignalInput[]; frameVisibility?: FrameVisibilityContext; limits: RenderingObservationLimits }): ElementSignal[] {
  const { inputs, frameVisibility: frame, limits } = payload;
  const out: ElementSignal[] = [];
  const navigationLinks = new Map<HTMLAnchorElement, { navigation: Element; signals: ElementSignal[]; visible: boolean }>();
  type Color = { r: number; g: number; b: number; a: number };
  const color = (value: string): Color | undefined => {
    if (value === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
    const match = value.match(/^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:\s*[,/]\s*([\d.]+)(%)?)?\s*\)$/);
    if (!match) return undefined;
    return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]), a: match[4] === undefined ? 1 : Number(match[4]) / (match[5] ? 100 : 1) };
  };
  type Box = { x: number; y: number; width: number; height: number };
  const intersect = (a: Box, b: Box): Box => ({ x: Math.max(a.x, b.x), y: Math.max(a.y, b.y),
    width: Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)),
    height: Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)) });
  for (const input of inputs) {
    const el = document.querySelector(input.selector) as HTMLElement | undefined;
    if (!el) continue;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();

    const transparentReasons: string[] = frame?.transparent ? [`frame ancestor: ${frame.transparentDetail}`] : [];
    const offscreenReasons: string[] = frame?.offscreen ? [`frame ancestor: ${frame.offscreenDetail}`] : [];
    const renderingIssues = [...(frame?.unsupported ?? [])];
    const paint = style.getPropertyValue("-webkit-text-fill-color") || style.color;
    const foreground = color(paint);
    const additionalTextPaint = style.textShadow !== "none" || Number.parseFloat(style.getPropertyValue("-webkit-text-stroke-width")) > 0;
    if (foreground?.a === 0 && !additionalTextPaint) transparentReasons.push(`text alpha:0 (${paint})`);
    if (additionalTextPaint) renderingIssues.push("unsupported text shadow or stroke");
    if (!foreground) renderingIssues.push("unsupported text color");

    // Ranges measure rendered glyph runs, including display:contents. Do not
    // confuse an empty container box with absent text. Bound traversal/rects.
    const textRects: Box[] = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let textNodes = 0;
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      if (++textNodes > limits.textNodes || textRects.length >= limits.textRectangles) { renderingIssues.push("text geometry limit"); break; }
      if (!text.textContent?.trim()) continue;
      const range = document.createRange(); range.selectNodeContents(text);
      const rects = range.getClientRects();
      for (let index = 0; index < rects.length && textRects.length < limits.textRectangles; index += 1) {
        const value = rects[index]!;
        if (value.width > 0 && value.height > 0) textRects.push({ x: value.x, y: value.y, width: value.width, height: value.height });
      }
      range.detach();
    }
    let visibleRects = textRects.map((value) => ({ ...value }));
    let background: Color = { r: 0, g: 0, b: 0, a: 0 };
    let backgroundKnown = true;
    let depth = 0;
    let cursor: HTMLElement | null = el;
    for (; cursor && depth < limits.ancestors; cursor = cursor.parentElement, depth += 1) {
      const current = getComputedStyle(cursor);
      if (Number.parseFloat(current.opacity) === 0) transparentReasons.push(depth === 0 ? "opacity:0" : "ancestor opacity:0");
      if (current.display === "none") offscreenReasons.push(depth === 0 ? "display:none" : "ancestor display:none");
      // Visibility inherits but may be overridden by a visible descendant;
      // the text owner's computed value already reflects that inheritance.
      if (depth === 0 && (current.visibility === "hidden" || current.visibility === "collapse")) offscreenReasons.push(`visibility:${current.visibility}`);
      if (background.a < 1) {
        if (current.backgroundImage !== "none" || current.mixBlendMode !== "normal" || current.filter !== "none") backgroundKnown = false;
        const layer = color(current.backgroundColor);
        if (!layer) backgroundKnown = false;
        else {
          const alpha = background.a + layer.a * (1 - background.a);
          if (alpha > 0) background = { r: (background.r * background.a + layer.r * layer.a * (1 - background.a)) / alpha,
            g: (background.g * background.a + layer.g * layer.a * (1 - background.a)) / alpha,
            b: (background.b * background.a + layer.b * layer.a * (1 - background.a)) / alpha, a: alpha };
        }
      }
      const box = cursor.getBoundingClientRect();
      const clipX = /^(hidden|clip|scroll|auto)$/.test(current.overflowX);
      const clipY = /^(hidden|clip|scroll|auto)$/.test(current.overflowY);
      if ((clipX || clipY) && current.display !== "contents" && cursor !== document.body && cursor !== document.documentElement) {
        const clip = { x: clipX ? box.x + cursor.clientLeft : -1e12, y: clipY ? box.y + cursor.clientTop : -1e12,
          width: clipX ? cursor.clientWidth : 2e12, height: clipY ? cursor.clientHeight : 2e12 };
        visibleRects = visibleRects.map((value) => intersect(value, clip));
      }
      if (current.clipPath !== "none") {
        const inset = current.clipPath.match(/^inset\(([^()]+)\)$/);
        if (inset) {
          const tokens = inset[1]!.split(/\s+round\s+/)[0]!.trim().split(/\s+/);
          if (tokens.length >= 1 && tokens.length <= 4 && tokens.every((value) => /^-?[\d.]+(?:px|%)?$/.test(value))) {
            const values = [tokens[0]!, tokens[1] ?? tokens[0]!, tokens[2] ?? tokens[0]!, tokens[3] ?? tokens[1] ?? tokens[0]!];
            const lengths = values.map((value, index) => Number.parseFloat(value) * (value.endsWith("%") ? (index % 2 ? box.width : box.height) / 100 : 1));
            const clip = { x: box.x + lengths[3]!, y: box.y + lengths[0]!, width: Math.max(0, box.width - lengths[1]! - lengths[3]!), height: Math.max(0, box.height - lengths[0]! - lengths[2]!) };
            visibleRects = visibleRects.map((value) => intersect(value, clip));
          } else renderingIssues.push("unsupported inset clip");
        } else renderingIssues.push("unsupported clip-path");
      }
    }
    if (cursor) renderingIssues.push("ancestor observation limit");
    // The default canvas is white; a non-solid background invalidates this
    // inference. Composited foreground equivalence is exact, not a contrast score.
    if (background.a < 1) background = { r: background.r * background.a + 255 * (1 - background.a), g: background.g * background.a + 255 * (1 - background.a), b: background.b * background.a + 255 * (1 - background.a), a: 1 };
    if (backgroundKnown && !additionalTextPaint && foreground && foreground.a > 0 && (["r", "g", "b"] as const).every((channel) => Math.abs(foreground[channel] - background[channel]) < 0.5)) transparentReasons.push("text matches composited solid background");
    if (!backgroundKnown) renderingIssues.push("non-solid background or compositing");
    const fontSize = Number.parseFloat(style.fontSize);
    if (Number.isFinite(fontSize) && fontSize <= 1) offscreenReasons.push(`font-size:${style.fontSize}`);
    if (textRects.length === 0 && input.rawText.trim() && !renderingIssues.includes("text geometry limit")) offscreenReasons.push("no rendered text ranges");
    if (textRects.length > 0 && visibleRects.every((value) => value.width <= 0 || value.height <= 0)) offscreenReasons.push("text ranges fully clipped");
    const extent = limits.tinyClippedExtentCssPx;
    // A positive Range intersection can cover only a sliver of a glyph run.
    // Its font-dependent top inset must not turn a 2x2 clipping window into
    // readable text. Require observed reduction, never the container size.
    if (textRects.some(value => value.width > extent && value.height > extent)
      && visibleRects.some(value => value.width > 0 && value.height > 0)
      && visibleRects.every(value => value.width <= extent && value.height <= extent)) {
      const width = Math.max(...visibleRects.map(value => value.width));
      const height = Math.max(...visibleRects.map(value => value.height));
      const sourceWidth = Math.max(...textRects.map(value => value.width));
      const sourceHeight = Math.max(...textRects.map(value => value.height));
      offscreenReasons.push(`text ranges clipped to at most ${width}x${height} CSS px from ${sourceWidth}x${sourceHeight} glyph ranges (limit ${extent})`);
    }
    if (textRects.length > 0 && textRects.every((value) => value.x + value.width <= 0 || value.y + value.height <= 0)) offscreenReasons.push("text ranges above or left of document");
    const transparent = transparentReasons.length > 0;
    const offscreen = offscreenReasons.length > 0;

    const signal: ElementSignal = {
      selector: input.selector,
      rawText: el.textContent ?? input.rawText,
      href: input.href ?? (el instanceof HTMLAnchorElement ? el.href : undefined),
      transparent,
      transparentDetail: transparentReasons.join("; ") || "visible rendering",
      offscreen,
      offscreenDetail: offscreenReasons.join("; ") || "in-flow geometry",
      collapsedNavigation: false,
      ...(renderingIssues.length ? { renderingIssues: [...new Set(renderingIssues)] } : {}),
      box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      css: { color: style.color, backgroundColor: style.backgroundColor, opacity: style.opacity,
        display: style.display, fontSize: style.fontSize, position: style.position },
    };
    out.push(signal);
    const link = el.closest("a[href]") as HTMLAnchorElement | null;
    const navigation = link?.closest('nav,[role="navigation"]');
    if (link && navigation) {
      const context = navigationLinks.get(link) ?? { navigation, signals: [], visible: true };
      context.visible &&= !offscreen && !transparent && rect.width > 0 && rect.height > 0 && style.visibility === "visible";
      context.signals.push(signal); navigationLinks.set(link, context);
    }
  }

  // Visible counterparts reuse the computed concealment signals. IDs, class
  // names, domains and category words are never exclusion rules.
  const visibleLinks = new Map<Element, Set<string>>();
  const controlledPanels = new Map<Element, Set<Element>>();
  const hiddenPanels = new WeakMap<Element, boolean>();
  const keyOf = (link: HTMLAnchorElement) => `${link.href}\0${(link.textContent ?? "").replace(/\s+/g, " ").trim()}`;
  for (const [link, context] of navigationLinks) {
    if (!context.visible) continue;
    const keys = visibleLinks.get(context.navigation) ?? new Set<string>();
    keys.add(keyOf(link)); visibleLinks.set(context.navigation, keys);
  }
  for (const [link, context] of navigationLinks) {
    if (!context.signals.some((signal) => signal.offscreen)) continue;
    let legitimate = visibleLinks.get(context.navigation)?.has(keyOf(link)) ?? false;
    if (!legitimate) {
      let panels = controlledPanels.get(context.navigation);
      if (!panels) {
        panels = new Set<Element>();
        const controls = context.navigation.querySelectorAll('[aria-controls][aria-expanded="false"]');
        for (let index = 0; index < controls.length; index++) {
          const control = controls[index]!;
          if (!control.matches('button,a[href],[role="button"]') || control.matches(":disabled") || control.getAttribute("aria-disabled") === "true") continue;
          for (const id of (control.getAttribute("aria-controls") ?? "").split(/\s+/)) {
            const panel = id ? document.getElementById(id) : null;
            if (panel && context.navigation.contains(panel)) panels.add(panel);
          }
        }
        controlledPanels.set(context.navigation, panels);
      }
      for (let panel: Element | null = link; panel && panel !== context.navigation; panel = panel.parentElement) {
        if (panels.has(panel)) {
          let hidden = hiddenPanels.get(panel);
          if (hidden === undefined) {
            hidden = panel.hasAttribute("hidden") || getComputedStyle(panel).display === "none";
            hiddenPanels.set(panel, hidden);
          }
          if (hidden) { legitimate = true; break; }
        }
      }
    }
    if (legitimate) for (const signal of context.signals) signal.collapsedNavigation = true;
  }
  return out;
}
