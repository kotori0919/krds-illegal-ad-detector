/**
 * Contract v0 (frozen 2026-10-01): official technique enum.
 *
 * `result.json` is sacred: only these four values may appear as `technique`.
 * Extended intelligence uses technique "ETC" plus a project-defined
 * `extra_finding` discriminator and lives in `result_extra.json`.
 */
export const OFFICIAL_TECHNIQUES = [
  "HOMOGLYPH",
  "JAMO",
  "TRANSPARENT",
  "OFFSCREEN",
] as const;

export type OfficialTechnique = (typeof OFFICIAL_TECHNIQUES)[number];

/** Operator/report presentation labels; official enum values remain unchanged. */
export const techniqueLabel: Record<OfficialTechnique, string> = {
  HOMOGLYPH: "유사 문자",
  JAMO: "자모 분리",
  TRANSPARENT: "투명 처리",
  OFFSCREEN: "화면 밖 배치",
};

export function isOfficialTechnique(value: unknown): value is OfficialTechnique {
  return (
    typeof value === "string" &&
    (OFFICIAL_TECHNIQUES as readonly string[]).includes(value)
  );
}

/** Extra-result technique marker (never valid inside result.json). */
export const EXTRA_TECHNIQUE = "ETC" as const;
export type ExtraTechnique = typeof EXTRA_TECHNIQUE;
