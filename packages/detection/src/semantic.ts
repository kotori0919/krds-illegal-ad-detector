/**
 * Semantic gate, axis B. Pure restoration precedes semantic evaluation.
 *
 * A finding requires illegal-ad semantics: at least one matched ad/illegal
 * category (or a generic term supported by an offer) OR a suspicious ad
 * destination URL. Public reporting/education text without an offer is not
 * an ad. Local public context is never a page-wide exemption.
 */
import { findTextMatches, restoreText, TEXT_POLICY_VERSION, MAX_TEXT_CODE_UNITS, type SourceSpan, type TextMatch, type TextRepresentation } from "./text-policy.js";

export const AD_TERMS = [
  "카지노",
  "바카라",
  "슬롯",
  "토토",
  "홀덤",
  "대출",
  "현금화",
  "꽁머니",
  "당첨금",
  "환전",
  "보너스",
  "쿠폰",
  "머니상",
  "첫충",
  "소액결제",
  "신용무관",
  "무직자",
  "당일승인",
  "당일",
  "고액",
  "배당",
  "보장",
  "casino",
  "무료체험",
] as const;

/** Ordinary service/review language does not establish an ad by itself. */
const WEAK_AD_TERMS = new Set<string>(["보장", "당일", "고액", "보너스", "쿠폰", "무료체험"]);

/** A category in a public article path is not an ad destination by itself. */
const AD_DESTINATION_CATEGORY = /casino|baccarat|slot|toto|loan|cash|bonus|coupon/i;
const AD_HOST_LABEL = /^(?:casino|baccarat|slot|toto)(?:\d+)?$/i;
const AD_ROUTE_ACTION = /(?:^|[/?&=._-])(?:join|signup|register|apply|bet|play|promo|bonus|deposit|event-win|join-money)(?:$|[/?&=._-])/i;

// These describe why an illegal-ad term may appear in public information.
// A sales offer in the same element still passes the gate, even if the ad
// borrows reporting language to look legitimate.
const PUBLIC_INFORMATION_CONTEXT = /신고|예방|교육|통계|설명|도움말|절차|양식|뜻하|차단/i;
const OFFER_INTENT = /가입(?!\s*광고)|(?:즉시|간편|당일|무서류)\s*승인|(?:머니|현금|쿠폰|보너스|당첨금)\s*(?:즉시\s*)?지급|첫충|꽁머니|무료\s*체험\s*(?:신청|제공|받기)|실시간\s*쿠폰|고액\s*배당|환전\s*안내|신용\s*무관|무직자|24\s*시\s*간편/i;

export function normalizeForMatch(raw: string): string {
  return restoreText(raw).matchText;
}

export function matchedAdTerms(raw: string): string[] {
  const norm = normalizeForMatch(raw);
  return (AD_TERMS as readonly string[]).filter((t) => norm.includes(t));
}

export function hasSuspiciousDestination(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url, "https://destination.invalid");
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    if (parsed.hostname.split(".").some((label) => AD_HOST_LABEL.test(label))) return true;
    const route = `${parsed.pathname}${parsed.search}`;
    return AD_DESTINATION_CATEGORY.test(route) && AD_ROUTE_ACTION.test(route);
  } catch {
    return false;
  }
}

export interface GateVerdict {
  passed: boolean;
  matchedTerms: string[];
  normalizedText: string;
  destinationUrl?: string;
  offerIntent: boolean;
  suspiciousDestination: boolean;
  detail: string;
  policyVersion: typeof TEXT_POLICY_VERSION;
  reasonCodes: SemanticReasonCode[];
  matches: TextMatch[];
  adMatches: TextMatch[];
  offerSpans: SourceSpan[];
  quotedSpans: SourceSpan[];
  representation: TextRepresentation;
}

export type SemanticReasonCode = "AD_CATEGORY" | "AD_OFFER" | "OBSERVED_DESTINATION_PATTERN" | "PUBLIC_INFORMATION"
  | "QUOTED_PUBLIC_EXAMPLE" | "LIBRARY_SERVICE" | "NO_SUPPORTED_AD_EVIDENCE" | "TEXT_ANALYSIS_LIMIT";

