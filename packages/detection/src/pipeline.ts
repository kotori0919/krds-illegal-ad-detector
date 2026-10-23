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
  SCAN_POLICY,
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
import { collectElementSignals, type FrameVisibilityContext } from "./visibility.js";
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
  observed: { selector?: string; renderingIssues?: string[]; box: { x: number; y: number; width: number; height: number }; css: {
    color: string; backgroundColor: string; opacity: string; display: string; fontSize: string; position: string;
  } };
  visual?: FindingDetail["visual"];
  textPolicy?: FindingDetail["textPolicy"];
}

interface PageTextElement {
  selector: string;
  text: string;
  analysisText: string;
  styleSelectors: string[];
  sourceMapping: { analysisStart: number; sourceStart: number; length: number }[];
  href?: string;
}

interface TextCollection { elements: PageTextElement[]; limitsReached: string[] }

/** Browser-side ownership; independent block text never contributes to its parent's decision. */
function extractTextOwners(selectors: ReturnType<typeof createSelectorEngine>): TextCollection {
  // Limits apply during walking/copying, never after an unbounded DOM snapshot.
  const limits = new Set<string>();
  const maxNodes = 10000; const maxOwners = 1000; const maxText = 32768;
  const maxTotalText = 1048576; const maxStyles = 32;
  let visited = 0; let collectedText = 0; let sourceNodes = 0; let sourceText = 0;
  const owners = new Map<Element, { nodes: Node[]; styled: Set<Element>; length: number }>();
  const excludedOwners = new Set<Element>();
  const semantic = /^(a|button|label|p|li|dt|dd|h[1-6]|td|th|caption|legend|option|summary|pre|div|section|article|main|nav|aside|header|footer|figure|figcaption|address|blockquote|form|fieldset|details|dialog)$/i;
  const walker = document.createTreeWalker(document.body ?? document.documentElement, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (++visited > maxNodes) { limits.add("text-node-limit"); break; }
    const text = node.textContent ?? "";
    if (!text.trim()) continue;
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
    if (excludedOwners.has(owner)) continue;
    let group = owners.get(owner);
    if (!group) {
      if (owners.size >= maxOwners) { limits.add("text-owner-limit"); break; }
      group = { nodes: [], styled: new Set(), length: 0 }; owners.set(owner, group);
    }
    if (group.length + text.length > maxText) { limits.add("owner-text-limit"); owners.delete(owner); excludedOwners.add(owner); continue; }
    if (collectedText + text.length > maxTotalText) { limits.add("total-text-limit"); break; }
    group.nodes.push(node); group.length += text.length; collectedText += text.length;
    if (group.styled.size < maxStyles) group.styled.add(parent);
    else if (!group.styled.has(parent)) limits.add("text-style-limit");
  }
  const out: PageTextElement[] = [];
  for (const [semanticOwner, group] of owners) {
    const analysisText = group.nodes.map((node) => node.textContent ?? "").join("");
    const ownedNodes = new Set(group.nodes);
    const sourceChunks: string[] = [];
    const sourceMapping: PageTextElement["sourceMapping"] = [];
    let ownerSourceLength = 0; let analysisOffset = 0; let complete = true;
    const sourceWalker = document.createTreeWalker(semanticOwner, NodeFilter.SHOW_TEXT);
    for (let node = sourceWalker.nextNode(); node; node = sourceWalker.nextNode()) {
      if (++sourceNodes > maxNodes) { limits.add("source-node-limit"); complete = false; break; }
      const text = node.textContent ?? "";
      if (ownerSourceLength + text.length > maxText || sourceText + text.length > maxTotalText) {
        limits.add("source-text-limit"); complete = false; break;
      }
      if (ownedNodes.has(node)) {
        sourceMapping.push({ analysisStart: analysisOffset, sourceStart: ownerSourceLength, length: text.length });
        analysisOffset += text.length;
      }
      sourceChunks.push(text); ownerSourceLength += text.length; sourceText += text.length;
    }
    // An incomplete source cannot be represented as the original textContent.
    if (!complete) continue;
    const source = sourceChunks.join("");
    // A wrapper around one complete text leaf adds no composition. Preserve
    // that leaf's identity, while links and controls retain their semantics.
    const onlyTextParent = group.styled.size === 1 ? group.styled.values().next().value : undefined;
    const owner = onlyTextParent && !/^(a|button|label)$/i.test(semanticOwner.localName)
      && analysisText === source && onlyTextParent.contains(group.nodes[0]!)
      && group.nodes.every((node) => onlyTextParent.contains(node)) ? onlyTextParent : semanticOwner;
    const selector = selectors.buildSelectorFor(owner, document);
    if (!selector || !selectors.roundTrips(document, owner, selector)) continue;
    const styleSelectors = [selector];
    for (const styled of group.styled) {
      if (styled === owner) continue;
      const styledSelector = selectors.buildSelectorFor(styled, document);
      if (styledSelector && selectors.roundTrips(document, styled, styledSelector)) styleSelectors.push(styledSelector);
    }
    const link = owner.closest("a[href]") as HTMLAnchorElement | null;
    out.push({ selector, text: source, analysisText, sourceMapping, styleSelectors, ...(link?.href ? { href: link.href } : {}) });
  }
  return { elements: out, limitsReached: [...limits].sort() };
}

