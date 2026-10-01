import { useEffect, useRef, useState } from "react";
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

const INITIAL = initialProgress("crawling");

export function ScanProgressView({ host, sessionId, onDone, onCancel }: Props) {
  const [progress, setProgress] = useState<ScanProgress>(INITIAL);
  const [notice, setNotice] = useState<string>(
    `탐지를 시작했습니다. 현재 단계: ${INITIAL.stage}`,
  );
  const [cancelling, setCancelling] = useState(false);
  const [finishing, setFinishing] = useState(false);
  // The host emits one event per page. Only stage / confirmed-count / message
  // transitions are worth speaking aloud; the per-page counters stay in the
  // <dl> below, which is not a live region.
  const lastSpoken = useRef<string | undefined>(undefined);

  useEffect(() => {
    return host.onScanEvent((event) => {
      if (event.sessionId !== sessionId) return;
      setProgress(event.progress);
      const line = event.message
        ? `${event.message} (${event.progress.stage}, 확정된 탐지 ${event.progress.confirmedFindings}건)`
        : `현재 단계: ${event.progress.stage}, 확정된 탐지 ${event.progress.confirmedFindings}건`;
      if (line !== lastSpoken.current) {
        lastSpoken.current = line;
        setNotice(line);
      }
      if (event.kind === "session-finished") {
        setFinishing(true);
        onDone();
      }
    });
  }, [host, sessionId, onDone]);

  async function cancel() {
    setCancelling(true);
    setFinishing(true);
    try {
      await host.cancelScan(sessionId);
    } finally {
      onCancel();
    }
  }

  return (
    // aria-busy is scoped to the finishing transition only. A long-running scan
    // is a live view, not a region whose content is still settling: leaving the
    // container busy would suppress the status region nested inside it, and
    // aria-busy would stay "true" while onDone unmounts the screen.
    <main className="page" aria-busy={finishing ? "true" : undefined}>
      <p className="eyebrow">진행 상태</p>
      <h1>탐지 진행</h1>
      <p role="status" aria-live="polite">
        {notice}
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
