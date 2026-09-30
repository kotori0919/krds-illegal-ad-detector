/**
 * JAMO detector (docs/DETECTION.md §4).
 *
 * Covers Compatibility Jamo (U+3131–U+3163) and Conjoining Jamo
 * (U+1100–U+11FF): fragmented spellings (ㅋㅏㅈㅣㄴㅗ → 카지노), conjoining
 * decompositions (대출 → 대출). Reconstruction goes to normalizedText;
 * evidence_text always keeps the raw source.
 *
 * Precision rule: isolated Jamo in otherwise normal syllabic text
 * (e.g. "ㅋㅋㅋ" laughter in educational content) is not Jamo evasion —
 * require >= 4 Jamo chars or a Jamo-only spelling without syllables.
 */
import type { TechniqueEvidence } from "@krds-detector/contracts";

const COMPAT_JAMO_RE = /[ㄱ-ㅎㅏ-ㅣ]/;
const CONJOINING_JAMO_RE = /[ᄀ-ᇿ]/;
const JAMO_ANY_RE = /[ㄱ-ㅎㅏ-ㅣᄀ-ᇿ]/;

export function jamoSignal(rawText: string): TechniqueEvidence | undefined {
  if (!COMPAT_JAMO_RE.test(rawText) && !CONJOINING_JAMO_RE.test(rawText)) return undefined;
  const hasSyllables = /[가-힣]/.test(rawText);
  const jamoCount = (rawText.match(new RegExp(JAMO_ANY_RE.source, "g")) ?? []).length;
  const fragmented = !hasSyllables || jamoCount >= 4;
  const spacedSingle = /\s[ㄱ-ㅎㅏ-ㅣᄀ-ᇿ]\s/.test(rawText);
  if (!fragmented && !spacedSingle) return undefined;
  const normalizedText = rawText.normalize("NFKC").replace(/\s+/g, "");
  return {
    kind: "jamo-signal",
    technique: "JAMO",
    rawText,
    normalizedText,
    detail: `jamo fragmentation: ${String(jamoCount)} jamo chars → "${normalizedText.slice(0, 40)}"`,
  };
}
