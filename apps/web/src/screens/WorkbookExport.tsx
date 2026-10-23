import { useRef, useState } from "react";
import type { HostBridge } from "@krds-detector/contracts";
import type { ReviewRecord } from "@krds-detector/evidence/report";
import { readReportSession } from "../report-data.js";

export function WorkbookExport({ host, sessionId, reviews, prepareReviews, onBusyChange }: {
  host: HostBridge; sessionId: string; reviews: ReviewRecord[];
  prepareReviews?: () => Promise<ReviewRecord[]>; onBusyChange?: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const save = async (): Promise<void> => {
    if (busy) return;
    setBusy(true); setError(false); setMessage("전체 결과와 현재 검토 메모로 엑셀 보고서를 만드는 중입니다.");
    onBusyChange?.(true);
    try {
      const snapshot = prepareReviews ? await prepareReviews() : reviews;
      const data = await readReportSession(host, sessionId, snapshot, !!prepareReviews);
      const { createOperationalWorkbook } = await import("@krds-detector/evidence/report");
      const bytes = await createOperationalWorkbook([data]);
      const path = await host.saveWorkbook([sessionId], bytes);
      setMessage(path ? `엑셀 보고서 저장 완료: ${path}` : "엑셀 저장을 취소했습니다. 결과와 검토 메모는 유지됩니다.");
    } catch { setError(true); setMessage("엑셀 보고서를 저장하지 못했습니다. 검토 기록의 저장 상태, 저장 위치의 권한과 여유 공간을 확인하고 다시 저장해 주세요. 공식 결과는 유지됩니다."); }
    finally { setBusy(false); onBusyChange?.(false); requestAnimationFrame(() => button.current?.focus()); }
  };
  return <div className="workbook-export"><button ref={button} type="button" className="primary" title="검색·필터와 관계없이 전체 기록과 현재 검토 메모를 저장합니다." disabled={busy} onClick={() => void save()}>엑셀 보고서 저장</button>
    {message ? <p role={error ? "alert" : "status"}>{message}</p> : null}
  </div>;
}
