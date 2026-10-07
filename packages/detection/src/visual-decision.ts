import type { ImageAnalysis } from "@krds-detector/contracts";
import type { VisualCandidate } from "./creative.js";
import { hasSuspiciousDestination, normalizeForMatch, semanticGate } from "./semantic.js";

/** OCR text alone cannot classify an image-only advertisement. */
export function decideVisualImage(candidate: VisualCandidate, ocr: ImageAnalysis["ocr"], repeatedAdCreative: boolean) {
  const gate = semanticGate(ocr.state === "available" ? ocr.text : "");
  const visibleDomEquivalent = gate.passed && candidate.visibleDomAdTexts.some((text) =>
    normalizeForMatch(text).includes(gate.normalizedText));
  const corroboration = candidate.candidateEvidence.includes("ad-marker")
    || hasSuspiciousDestination(candidate.destinationUrl) || repeatedAdCreative;
  const score = Number(gate.passed) + Number(corroboration) + Number(!visibleDomEquivalent);
  const threshold = 3;
  return { gate, visibleDomEquivalent, decision: { rule: "image-only-ad-v1", score, threshold,
    passed: score >= threshold,
    detail: [gate.passed ? "ad-semantics" : "no-ad-semantics",
      corroboration ? "candidate-corroboration" : "no-independent-corroboration",
      visibleDomEquivalent ? "equivalent-visible-dom-text" : "no-equivalent-visible-dom-text"].join(",") } };
}
