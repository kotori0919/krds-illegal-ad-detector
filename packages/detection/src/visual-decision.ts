import type { ImageAnalysis, TextEmbeddingEvidence, VisualEmbeddingEvidence } from "@krds-detector/contracts";
import type { VisualCandidate } from "./creative.js";
import { hasSuspiciousDestination, normalizeForMatch, semanticGate } from "./semantic.js";

export function hasVisualAdCategory(normalizedText: string): boolean {
  return /카지노|바카라|슬롯|토토|홀덤|casino|대출|현금화|머니상|소액결제|환전/i.test(normalizedText);
}

/** OCR text alone cannot classify an image-only advertisement. */
export function decideVisualImage(candidate: VisualCandidate, ocr: ImageAnalysis["ocr"], repeatedAdCreative: boolean, embedding?: TextEmbeddingEvidence, visual?: VisualEmbeddingEvidence) {
  const semantic = semanticGate(ocr.state === "available" ? ocr.text : "");
  const text = semantic.normalizedText;
  const publicNotice = isPublicVisualInformation(ocr);
  const jargon = ["콤프", "롤링", "페이백", "첫충"].filter((term) =>
    term === "첫충" ? /첫충(?!전)/.test(text) : text.includes(term));
  const compoundDeposit = !publicNotice && candidate.candidateEvidence.includes("external-destination")
    && isExternalDestination(candidate) && /\d+(?:\.\d+)?%/.test(text)
    && /콤프|롤링/.test(text) && jargon.length >= 2 && /입금|첫충(?!전)/.test(text);
  const category = hasVisualAdCategory(text);
  const promotion = semantic.offerIntent || /고액전용|신규회원|첫입금|첫충(?!전)|충전보너스|롤링|콤프/.test(text);
  const gate = { ...semantic, passed: !publicNotice && (semantic.passed && category && promotion || compoundDeposit),
    matchedTerms: compoundDeposit ? [...new Set([...semantic.matchedTerms, ...jargon])] : semantic.matchedTerms };
  const visibleDomEquivalent = gate.passed && candidate.visibleDomAdTexts.some((text) =>
    normalizeForMatch(text).includes(gate.normalizedText));
  // Opaque advertiser domains and numeric image names carry no ad marker.
  // A real external click target corroborates an offer in the image, but
  // never a category word, logo or ordinary linked illustration alone.
  const externalOffer = candidate.candidateEvidence.includes("external-destination")
    && isExternalDestination(candidate)
    && category && promotion;
  const corroboration = candidate.candidateEvidence.includes("ad-marker")
    || hasSuspiciousDestination(candidate.destinationUrl) || repeatedAdCreative || externalOffer || compoundDeposit;
  const score = Number(gate.passed) + Number(corroboration) + Number(!visibleDomEquivalent);
  const threshold = 3;
  if (score < threshold && embedding?.state === "available" && embedding.passed
    && shouldAnalyzeVisualText(candidate, ocr)) {
    return { gate: { ...gate, passed: true }, visibleDomEquivalent: false,
      decision: { rule: "image-only-ad-v4-text-review", score: 3, threshold,
        passed: true, detail: "text-embedding-review,observed-external-destination,no-equivalent-visible-dom-text" } };
  }
  if (score < threshold && visual?.state === "available" && visual.passed
    && canReviewVisualImage(candidate, ocr)
    && (!text || !candidate.visibleDomAdTexts.some(visible => normalizeForMatch(visible).includes(text)))) {
    return { gate, visibleDomEquivalent: false, decision: { rule: "image-only-ad-v5-image-review", score: 3, threshold,
      passed: true, detail: "image-embedding-review,observed-external-destination,layout-control-negative,no-equivalent-visible-dom-text" } };
  }
  return { gate, visibleDomEquivalent, decision: { rule: "image-only-ad-v3", score, threshold,
    passed: score >= threshold,
    detail: [gate.passed ? "ad-semantics" : "no-ad-semantics",
      compoundDeposit ? "external-linked-compound-deposit-offer" : externalOffer ? "external-linked-image-offer" : corroboration ? "candidate-corroboration" : "no-independent-corroboration",
      visibleDomEquivalent ? "equivalent-visible-dom-text" : "no-equivalent-visible-dom-text"].join(",") } };
}

function isExternalDestination(candidate: VisualCandidate): boolean {
  if (!candidate.destinationUrl) return false;
  try {
    const destination = new URL(candidate.destinationUrl);
    return /^https?:$/.test(destination.protocol) && !destination.username && !destination.password
      && destination.hostname !== new URL(candidate.frameUrl).hostname;
  } catch { return false; }
}

/** Public examples stay excluded before and after any semantic helper. */
export function isPublicVisualInformation(ocr: ImageAnalysis["ocr"]): boolean {
  const semantic = semanticGate(ocr.state === "available" ? ocr.text : "");
  return semantic.reasonCodes.includes("PUBLIC_INFORMATION")
    || /불법(?:광고|도박).*?(?:신고|예방|교육)|(?:신고|예방|교육|통계|도움말|차단)(?:안내|절차|방법|자료|캠페인)|신고하세요|보이스피싱.*(?:제로|예방|주의|캠페인)|피싱.*신고/i.test(semantic.normalizedText);
}

export function canReviewVisualImage(candidate: VisualCandidate, ocr: ImageAnalysis["ocr"]): boolean {
  return ocr.state === "available" && !isPublicVisualInformation(ocr) && !hasOrdinaryCommercialContext(ocr)
    && candidate.candidateEvidence.includes("external-destination") && isExternalDestination(candidate);
}

function hasOrdinaryCommercialContext(ocr: ImageAnalysis["ocr"]): boolean {
  if (ocr.state !== "available") return false;
  const text = semanticGate(ocr.text).normalizedText;
  // Readable ordinary transactions take precedence over image style. Actual
  // gambling categories or deposit jargon prevent this conservative exclusion.
  if (hasVisualAdCategory(text) || /첫충|매충|콤프|롤링|페이백|입금|충전/.test(text)) return false;
  return /수강|강의|교재|학원|응시료/.test(text) && /할인|무료|개강|패키지|환급|수강/.test(text)
    || /휴대폰|스마트폰/.test(text) && /쿠폰|할인|구매|판매|증정|배송/.test(text);
}

export function shouldAnalyzeVisualText(candidate: VisualCandidate, ocr: ImageAnalysis["ocr"]): boolean {
  if (ocr.state !== "available" || !canReviewVisualImage(candidate, ocr) || !/[\p{L}]/u.test(ocr.text)) return false;
  const semantic = semanticGate(ocr.text);
  if (!/\p{N}/u.test(ocr.text)
    && semantic.matchedTerms.length === 0 && !semantic.offerIntent
    && !/콤프|롤링|페이백/.test(semantic.normalizedText)) return false;
  // A prize draw is not evidence of betting. Preserve actual category or
  // deposit/offer context instead of inferring it from a corrupted coupon.
  if (/당첨|경품|추첨|상금/.test(semantic.normalizedText) && !semantic.reasonCodes.includes("AD_CATEGORY")
    && !/(?:회원|신규)가입|가입코드|첫입금|입금|충전|롤링|콤프|페이백/.test(semantic.normalizedText)) return false;
  const text = normalizeForMatch(ocr.text);
  return !!text && !candidate.visibleDomAdTexts.some(visible => normalizeForMatch(visible).includes(text));
}