function quotedSpans(raw: string): SourceSpan[] {
  return [...raw.matchAll(/"[^"\n]{1,4096}"|'[^'\n]{1,4096}'|“[^”\n]{1,4096}”|‘[^’\n]{1,4096}’|「[^」\n]{1,4096}」/gu)]
    .map((match) => ({ start: match.index, end: match.index + match[0].length, raw: match[0] }));
}

function maskSpans(raw: string, spans: SourceSpan[]): string {
  let cursor = 0; const chunks: string[] = [];
  for (const span of spans) { chunks.push(raw.slice(cursor, span.start), " ".repeat(span.end - span.start)); cursor = span.end; }
  chunks.push(raw.slice(cursor)); return chunks.join("");
}

/** Pure gate: no DOM, no I/O. Raw text preserved verbatim by the caller. */
export function semanticGate(rawText: string, destinationUrl?: string, representation = restoreText(rawText)): GateVerdict {
  const normalizedText = representation.matchText;
  const matches = findTextMatches(representation, AD_TERMS);
  const matchedTerms = [...new Set(matches.map((match) => match.term))];
  const destHit = hasSuspiciousDestination(destinationUrl);
  const boundedSource = rawText.slice(0, MAX_TEXT_CODE_UNITS);
  const readableText = boundedSource.normalize("NFKC");
  const publicInformation = PUBLIC_INFORMATION_CONTEXT.test(readableText);
  // Original offsets, never the offsets of length-changing NFKC output.
  const quotes = publicInformation ? quotedSpans(boundedSource) : [];
  const adMatches = matches.filter((match) => !quotes.some((quote) => match.start < quote.end && match.end > quote.start));
  const offerRepresentation = restoreText(maskSpans(boundedSource, quotes));
  const offsets = offerRepresentation.units.flatMap((unit) => Array.from({ length: unit.text.length }, () => unit));
  const offerSpans: SourceSpan[] = [];
  for (const match of offerRepresentation.matchText.matchAll(new RegExp(OFFER_INTENT.source, "giu"))) {
    const first = offsets[match.index]; const last = offsets[match.index + match[0].length - 1];
    if (first && last) offerSpans.push({ start: first.start, end: last.end, raw: rawText.slice(first.start, last.end) });
  }
  const offer = offerSpans.length > 0;
  const strongTerm = adMatches.some((match) => !WEAK_AD_TERMS.has(match.term));
  const libraryService = /도서|도서관|전자책|자료실|열람|반납|독서/u.test(readableText) && matches.some((match) => match.term === "대출")
    && !/무서류|무직자|신용\s*무관|당일\s*승인|현금|첫충|꽁머니/u.test(readableText)
    && !adMatches.some((match) => match.term !== "대출" && !WEAK_AD_TERMS.has(match.term));
  const passed = (strongTerm || (adMatches.length > 0 && offer) || destHit)
    && (!publicInformation || offer || destHit) && (!libraryService || destHit);
  const reasonCodes: SemanticReasonCode[] = [];
  if (strongTerm) reasonCodes.push("AD_CATEGORY");
  if (offer) reasonCodes.push("AD_OFFER");
  if (destHit) reasonCodes.push("OBSERVED_DESTINATION_PATTERN");
  if (publicInformation) reasonCodes.push("PUBLIC_INFORMATION");
  if (quotes.length) reasonCodes.push("QUOTED_PUBLIC_EXAMPLE");
  if (libraryService) reasonCodes.push("LIBRARY_SERVICE");
  if (!passed) reasonCodes.push("NO_SUPPORTED_AD_EVIDENCE");
  if (representation.truncated) reasonCodes.push("TEXT_ANALYSIS_LIMIT");
  const detail = passed
    ? `ad-semantics: terms=[${matchedTerms.join(",")}]${destHit ? " observed destination pattern (not visited)" : ""}`
    : libraryService && !destHit ? "library borrowing service without financial solicitation"
    : publicInformation && !offer && !destHit
      ? "public information; quoted examples do not establish solicitation"
      : "no ad semantics: no supported illegal-ad category, offer or destination";
  return { passed, matchedTerms, normalizedText, destinationUrl, offerIntent: offer, suspiciousDestination: destHit,
    detail: `${TEXT_POLICY_VERSION}: ${detail}; reasons=[${reasonCodes.join(",")}]`, policyVersion: TEXT_POLICY_VERSION,
    reasonCodes, matches, adMatches, offerSpans, quotedSpans: quotes, representation };
}
