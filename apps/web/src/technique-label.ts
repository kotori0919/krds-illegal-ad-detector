import type { OfficialTechnique } from "@krds-detector/contracts";

export const techniqueLabel: Record<OfficialTechnique, string> = {
  HOMOGLYPH: "유사 문자",
  JAMO: "자모 분리",
  TRANSPARENT: "투명 처리",
  OFFSCREEN: "화면 밖 배치",
};

export const techniqueExplanation: Record<OfficialTechnique, string> = {
  HOMOGLYPH: "비슷하게 보이는 다른 문자를 사용한 광고 표현이 확인되었습니다.",
  JAMO: "한글 자모를 분리하거나 변형한 광고 표현이 확인되었습니다.",
  TRANSPARENT: "화면에서 읽기 어렵도록 투명하게 처리한 광고 표현이 확인되었습니다.",
  OFFSCREEN: "화면 밖 또는 보이지 않는 위치에 놓인 광고 표현이 확인되었습니다.",
};
