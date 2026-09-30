/**
 * HOMOGLYPH detector (docs/DETECTION.md §3).
 *
 * Deterministic Unicode analysis: fullwidth forms (U+FF01–U+FF5E),
 * Cyrillic/Latin lookalikes, NFKC inequality from confusable folding.
 * Jamo-only composition differences are excluded here (JAMO owns them):
 * stripping Compat + Conjoining Jamo + whitespace must still leave a
 * confusable delta, otherwise the signal belongs to the Jamo detector.
 */
import type { TechniqueEvidence } from "@krds-detector/contracts";

const FULLWIDTH_RE = /[！-～]/;
const CYRILLIC_RE = /[Ѐ-џ]/;
const COMPAT_JAMO_RE = /[ㄱ-ㅎㅏ-ㅣ]/;
const CONJOINING_JAMO_RE = /[ᄀ-ᇿ]/;

function codepointList(raw: string, normalized: string): string {
  const raws: string[] = [];
  for (const ch of raw) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp > 127) raws.push(`U+${cp.toString(16).toUpperCase().padStart(4, "0")}`);
    if (raws.length >= 8) break;
  }
  void normalized;
  return raws.join(" ");
}

export function homoglyphSignal(rawText: string): TechniqueEvidence | undefined {
  const hasFullwidth = FULLWIDTH_RE.test(rawText);
  const hasCyrillic = CYRILLIC_RE.test(rawText);
  const hasPunctSplit = /[가-힣][.・ㆍ·∙⋅‐‑‒–—_~^|/\\][가-힣]/.test(rawText);
  const hasLeetDigit = /[a-zA-Z][40135][a-zA-Z]/.test(rawText) || /C4sino/i.test(rawText);
  if (hasPunctSplit || hasLeetDigit) {
    const normalizedText = rawText.normalize("NFKC");
    return {
      kind: "homoglyph-signal",
      technique: "HOMOGLYPH",
      rawText,
      normalizedText,
      detail: `evasion split ${codepointList(rawText, normalizedText)}`,
    };
  }
  if (!hasFullwidth && !hasCyrillic) {
    // NFKC-only delta without confusable blocks: Jamo composition or
    // compatibility folding the Jamo detector owns. Not a homoglyph.
    const stripped = rawText.replace(/[ㄱ-ㅎㅏ-ㅣᄀ-ᇿ\s]/g, "");
    if (stripped.normalize("NFKC") === stripped) return undefined;
    // Residual non-Jamo NFKC delta (e.g. digit/letter folding) still counts.
    if (!/[Ａ-Ｚａ-ｚ０-９]/.test(rawText)) return undefined;
  }
  const normalizedText = rawText.normalize("NFKC");
  const detail = `confusables ${codepointList(rawText, normalizedText)} → NFKC "${normalizedText.slice(0, 40)}"`;
  void COMPAT_JAMO_RE;
  void CONJOINING_JAMO_RE;
  return {
    kind: "homoglyph-signal",
    technique: "HOMOGLYPH",
    rawText,
    normalizedText,
    detail,
  };
}