/** Compose trusted source only; page text and attributes never enter JavaScript source. */
async function extractTextElements(page: Page | Frame): Promise<TextCollection> {
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
    frameVisibility?: FrameVisibilityContext;
    onElementsAnalyzed?: (count: number) => void;
    onTextCollectionIssue?: (issue: { code: "TEXT_COLLECTION_LIMIT"; detail: string }) => void;
    onAdText?: (source: { url: string; location: string; evidenceText: string; analysisText: string }) => void;
  },
): Promise<DecidedCandidate[]> {
  const framePath = (input.framePath ?? []).map((s) => ({
    src: input.baseUrl ? normalizeFrameSrc(s.src, input.baseUrl) : s.src,
    selector: s.selector,
  }));
  const collection = await extractTextElements(page);
  const elements = collection.elements;
  if (collection.limitsReached.length) input.onTextCollectionIssue?.({ code: "TEXT_COLLECTION_LIMIT", detail: collection.limitsReached.join(", ") });
  input.onElementsAnalyzed?.(elements.length);
  const payload = elements.flatMap((e) => e.styleSelectors.map((selector) => ({ selector, rawText: e.text, href: e.href })));
  const signals = await page.evaluate(collectElementSignals, { inputs: payload, frameVisibility: input.frameVisibility, limits: SCAN_POLICY.visibility });
  const bySelector = new Map(signals.map((signal) => [signal.selector, signal]));
  const out: DecidedCandidate[] = [];

  for (const el of elements) {
    const signal = bySelector.get(el.selector);
    // A replacement text cannot be evidence for the earlier ownership/analysis snapshot.
    if (!signal || signal.rawText !== el.text) continue;
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
    const hg = homoglyphSignal(el.analysisText, gate.representation, gate.adMatches);
    if (hg) techniques.push({ ...hg, rawText });
    const jm = jamoSignal(el.analysisText, gate.representation, gate.adMatches);
    if (jm) techniques.push({ ...jm, rawText });
    const ownedSignals = el.styleSelectors.map((selector) => bySelector.get(selector)).filter((value) => value !== undefined);
    const transparentSignal = ownedSignals.find((value) => value.transparent);
    const offscreenSignal = ownedSignals.find((value) => value.offscreen
      && !(value.collapsedNavigation && !gate.offerIntent && !gate.suspiciousDestination));
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
        textPolicy: { version: gate.policyVersion, reasonCodes: gate.reasonCodes, analysisText: el.analysisText,
          alignment: "exact", sourceMapping: el.sourceMapping, matches: gate.matches, offerSpans: gate.offerSpans,
          techniqueSpans: technique.technique === "HOMOGLYPH" ? hg!.sourceSpans : technique.technique === "JAMO" ? jm!.sourceSpans : [],
          quotedSpans: gate.quotedSpans, truncated: gate.representation.truncated },
        observed: { selector: observed.selector, box: observed.box, css: observed.css, renderingIssues: observed.renderingIssues },
      });
    }
  }
  return out;
}
