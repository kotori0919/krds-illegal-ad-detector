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
  const [progress, setProgress] = useState<ScanProgress>(
    initialProgress("crawling"),
  );
  const [notice, setNotice] = useState<string | undefined>(undefined);

  useEffect(() => {
    return host.onScanEvent((event) => {
      if (event.sessionId !== sessionId) return;
      setProgress(event.progress);
      if (event.message) setNotice(event.message);
    });
  }, [host, sessionId]);

  async function cancel() {
    await host.cancelScan(sessionId);
    onCancel();
  }

  return (
    <main className="page" aria-busy="true">
      <h1>탐지 진행</h1>
      {notice ? <p role="status">{notice}</p> : null}
      <dl>
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
          <dd>{progress.elapsedSec}</dd>
        </div>
      </dl>
      <button type="button" onClick={cancel}>
        탐지 취소
      </button>{" "}
      <button type="button" onClick={onDone}>
        결과 보기(미리보기)
      </button>
    </main>
  );
}
