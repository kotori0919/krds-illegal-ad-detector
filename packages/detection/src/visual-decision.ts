import type { ImageAnalysis, TextEmbeddingEvidence, VisualEmbeddingEvidence } from "@krds-detector/contracts";
import type { VisualCandidate } from "./creative.js";
import { hasSuspiciousDestination, normalizeForMatch, semanticGate } from "./semantic.js";

export function hasVisualAdCategory(normalizedText: string): boolean {
  return /카지노|바카라|슬롯|토토|홀덤|casino|대출|현금화|머니상|소액결제|환전/i.test(normalizedText);
}

// Deposit-bonus wording recovered from the observed Korean betting creatives.
// It is not a category word: these banners name only the offer. The axis
// therefore needs a settlement anchor (referral code or USDT/Tether
// settlement) plus two independent offer words, and a generic "10% 보너스"
// beside an anchor is never enough on its own. 첫중/입급/입들금/메이백/매이백
// are the corruptions this corpus actually produced (첫충/입금/페이백).
// Ordinary exchange/rebate wording (환전, 롤링, 꽁머니) is deliberately not an
// anchor: it also appears in currency-exchange and event notices, so an anchor
// must be a settlement handle that ordinary commerce does not print.
const REFERRAL_TERM = "가입코드";
const SETTLEMENT_ANCHORS = [REFERRAL_TERM, "테더", "usdt"] as const;
const DEPOSIT_TERMS = ["첫충", "첫중", "첫입금", "매충", "충전", "입금", "입급", "입들금"] as const;
const OFFER_REWARD_TERMS = ["페이백", "메이백", "매이백", "콤프", "롤링", "꽁머니", "보너스", "쿠폰", "퍼센트", "%"] as const;
const BETTING_DEPOSIT_TERMS = ["첫충", "첫중", "첫입금", "매충"] as const;
const BETTING_REWARD_TERMS = ["페이백", "메이백", "매이백", "콤프", "롤링", "꽁머니"] as const;

// 첫충 is only the betting compound when it is not the ordinary 충전/첫충전
// wording; the returned term stays "첫충" so matchedTerms validators keep it.
const TERM_PATTERNS: ReadonlyMap<string, RegExp> = new Map([["첫충", /첫충(?!전)/u]]);
const matchesTerm = (text: string, term: string): boolean => TERM_PATTERNS.get(term)?.test(text) ?? text.includes(term);
const matchedTermsIn = (text: string, terms: readonly string[]): string[] => terms.filter((term) => matchesTerm(text, term));

/** Observed deposit-offer terms; empty when the reading carries one signal only. */
export function depositCreativeTerms(normalizedText: string): string[] {
  const settlement = matchedTermsIn(normalizedText, SETTLEMENT_ANCHORS);
  if (!settlement.length) return [];
  const reward = matchedTermsIn(normalizedText, OFFER_REWARD_TERMS);
  const bettingReward = matchedTermsIn(normalizedText, BETTING_REWARD_TERMS);
  // A referral code plus betting rebate wording is a complete offer by itself.
  if (normalizedText.includes(REFERRAL_TERM) && bettingReward.length) {
    return [...new Set([...settlement, ...reward])];
  }
  const deposit = matchedTermsIn(normalizedText, DEPOSIT_TERMS);
  if (!deposit.length) return [];
  const bettingDeposit = matchedTermsIn(normalizedText, BETTING_DEPOSIT_TERMS);
  // Generic 충전/입금 only counts beside betting rebate wording; betting
  // first-deposit wording may also pair with a plain percentage.
  const offer = bettingReward.length > 0 || (bettingDeposit.length > 0 && reward.length > 0);
  return offer ? [...new Set([...settlement, ...deposit, ...reward])] : [];
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
  const depositTerms = publicNotice ? [] : depositCreativeTerms(text);
  const depositOffer = depositTerms.length > 0;
  const gate = { ...semantic, passed: !publicNotice && (semantic.passed && category && promotion || compoundDeposit || depositOffer),
    matchedTerms: compoundDeposit ? [...new Set([...semantic.matchedTerms, ...jargon])]
      : depositOffer ? [...new Set([...semantic.matchedTerms, ...depositTerms])] : semantic.matchedTerms };
  const visibleDomEquivalent = gate.passed && candidate.visibleDomAdTexts.some((text) =>
    normalizeForMatch(text).includes(gate.normalizedText));
  // Opaque advertiser domains and numeric image names carry no ad marker.
  // A real external click target corroborates an offer in the image, but
  // never a category word, logo or ordinary linked illustration alone.
  const externalOffer = candidate.candidateEvidence.includes("external-destination")
    && isExternalDestination(candidate)
    && (category && promotion || depositOffer);
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
