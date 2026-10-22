import { useId } from "react";
import type { ScanConnection } from "@krds-detector/contracts";

export function ConnectionChoice({ value, onChange, onSetup }: {
  value: ScanConnection; onChange: (connection: ScanConnection) => void; onSetup?: () => void;
}) {
  const name = useId();
  return <fieldset className="scope-options"><legend>연결 방식</legend>
    <label><input type="radio" name={name} checked={value === "direct"} onChange={() => onChange("direct")} />기본 연결 (권장) — 현재 PC 네트워크 사용</label>
    <label><input type="radio" name={name} checked={value === "warp"} onChange={() => onChange("warp")} />앱 전용 WARP — 이번 점검에만 사용</label>
    {value === "warp" ? <><p className="hint">등록과 연결 준비가 필요합니다. 연결 실패 시 기본 연결로 자동 전환하지 않습니다.</p>
      {onSetup ? <button type="button" className="secondary" onClick={onSetup}>연결 설정 열기</button> : null}</> : null}
  </fieldset>;
}
