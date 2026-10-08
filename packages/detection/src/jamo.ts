/**
 * JAMO detector (docs/DETECTION.md §4).
 *
 * Covers Compatibility Jamo (U+3131–U+3163) and Conjoining Jamo
 * (U+1100–U+11FF): fragmented spellings (ㅋㅏㅈㅣㄴㅗ → 카지노), conjoining
 * decompositions (대출 → 대출). Reconstruction goes to normalizedText;
 * evidence_text always keeps the raw source.
 *
 * Precision rule: a vowel-bearing composition must contribute to a matched
 * ad term. Disconnected shorthand/laughter never establishes fragmentation.
 */
import type { TechniqueEvidence } from "@krds-detector/contracts";
import { AD_TERMS, normalizeForMatch } from "./semantic.js";

const JAMO_ANY_RE = /[ㄱ-ㅎㅏ-ㅣᄀ-ᇿ]/;
const JAMO_VOWEL_RE = /[ㅏ-ㅣᅠ-ᆧ]/;
const JAMO_STRIP_RE = /[ㄱ-ㅎㅏ-ㅣᄀ-ᇿ]/g;

function countTerm(text: string, term: string): number {
  let count = 0; let at = 0;
  while ((at = text.indexOf(term, at)) !== -1) { count++; at += term.length; }
  return count;
}

export function jamoSignal(rawText: string): TechniqueEvidence | undefined {
  if (!JAMO_ANY_RE.test(rawText) || !JAMO_VOWEL_RE.test(rawText)) return undefined;
  const nospace = rawText.replace(/\s+/g, "");
  const normalizedText = nospace.normalize("NFKC");
  const matchText = normalizeForMatch(rawText);
  const withoutJamo = normalizeForMatch(rawText.replace(JAMO_STRIP_RE, ""));
  const attributableTerms = AD_TERMS.filter((term) => countTerm(matchText, term) > countTerm(withoutJamo, term));
  if (!attributableTerms.length) return undefined;
  const jamoCount = (rawText.match(JAMO_STRIP_RE) ?? []).length;
  return {
    kind: "jamo-signal",
    technique: "JAMO",
    rawText,
    normalizedText,
    detail: `jamo fragmentation: terms=[${attributableTerms.join(",")}] ${String(jamoCount)} jamo chars → "${normalizedText.slice(0, 40)}"`,
  };
}
