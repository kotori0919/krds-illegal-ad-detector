/**
 * Semantic gate, axis B (docs/DETECTION.md §2, frozen).
 *
 * A finding requires illegal-ad semantics: at least one matched ad/illegal
 * term (NFKC + space-folded match, raw preserved) OR a suspicious ad
 * destination URL. Public reporting/education text without an offer is not
 * an ad. The gate runs before any technique signal is trusted.
 */

const AD_TERMS = [
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

/** A category in a public article path is not an ad destination by itself. */
const AD_DESTINATION_CATEGORY = /casino|baccarat|slot|toto|loan|cash|bonus|coupon/i;
const AD_HOST_LABEL = /^(?:casino|baccarat|slot|toto)(?:\d+)?$/i;
const AD_ROUTE_ACTION = /(?:^|[/?&=._-])(?:join|signup|register|apply|bet|play|promo|bonus|deposit|event-win|join-money)(?:$|[/?&=._-])/i;

// These describe why an illegal-ad term may appear in public information.
// A sales offer in the same element still passes the gate, even if the ad
// borrows reporting language to look legitimate.
const PUBLIC_INFORMATION_CONTEXT = /신고|예방|교육|통계|설명|도움말|절차|양식|뜻하|차단/i;
const OFFER_INTENT = /가입(?!\s*광고)|(?:즉시|간편|당일|무서류)\s*승인|(?:머니|현금|쿠폰|보너스|당첨금)\s*지급|첫충|꽁머니|무료\s*체험|실시간\s*쿠폰|고액\s*배당|환전\s*안내|신용\s*무관|무직자|24\s*시\s*간편/i;

export function normalizeForMatch(raw: string): string {
  // Adversarial folding: punctuation inserted between syllables (카.지.노,
  // 카-지-노) and leet digit/letter swaps (C4sino) are stripped before
  // matching. Plain spaces are folded by \s+ below (not stripped here) so
  // spaced syllables (카 지 노) still match after whitespace removal.
  // Raw text is always preserved separately; this form is match-only.
  const leet = raw
    .replace(/4/g, "a")
    .replace(/0/g, "o")
    .replace(/1/g, "l")
    .replace(/3/g, "e")
    .replace(/5/g, "s");
  return leet
    .normalize("NFKC")
    .replace(/[.・ㆍ·∙⋅‐‑‒–—_~^|/\\-]/g, "")
    .replace(/\s+/g, "");
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
  detail: string;
}

/** Pure gate: no DOM, no I/O. Raw text preserved verbatim by the caller. */
export function semanticGate(rawText: string, destinationUrl?: string): GateVerdict {
  const normalizedText = normalizeForMatch(rawText);
  const matchedTerms = matchedAdTerms(rawText);
  const destHit = hasSuspiciousDestination(destinationUrl);
  const readableText = rawText.normalize("NFKC");
  const publicInformation = PUBLIC_INFORMATION_CONTEXT.test(readableText);
  const offer = OFFER_INTENT.test(readableText);
  const passed = (matchedTerms.length > 0 || destHit) && (!publicInformation || offer || destHit);
  const detail = passed
    ? `ad-semantics: terms=[${matchedTerms.join(",")}]${destHit ? ` dest=${destinationUrl}` : ""}`
    : publicInformation && !offer && !destHit
      ? "public information without an ad offer or destination"
      : "no ad semantics: hidden text without illegal-ad vocabulary or destination";
  return { passed, matchedTerms, normalizedText, destinationUrl, detail };
}
