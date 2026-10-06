/**
 * Detection pipeline: DOM extraction → Unicode analysis → computed
 * CSS/geometry → two-axis decision → OfficialFinding candidates.
 *
 * Runs against a live Playwright page. For each semantic text owner, collects Unicode signals in
 * Node (homoglyph/jamo/semantic over raw text) and rendering signals in-page
 * (transparent/offscreen over computed style + geometry), then emits one
 * CandidateEvidence per (element, technique) pair that passes BOTH axes.
 */
import type { Frame, Page } from "playwright-core";
import {
  serializeFramePath,
  type CandidateEvidence,
  type DecisionEvidence,
  type IllegalAdEvidence,
  type OfficialTechnique,
  type TechniqueEvidence,
  type FindingDetail,
} from "@krds-detector/contracts";
import { homoglyphSignal } from "./homoglyph.js";
import { jamoSignal } from "./jamo.js";
import { normalizeFrameSrc } from "@krds-detector/contracts";
import { semanticGate } from "./semantic.js";
import { collectElementSignals } from "./visibility.js";
import { createSelectorEngine } from "@krds-detector/scanner";

export interface CandidateInput {
  selector: string;
  framePath: { src: string; selector: string }[];
  pageUrl: string;
}

export interface DecidedCandidate extends CandidateEvidence {
  selector: string;
  evidenceSelector?: string;
  location: string;
  url: string;
  decision: DecisionEvidence;
  observed: { selector?: string; box: { x: number; y: number; width: number; height: number }; css: {
    color: string; backgroundColor: string; opacity: string; display: string; fontSize: string; position: string;
  } };
  visual?: FindingDetail["visual"];
}

interface PageTextElement {
  selector: string;
  text: string;
  analysisText: string;
  styleSelectors: string[];
  href?: string;
}

/** Browser-side ownership; independent block text never contributes to its parent's decision. */
function extractTextOwners(selectors: ReturnType<typeof createSelectorEngine>): PageTextElement[] {
  const owners = new Map<Element, { text: string[]; styled: Set<Element> }>();
  const semantic = /^(a|button|label|p|li|dt|dd|h[1-6]|td|th|caption|legend|option|summary|pre|div|section|article|main|nav|aside|header|footer|figure|figcaption|address|blockquote|form|fieldset|details|dialog)$/i;
  const walker = document.createTreeWalker(document.body ?? document.documentElement, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (!parent || parent.closest("script,style,noscript,template,head")) continue;
    let owner: Element = parent;
    for (let ancestor: Element | null = parent; ancestor; ancestor = ancestor.parentElement) {
      owner = ancestor;
      if (semantic.test(ancestor.localName)) break;
      if (ancestor === document.body || ancestor === document.documentElement) { owner = parent; break; }
      const display = getComputedStyle(ancestor).display;
      if (display !== "none" && display !== "contents" && !display.startsWith("inline")) break;
    }
    let group = owners.get(owner);
    if (!group) { group = { text: [], styled: new Set() }; owners.set(owner, group); }
    group.text.push(node.textContent ?? "");
    if (node.textContent?.trim()) group.styled.add(parent);
  }
  const out: PageTextElement[] = [];
  for (const [semanticOwner, group] of owners) {
    const analysisText = group.text.join("");
    if (!analysisText.trim()) continue;
    // A wrapper around one complete text leaf adds no composition. Preserve
    // that leaf's identity, while links and controls retain their semantics.
    const onlyTextParent = group.styled.size === 1 ? group.styled.values().next().value : undefined;
    const owner = onlyTextParent && !/^(a|button|label)$/i.test(semanticOwner.localName)
      && onlyTextParent.textContent === semanticOwner.textContent ? onlyTextParent : semanticOwner;
    const selector = selectors.buildSelectorFor(owner, document);
    if (!selector || !selectors.roundTrips(document, owner, selector)) continue;
    const styleSelectors = [selector];
    for (const styled of group.styled) {
      if (styled === owner) continue;
      const styledSelector = selectors.buildSelectorFor(styled, document);
      if (styledSelector && selectors.roundTrips(document, styled, styledSelector)) styleSelectors.push(styledSelector);
    }
    const link = owner.closest("a[href]") as HTMLAnchorElement | null;
    out.push({ selector, text: owner.textContent ?? "", analysisText, styleSelectors, ...(link?.href ? { href: link.href } : {}) });
  }
  return out;
}

