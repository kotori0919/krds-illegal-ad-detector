/**
 * Detection pipeline: DOM extraction → Unicode analysis → computed
 * CSS/geometry → two-axis decision → OfficialFinding candidates.
 *
 * Runs against a live Playwright page. For each candidate element (id-bearing
 * text elements + query/delayed rendered nodes), collects Unicode signals in
 * Node (homoglyph/jamo/semantic over raw text) and rendering signals in-page
 * (transparent/offscreen over computed style + geometry), then emits one
 * CandidateEvidence per (element, technique) pair that passes BOTH axes.
 */
import type { Page } from "playwright-core";
import {
  serializeFramePath,
  type CandidateEvidence,
  type DecisionEvidence,
  type IllegalAdEvidence,
  type OfficialTechnique,
  type TechniqueEvidence,
} from "@krds-detector/contracts";
import { homoglyphSignal } from "./homoglyph.js";
import { jamoSignal } from "./jamo.js";
import { normalizeFrameSrc } from "@krds-detector/contracts";
import { semanticGate } from "./semantic.js";
import { collectElementSignals } from "./visibility.js";

export interface CandidateInput {
  selector: string;
  framePath: { src: string; selector: string }[];
  pageUrl: string;
}

export interface DecidedCandidate extends CandidateEvidence {
  selector: string;
  location: string;
  url: string;
  decision: DecisionEvidence;
}

interface PageTextElement {
  selector: string;
  text: string;
  href?: string;
}

/** Extract leaf id-bearing text elements (containers excluded: textContent would duplicate descendants). */
async function extractTextElements(page: Page): Promise<PageTextElement[]> {
  return page.evaluate(() => {
    const out: { selector: string; text: string; href?: string }[] = [];
    const els = document.querySelectorAll("[id]");
    for (let i = 0; i < els.length; i += 1) {
      const el = els[i] as HTMLElement;
      if (!el || !el.id) continue;
      // Skip containers whose id wraps descendant id elements (board-body,
      // delayed-slot): descendants carry the finding, not the wrapper.
      if (el.querySelector("[id]")) continue;
      const text = (el.textContent ?? "").trim();
      if (text.length === 0) continue;
      const entry: { selector: string; text: string; href?: string } = {
        selector: `#${el.id}`,
        text,
      };
      if (el instanceof HTMLAnchorElement && el.href) entry.href = el.href;
      const link = el.querySelector("a[href]") as HTMLAnchorElement | undefined;
      if (!entry.href && link?.href) entry.href = link.href;
      out.push(entry);
    }
    return out;
  });
}

function decide(rule: string, score: number, threshold: number, detail: string): DecisionEvidence {
  return { rule, score, threshold, passed: score >= threshold, detail };
}

export async function detectPageCandidates(
  page: Page,
  input: { pageUrl: string; framePath?: { src: string; selector: string }[]; baseUrl?: string },
): Promise<DecidedCandidate[]> {
  const framePath = (input.framePath ?? []).map((s) => ({
    src: input.baseUrl ? normalizeFrameSrc(s.src, input.baseUrl) : s.src,
    selector: s.selector,
  }));
  const elements = await extractTextElements(page);
  const payload = elements.map((e) => ({ selector: e.selector, rawText: e.text, href: e.href }));
  const signals = await page.evaluate(collectElementSignals, payload);
  const bySelector = new Map(elements.map((e) => [e.selector, e]));
  const out: DecidedCandidate[] = [];

  for (const signal of signals) {
    const el = bySelector.get(signal.selector);
    if (!el) continue;
    const rawText = signal.rawText;
    if (rawText.trim().length === 0) continue;
    const gate = semanticGate(rawText, signal.href ?? el.href);
    if (!gate.passed) continue;
    const illegalAd: IllegalAdEvidence = {
      rawText,
      normalizedText: gate.normalizedText,
      matchedTerms: gate.matchedTerms,
      destinationUrl: gate.destinationUrl,
      detail: gate.detail,
    };
    const techniques: TechniqueEvidence[] = [];
    const hg = homoglyphSignal(rawText);
    if (hg) techniques.push(hg);
    const jm = jamoSignal(rawText);
    if (jm) techniques.push(jm);
    if (signal.transparent) {
      techniques.push({
        kind: "transparent-signal",
        technique: "TRANSPARENT",
        rawText,
        detail: signal.transparentDetail,
      });
    }
    if (signal.offscreen) {
      techniques.push({
        kind: "offscreen-signal",
        technique: "OFFSCREEN",
        rawText,
        detail: `${signal.offscreenDetail} box=${String(Math.round(signal.box.x))},${String(Math.round(signal.box.y))},${String(Math.round(signal.box.width))}x${String(Math.round(signal.box.height))}`,
      });
    }
    for (const technique of techniques) {
      const location = serializeFramePath({ framePath, selector: signal.selector });
      const decision = decide("two-axis: semantic AND technique", 1, 1, `${gate.detail} + ${technique.detail}`);
      if (!decision.passed) continue;
      const t: OfficialTechnique = technique.technique;
      void t;
      out.push({
        technique,
        illegalAd,
        selector: signal.selector,
        location,
        url: input.pageUrl,
        decision,
      });
    }
  }
  return out;
}
