import type { ScanStatus } from "@krds-detector/contracts";

export function formatElapsed(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export const scanStatusLabel = (stage: ScanStatus): string => ({
  queued: "점검 준비 중",
  running: "페이지 수집·분석 중",
  finalizing: "추가 단서 분석·결과 정리 중",
  succeeded: "점검 완료",
  cancelled: "점검 중지됨",
  failed: "점검 실패",
}[stage]);
