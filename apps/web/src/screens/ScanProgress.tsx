import { useEffect, useState } from "react";
import {
  initialProgress,
  type HostBridge,
  type ScanProgress,
} from "@krds-detector/contracts";

interface Props {
  host: HostBridge;
  sessionId: string;
  onDone: () => void;
  onCancel: () => void;
}

export function ScanProgressView({ host, sessionId, onDone, onCancel }: Props) {
  const [progress, setProgress] = useState<ScanProgress>(initialProgress("crawling"));
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    return host.onScanEvent((event) => {
      if (event.sessionId !== sessionId) return;
      setProgress(event.progress);
      if (event.message) setNotice(event.message);
      if (event.kind === "session-finished") onDone();
    });
  }, [host, sessionId, onDone]);

  async function cancel() {
    setCancelling(true);
    try {
      await host.cancelScan(sessionId);
    } finally {
      onCancel();
    }
  }

  return (
    <main className="page" aria-busy="true">
      <p className="eyebrow">진행 상태</p>
      <h1>탐지 진행</h1>
      <p role="status" aria-live="polite">
        {notice ?? `현재 단계: ${progress.stage}, 확정된 탐지 ${progress.confirmedFindings}건`}
      </p>
      <section aria-label="탐지 현황" aria-describedby="progress-hint">
        <p id="progress-hint" className="hint">
          전체 작업량을 미리 알 수 없어 백분율 대신 실제 개수를 표시합니다.
        </p>
        <dl className="stats">
          <div>
            <dt>현재 단계</dt>
            <dd>{progress.stage}</dd>
          </div>
          <div>
            <dt>방문한 페이지</dt>
            <dd>{progress.visitedPages}</dd>
          </div>
          <div>
            <dt>대기 중인 페이지</dt>
            <dd>{progress.queuedPages}</dd>
          </div>
          <div>
            <dt>검사한 프레임</dt>
            <dd>{progress.framesInspected}</dd>
          </div>
          <div>
            <dt>분석한 요소</dt>
            <dd>{progress.elementsAnalyzed}</dd>
          </div>
          <div>
            <dt>후보</dt>
            <dd>{progress.candidates}</dd>
          </div>
          <div>
            <dt>확정된 탐지</dt>
            <dd>{progress.confirmedFindings}</dd>
          </div>
          <div>
            <dt>경과 시간(초)</dt>
            <dd>{Math.round(progress.elapsedSec)}</dd>
          </div>
        </dl>
      </section>
      <div className="actions">
        <button type="button" onClick={cancel} disabled={cancelling} className="secondary">
          {cancelling ? "취소 중…" : "탐지 취소"}
        </button>{" "}
        <button type="button" onClick={onDone} className="primary">
          결과 보기
        </button>
      </div>
    </main>
  );
}
