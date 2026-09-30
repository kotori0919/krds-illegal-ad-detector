/**
 * Semantic gate, axis B (docs/DETECTION.md §2, frozen).
 *
 * A finding requires illegal-ad semantics: at least one matched ad/illegal
 * term (NFKC + space-folded match, raw preserved) OR a suspicious ad
 * destination URL. Legitimate hidden UI text never passes regardless of
 * concealment — the gate runs before any technique signal is trusted.
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

/** Suspicious destination markers (path/query/host fragments). */
const AD_DESTINATION_HINTS = [
  "casino",
  "baccarat",
  "slot",
  "toto",
  "loan",
  "cash",
  "bonus",
  "coupon",
  "promo",
  "event-win",
  "join-money",
] as const;

export function normalizeForMatch(raw: string): string {
  // Adversarial folding: punctuation inserted between syllables (카.지.노)
  // and leet digit/letter swaps (C4sino) are stripped before matching.
  // Raw text is always preserved separately; this form is match-only.
  const leet = raw
    .replace(/4/g, "a")
    .replace(/0/g, "o")
    .replace(/1/g, "l")
    .replace(/3/g, "e")
    .replace(/5/g, "s");
  return leet
    .normalize("NFKC")
    .replace(/[.・ㆍ·∙⋅‐‑‒–—_~^|/\\]/g, "")
    .replace(/\s+/g, "");
}

export function matchedAdTerms(raw: string): string[] {
  const norm = normalizeForMatch(raw);
  return (AD_TERMS as readonly string[]).filter((t) => norm.includes(t));
}

export function hasSuspiciousDestination(url: string | undefined): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (AD_DESTINATION_HINTS as readonly string[]).some((h) => lower.includes(h));
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
  const passed = matchedTerms.length > 0 || destHit;
  const detail = passed
    ? `ad-semantics: terms=[${matchedTerms.join(",")}]${destHit ? ` dest=${destinationUrl}` : ""}`
    : "no ad semantics: hidden text without illegal-ad vocabulary or destination";
  return { passed, matchedTerms, normalizedText, destinationUrl, detail };
}
