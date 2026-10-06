import type { OfficialTechnique } from "@krds-detector/contracts";

export const techniqueLabel: Record<OfficialTechnique, string> = {
  HOMOGLYPH: "유사 문자",
  JAMO: "자모 분리",
  TRANSPARENT: "투명 처리",
  OFFSCREEN: "화면 밖 배치",
};