/** Compose trusted source only; page text and attributes never enter JavaScript source. */
async function extractTextElements(page: Page | Frame): Promise<PageTextElement[]> {
  return page.evaluate(`(${extractTextOwners.toString()})(${createSelectorEngine.toString()}())`);
}

function decide(rule: string, score: number, threshold: number, detail: string): DecisionEvidence {
  return { rule, score, threshold, passed: score >= threshold, detail };
}

export async function detectPageCandidates(
  page: Page | Frame,
  input: {
    pageUrl: string;
    framePath?: { src: string; selector: string }[];
    baseUrl?: string;
    onElementsAnalyzed?: (count: number) => void;
    onAdText?: (source: { url: string; location: string; evidenceText: string; analysisText: string }) => void;
  },
): Promise<DecidedCandidate[]> {
  const framePath = (input.framePath ?? []).map((s) => ({
    src: input.baseUrl ? normalizeFrameSrc(s.src, input.baseUrl) : s.src,
    selector: s.selector,
  }));
  const elements = await extractTextElements(page);
  input.onElementsAnalyzed?.(elements.length);
  const payload = elements.flatMap((e) => e.styleSelectors.map((selector) => ({ selector, rawText: e.text, href: e.href })));
  const signals = await page.evaluate(collectElementSignals, payload);
  const bySelector = new Map(signals.map((signal) => [signal.selector, signal]));
  const out: DecidedCandidate[] = [];

  for (const el of elements) {
    const signal = bySelector.get(el.selector);
    if (!signal) continue;
    const rawText = signal.rawText;
    if (rawText.trim().length === 0) continue;
    const gate = semanticGate(el.analysisText, signal.href ?? el.href);
    const location = serializeFramePath({ framePath, selector: signal.selector });
    if (input.onAdText) {
      // Additional zero-width analysis has its own match-only form. Keep
      // official technique decisions and source evidence unchanged.
      const auxiliaryText = el.analysisText.replace(/[\u200B-\u200D\uFEFF]/g, "");
      if (gate.passed || (auxiliaryText !== el.analysisText && semanticGate(auxiliaryText, signal.href ?? el.href).passed)) {
        input.onAdText({ url: input.pageUrl, location, evidenceText: rawText, analysisText: el.analysisText });
      }
    }
    if (!gate.passed) continue;
    const illegalAd: IllegalAdEvidence = {
      rawText,
      normalizedText: gate.normalizedText,
      matchedTerms: gate.matchedTerms,
      destinationUrl: gate.destinationUrl,
      detail: gate.detail,
    };
    const techniques: TechniqueEvidence[] = [];
    const hg = homoglyphSignal(el.analysisText);
    if (hg) techniques.push({ ...hg, rawText });
    const jm = jamoSignal(el.analysisText);
    if (jm) techniques.push({ ...jm, rawText });
    const ownedSignals = el.styleSelectors.map((selector) => bySelector.get(selector)).filter((value) => value !== undefined);
    const transparentSignal = ownedSignals.find((value) => value.transparent);
    const offscreenSignal = ownedSignals.find((value) => value.offscreen);
    if (transparentSignal) {
      techniques.push({
        kind: "transparent-signal",
        technique: "TRANSPARENT",
        rawText,
        detail: transparentSignal.transparentDetail,
      });
    }
    if (offscreenSignal) {
      techniques.push({
        kind: "offscreen-signal",
        technique: "OFFSCREEN",
        rawText,
        detail: `${offscreenSignal.offscreenDetail} box=${String(Math.round(offscreenSignal.box.x))},${String(Math.round(offscreenSignal.box.y))},${String(Math.round(offscreenSignal.box.width))}x${String(Math.round(offscreenSignal.box.height))}`,
      });
    }
    for (const technique of techniques) {
      const decision = decide("two-axis: semantic AND technique", 1, 1, `${gate.detail} + ${technique.detail}`);
      if (!decision.passed) continue;
      const t: OfficialTechnique = technique.technique;
      void t;
      const observed = technique.technique === "TRANSPARENT" ? transparentSignal! : technique.technique === "OFFSCREEN" ? offscreenSignal! : signal;
      out.push({
        technique,
        illegalAd,
        selector: signal.selector,
        ...(observed.selector !== signal.selector ? { evidenceSelector: observed.selector } : {}),
        location,
        url: input.pageUrl,
        decision,
        observed: { selector: observed.selector, box: observed.box, css: observed.css },
      });
    }
  }
  return out;
}
