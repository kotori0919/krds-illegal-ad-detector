import type { ImageAnalysis } from "@krds-detector/contracts";
import type { VisualCandidate } from "./creative.js";
import { hasSuspiciousDestination, normalizeForMatch, semanticGate } from "./semantic.js";

/** OCR text alone cannot classify an image-only advertisement. */
export function decideVisualImage(candidate: VisualCandidate, ocr: ImageAnalysis["ocr"], repeatedAdCreative: boolean) {
  const gate = semanticGate(ocr.state === "available" ? ocr.text : "");
  const visibleDomEquivalent = gate.passed && candidate.visibleDomAdTexts.some((text) =>
    normalizeForMatch(text).includes(gate.normalizedText));
  // Opaque advertiser domains and numeric image names carry no ad marker.
  // A real external click target corroborates an offer in the image, but
  // never a category word, logo or ordinary linked illustration alone.
  const externalOffer = candidate.candidateEvidence.includes("external-destination")
    && isExternalDestination(candidate)
    && /카지노|바카라|슬롯|토토|홀덤|casino|대출|현금화|머니상|소액결제|환전/i.test(gate.normalizedText)
    && (gate.offerIntent || /고액전용|신규회원|첫입금|첫충|충전보너스|롤링|콤프/.test(gate.normalizedText));
  const corroboration = candidate.candidateEvidence.includes("ad-marker")
    || hasSuspiciousDestination(candidate.destinationUrl) || repeatedAdCreative || externalOffer;
  const score = Number(gate.passed) + Number(corroboration) + Number(!visibleDomEquivalent);
  const threshold = 3;
  return { gate, visibleDomEquivalent, decision: { rule: "image-only-ad-v2", score, threshold,
    passed: score >= threshold,
    detail: [gate.passed ? "ad-semantics" : "no-ad-semantics",
      externalOffer ? "external-linked-image-offer" : corroboration ? "candidate-corroboration" : "no-independent-corroboration",
      visibleDomEquivalent ? "equivalent-visible-dom-text" : "no-equivalent-visible-dom-text"].join(",") } };
}

function isExternalDestination(candidate: VisualCandidate): boolean {
  if (!candidate.destinationUrl) return false;
  try {
    const destination = new URL(candidate.destinationUrl);
    return /^https?:$/.test(destination.protocol) && destination.host !== new URL(candidate.frameUrl).host;
  } catch { return false; }
}
