import { useRef, useState } from "react";
import type { HostBridge } from "@krds-detector/contracts";
import type { ReviewRecord } from "@krds-detector/evidence/report";
import { readReportSession } from "../report-data.js";

export function WorkbookExport({ host, sessionId, reviews }: { host: HostBridge; sessionId: string; reviews: ReviewRecord[] }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const save = async (): Promise<void> => {
    if (busy) return;
    setBusy(true); setError(false); setMessage("전체 결과와 현재 검토 메모로 엑셀 보고서를 만드는 중입니다.");
    try {
      const data = await readReportSession(host, sessionId, reviews);
      const { createOperationalWorkbook } = await import("@krds-detector/evidence/report");
      const bytes = await createOperationalWorkbook([data]);
      const path = await host.saveWorkbook([sessionId], bytes);
      setMessage(path ? `엑셀 보고서 저장 완료: ${path}` : "엑셀 저장을 취소했습니다. 결과와 검토 메모는 유지됩니다.");
    } catch { setError(true); setMessage("엑셀 보고서를 저장하지 못했습니다. 저장 위치의 권한과 여유 공간을 확인하고 다시 저장해 주세요. 공식 결과는 유지됩니다."); }
    finally { setBusy(false); requestAnimationFrame(() => button.current?.focus()); }
  };
  return <div className="workbook-export"><button ref={button} type="button" className="primary" disabled={busy} onClick={() => void save()}>엑셀 보고서 저장</button>
    <p className="hint">검색·필터와 관계없이 전체 기록과 현재 검토 메모를 저장합니다.</p>
    {message ? <p role={error ? "alert" : "status"}>{message}</p> : null}
  </div>;
}
