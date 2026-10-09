/** Pure match representations. Offsets are UTF-16 offsets into the unchanged source.
 * The Cyrillic allowlist is a reviewed subset of Unicode UTS #39, version 15.1.0:
 * https://www.unicode.org/Public/security/15.1.0/confusables.txt
 * This is deliberately not a universal transliterator or a probability model.
 */
export const TEXT_POLICY_VERSION = "text-policy-2";
export const MAX_TEXT_CODE_UNITS = 32768;
export type TextTransform = "width" | "case" | "cyrillic" | "jamo" | "separator" | "leet";
export interface SourceSpan { start: number; end: number; raw: string }
interface Unit { text: string; start: number; end: number; transforms: TextTransform[] }
export interface TextMatch extends SourceSpan { term: string; transforms: TextTransform[] }
export interface TextRepresentation {
  version: typeof TEXT_POLICY_VERSION;
  rawText: string;
  matchText: string;
  units: readonly Unit[];
  truncated: boolean;
  alignment: "exact";
}

const CYRILLIC: Readonly<Record<string, string>> = {
  "А": "A", "а": "a", "В": "B", "С": "C", "с": "c", "Е": "E", "е": "e",
  "Н": "H", "І": "I", "і": "i", "Ј": "J", "ј": "j", "К": "K", "М": "M",
  "О": "O", "о": "o", "Р": "P", "р": "p", "Ѕ": "S", "ѕ": "s", "Т": "T",
  "Х": "X", "х": "x", "У": "Y", "у": "y",
};
const SEPARATOR = /^[\s.・ㆍ·∙⋅‐‑‒–—_~^|/\\-]$/u;
const PUNCTUATION = /[.・ㆍ·∙⋅‐‑‒–—_~^|/\\-]/u;
// Modern Hangul syllable composition (Unicode chapter 3, Hangul Syllable Composition).
// Initial consonants with no valid final intentionally remain uncomposed.
const FINAL_BY_INITIAL = [1, 2, 4, 7, 0, 8, 16, 17, 0, 19, 20, 21, 22, 0, 23, 24, 25, 26, 27];

function combine(units: readonly Unit[], text: string, transform: TextTransform): Unit {
  return { text, start: units[0]!.start, end: units[units.length - 1]!.end,
    transforms: [...new Set([...units.flatMap((unit) => unit.transforms), transform])] };
}

function composeJamo(units: Unit[]): Unit[] {
  const out: Unit[] = [];
  for (let index = 0; index < units.length; index++) {
    const initial = units[index]!;
    const l = initial.text.codePointAt(0)! - 0x1100;
    const vowel = units[index + 1];
    const v = vowel ? vowel.text.codePointAt(0)! - 0x1161 : -1;
    if (l < 0 || l >= 19 || v < 0 || v >= 21) { out.push(initial); continue; }
    const parts = [initial, vowel!];
    let t = 0;
    const tail = units[index + 2];
    if (tail) {
      const cp = tail.text.codePointAt(0)!;
      if (cp >= 0x11a8 && cp <= 0x11c2) t = cp - 0x11a7;
      else if (cp >= 0x1100 && cp <= 0x1112) {
        const following = units[index + 3]?.text.codePointAt(0) ?? 0;
        // A compatibility consonant before a vowel starts the next syllable.
        if (!(following >= 0x1161 && following <= 0x1175)) t = FINAL_BY_INITIAL[cp - 0x1100] ?? 0;
      }
      if (t) parts.push(tail);
    }
    out.push(combine(parts, String.fromCodePoint(0xac00 + (l * 21 + v) * 28 + t), "jamo"));
    index += parts.length - 1;
  }
  return out;
}

