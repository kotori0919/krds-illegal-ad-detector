/**
 * Demo fixture: deterministic synthetic findings for the browser preview.
 *
 * Mirrors the frozen ground-truth shape (url + location + technique) so the
 * KRDS flow (filters, evidence, export validation) exercises against stable
 * data. The desktop host replaces this with live scan results; the preview
 * never claims these are real detections — the banner says so.
 */
import type { OfficialResult } from "@krds-detector/contracts";

export const DEMO_ENTRY_URL = "https://demo.example.kr/";

export function demoResult(): OfficialResult {
  const started = "2026-10-01T00:00:00.000Z";
  return {
    meta: {
      topic: "미리보기 데모",
      entry_url: DEMO_ENTRY_URL,
      started_at: started,
      finished_at: "2026-10-01T00:01:00.000Z",
      elapsed_sec: 60,
      tool_version: "0.1.0",
    },
    findings: [
      {
        id: "demo-f1",
        url: "https://demo.example.kr/positives/homoglyph.html",
        is_violation: true,
        location: "#ad-hg-casino",
        evidence_text: "Ｋ카지노 신규가입 꽁머니 3만원 지급",
        technique: "HOMOGLYPH",
      },
      {
        id: "demo-f2",
        url: "https://demo.example.kr/positives/jamo.html",
        is_violation: true,
        location: "#ad-jamo-casino",
        evidence_text: "ㅋㅏㅈㅣㄴㅗ 신규 가입 머니 지급",
        technique: "JAMO",
      },
      {
        id: "demo-f3",
        url: "https://demo.example.kr/positives/transparent.html",
        is_violation: true,
        location: "#ad-tr-opacity",
        evidence_text: "무직자 당일 대출 승인",
        technique: "TRANSPARENT",
      },
      {
        id: "demo-f4",
        url: "https://demo.example.kr/structural/inner.html",
        is_violation: true,
        location:
          'iframe[src="https://demo.example.kr/structural/middle.html"] >>> iframe[src="https://demo.example.kr/structural/inner.html"] >>> #ad-frame-jamo',
        evidence_text: "ㅋㅏㅈㅣㄴㅗ 첫충전 이벤트",
        technique: "JAMO",
      },
      {
        id: "demo-f5",
        url: "https://demo.example.kr/positives/offscreen.html",
        is_violation: true,
        location: "#ad-off-negpos",
        evidence_text: "카지노 첫충 30% 보너스",
        technique: "OFFSCREEN",
      },
    ],
  };
}
