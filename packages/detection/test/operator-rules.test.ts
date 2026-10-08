import { describe, expect, it } from "vitest";
import { jamoSignal } from "../src/jamo.js";
import { semanticGate } from "../src/semantic.js";

describe("operator text precision", () => {
  it.each(["재미가 보장됩니다", "당일 처리 안내", "고액 결제 기준", "보너스 점수 계산", "쿠폰 사용법", "무료체험 후기"])(
    "does not treat an unsupported generic term as ad semantics: %s", (text) => {
      expect(semanticGate(text).passed).toBe(false);
    },
  );

  it.each([
    "카지노 보너스", "보너스 지급", "쿠폰 즉시 지급", "무료체험 가입", "고액 배당",
  ])("retains strong categories and offers: %s", (text) => {
    expect(semanticGate(text).passed).toBe(true);
  });

  it("keeps public help excluded and suspicious destinations authoritative", () => {
    expect(semanticGate("카지노 피해 신고 절차와 도움말").passed).toBe(false);
    expect(semanticGate("재미 보장", "https://example.org/casino/join").passed).toBe(true);
    expect(semanticGate("카지노 신고 안내, 첫충 보너스 지급").passed).toBe(true);
  });

  it.each([
    "원피스는 ㄹㅇ 재미가보장되있네 ㅋㅋㅋ", "카지노 진짜 ㄹㅇ ㅋㅋㅋㅋ", "카지노 ㄱ ㄴ ㄷ ㄹ",
    "카지노 아ㅁㅜ개 후기", "카지노 ㅏㅏㅏㅏ", "카지노 ᄀᄂᄃᄅ",
  ])("does not attribute disconnected Jamo to an ad technique: %s", (text) => {
    expect(jamoSignal(text)).toBeUndefined();
  });

  it.each([
    ["ㅋㅏㅈㅣㄴㅗ 첫충 보너스 지급", "카지노첫충보너스지급"],
    ["대출 간편 승인", "대출간편승인"],
    ["카ㅈㅣ노 신규가입", "카지노신규가입"],
    ["ㅋ ㅏ ㅈ ㅣ ㄴ ㅗ 신규가입", "카지노신규가입"],
    ["ᄃ ᅢ ᄎ ᅮ ᆯ 간편 승인", "대출간편승인"],
    ["카지노 안내 ㅋㅏㅈㅣㄴㅗ 첫충 보너스 지급", "카지노안내카지노첫충보너스지급"],
    ["대출 안내 대출 간편 승인", "대출안내대출간편승인"],
    ["카지노 안내 카ㅈㅣ노 첫충", "카지노안내카지노첫충"],
  ])("keeps attributable compatibility/conjoining/mixed fragmentation: %s", (raw, reconstructed) => {
    expect(semanticGate(raw).passed).toBe(true);
    expect(jamoSignal(raw)).toMatchObject({ technique: "JAMO", rawText: raw, normalizedText: reconstructed });
  });
});