export function restoreText(rawText: string): TextRepresentation {
  const source = rawText.slice(0, MAX_TEXT_CODE_UNITS);
  const units: Unit[] = [];
  let offset = 0;
  for (const raw of source) {
    const start = offset;
    offset += raw.length;
    if (SEPARATOR.test(raw)) continue;
    const transforms: TextTransform[] = [];
    if (/[！-～]/u.test(raw)) transforms.push("width");
    let normalized = raw.normalize("NFKC");
    normalized = [...normalized].map((char) => {
      const mapped = CYRILLIC[char];
      if (mapped) transforms.push("cyrillic");
      return mapped ?? char;
    }).join("");
    // ASCII case folding is sufficient for the supported Latin vocabulary;
    // other scripts retain their characters and are never transliterated.
    if (/[A-Z]/u.test(normalized)) transforms.push("case");
    normalized = normalized.replace(/[A-Z]/g, (char) => char.toLowerCase());
    for (const text of normalized) units.push({ text, start, end: offset, transforms: [...new Set(transforms)] });
  }
  const composed = composeJamo(units);
  // Leet is accepted only for a complete Latin casino token. Dates, telephone
  // numbers and arbitrary digits remain unchanged, including in offer text.
  const preLeet = composed.map((unit) => unit.text).join("");
  const indexByOffset: number[] = [];
  for (let index = 0; index < composed.length; index++) {
    for (let at = 0; at < composed[index]!.text.length; at++) indexByOffset.push(index);
  }
  for (const match of preLeet.matchAll(/c[a4][s5][i1]n[o0]/g)) {
    const from = indexByOffset[match.index]!;
    const to = indexByOffset[match.index + match[0].length - 1]! + 1;
    const first = composed[from]; const last = composed[to - 1];
    if (!first || !last) continue;
    const rawToken = source.slice(first.start, last.end);
    const before = source[first.start - 1] ?? ""; const after = source[last.end] ?? "";
    if (!/[0-9]/.test(rawToken) || /[A-Za-z0-9]/.test(before) || /[A-Za-z0-9]/.test(after)) continue;
    const restored = "casino";
    for (let at = from; at < to; at++) {
      if (composed[at]!.text !== restored[at - from]) {
        composed[at] = { ...composed[at]!, text: restored[at - from]!, transforms: [...composed[at]!.transforms, "leet"] };
      }
    }
  }
  return { version: TEXT_POLICY_VERSION, rawText, matchText: composed.map((unit) => unit.text).join(""), units: composed,
    truncated: rawText.length > source.length, alignment: "exact" };
}

export function findTextMatches(representation: TextRepresentation, terms: readonly string[]): TextMatch[] {
  const out: TextMatch[] = [];
  // Unit offsets track code points; match offsets are UTF-16, so build this
  // map explicitly rather than confusing astral characters with two units.
  const byOffset: Unit[] = [];
  for (const unit of representation.units) for (let at = 0; at < unit.text.length; at++) byOffset.push(unit);
  for (const term of terms) {
    let from = 0;
    while ((from = representation.matchText.indexOf(term, from)) !== -1) {
      const matchedUnits = byOffset.slice(from, from + term.length);
      const start = matchedUnits[0]!.start; const end = matchedUnits[matchedUnits.length - 1]!.end;
      const raw = representation.rawText.slice(start, end);
      const transforms = [...new Set(matchedUnits.flatMap((unit) => unit.transforms))];
      if (PUNCTUATION.test(raw)) transforms.push("separator");
      out.push({ term, start, end, raw, transforms: [...new Set(transforms)] });
      from += term.length;
    }
  }
  return out.sort((a, b) => a.start - b.start || a.end - b.end || a.term.localeCompare(b.term));
}

/** A directly attached width-folded Latin prefix is part of the named token
 * (e.g. Ｋ카지노), never a different word elsewhere in the sentence. */
export function techniqueMatches(representation: TextRepresentation, matches: readonly TextMatch[], technique: "HOMOGLYPH" | "JAMO"): TextMatch[] {
  return matches.flatMap((match) => {
    if (technique === "JAMO") return match.transforms.includes("jamo") ? [match] : [];
    if (match.transforms.some((kind) => kind === "width" || kind === "cyrillic" || kind === "separator" || kind === "leet")) return [match];
    const prefix = representation.rawText.slice(Math.max(0, match.start - 32), match.start).match(/[Ａ-Ｚａ-ｚ０-９A-Za-z0-9]+$/u)?.[0];
    if (!prefix || !/[Ａ-Ｚａ-ｚ０-９]/u.test(prefix)) return [];
    const start = match.start - prefix.length;
    return [{ ...match, start, raw: representation.rawText.slice(start, match.end), transforms: [...match.transforms, "width"] }];
  });
}
