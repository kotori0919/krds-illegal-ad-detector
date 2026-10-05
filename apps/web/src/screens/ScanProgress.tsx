import { useEffect, useRef, useState } from "react";
import {
  initialProgress,
  type HostBridge,
  type ScanProgress,
  type ScanStatus,
} from "@krds-detector/contracts";

interface Props {
  host: HostBridge;
  sessionId: string;
  onDone: () => void;
  onCancel: () => void;
}

const INITIAL = initialProgress("running");
const stageLabel = (stage: ScanStatus): string => ({
  queued: "점검 준비 중",
  running: "페이지를 찾고 콘텐츠를 분석하는 중",
  finalizing: "결과를 정리하는 중",
  succeeded: "점검 완료",
  cancelled: "점검 중지됨",
  failed: "점검 실패",
}[stage]);

type IntervalHandle = ReturnType<typeof globalThis.setInterval>;

export function ScanProgressView({ host, sessionId, onDone, onCancel }: Props) {
  const [progress, setProgress] = useState<ScanProgress>(INITIAL);
  const [notice, setNotice] = useState<string>(
    "사이트 점검을 시작했습니다.",
  );
  const [recentPage, setRecentPage] = useState<string | undefined>(undefined);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelError, setCancelError] = useState<string | undefined>(undefined);
  const [finishing, setFinishing] = useState(false);
  const [failed, setFailed] = useState(false);
  // The host emits one event per page. Only stage / confirmed-count / message
  // transitions are worth speaking aloud; the per-page counters stay in the
  // <dl> below, which is not a live region.
  const lastSpoken = useRef<string | undefined>(undefined);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (confirmCancel) confirmRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [confirmCancel]);

  useEffect(() => {
    const onTick = (): void => {
      void host.getSession(sessionId).then((s) => {
        if (!s) return;
        if (s.status === "succeeded") {
          setFinishing(true);
          clearInterval(timer);
          onDone();
        } else if (s.status === "failed") {
          setFailed(true);
          setNotice(`탐지가 실패했습니다: ${s.error ?? "알 수 없는 오류"}`);
          clearInterval(timer);
        } else if (s.status === "cancelled") {
          clearInterval(timer);
          onCancel();
        }
      }).catch(() => undefined);
    };
    const timer: IntervalHandle = setInterval(onTick, 2000);
    const stop = host.onScanEvent((event) => {
      if (event.sessionId !== sessionId) return;
      setProgress(event.progress);
      if (event.kind === "page-visited" && event.pageUrl) setRecentPage(event.pageUrl);
      const line = `${stageLabel(event.progress.stage)}. 확인한 페이지 ${String(event.progress.visitedPages)}개, 탐지 후보 ${String(event.progress.confirmedFindings)}건.`;
      if (["stage-changed", "finding-confirmed", "session-failed"].includes(event.kind) && line !== lastSpoken.current) {
        lastSpoken.current = line;
        setNotice(line);
      }
      // Navigation is poll-driven ONLY: the poll reads the terminal
      // session status and routes (succeeded→result, cancelled→start,
      // failed→stays with error). Reacting to worker events here caused
      // empty-result races (OBSERVED: cancel landed on running/empty).
      void event;
    });
    return () => {
      stop();
      clearInterval(timer);
    };
  }, [host, sessionId, onDone, onCancel]);

  async function cancel() {
    setConfirmCancel(false);
    setCancelling(true);
    setNotice("점검 중지를 요청했습니다. 종료 상태를 확인하는 중입니다.");
    try {
      await host.cancelScan(sessionId);
      // The session poll owns navigation after the host confirms settlement.
    } catch (error) {
      setCancelling(false);
      setCancelError(error instanceof Error ? error.message : "중지 요청에 실패했습니다. 다시 시도해 주세요.");
    }
  }

  function closeConfirmation() {
    setConfirmCancel(false);
    requestAnimationFrame(() => cancelButtonRef.current?.focus());
  }

  return (
    // aria-busy is scoped to the finishing transition only. A long-running scan
    // is a live view, not a region whose content is still settling: leaving the
    // container busy would suppress the status region nested inside it, and
    // aria-busy would stay "true" while onDone unmounts the screen.
    <main className="page" aria-busy={finishing ? "true" : undefined}>
      <div inert={confirmCancel}>
      <p className="eyebrow">진행 상태</p>
      <h1>사이트 점검</h1>
      <p role="status" aria-live="polite">
        {notice}
      </p>
      {failed ? (
        <p role="alert" className="error">
          이번 점검의 결과 파일을 만들지 못했습니다. 시작 주소와 접속 상태를 확인한 뒤 다시 점검해 주세요.
        </p>
      ) : null}
      <section aria-label="탐지 현황" aria-describedby="progress-hint">
        <p id="progress-hint" className="hint">
          전체 작업량을 미리 알 수 없어 백분율 대신 실제 개수를 표시합니다.
        </p>
        <dl className="stats">
          <div>
            <dt>현재 단계</dt>
            <dd>{stageLabel(progress.stage)}</dd>
          </div>
          <div>
            <dt>확인한 페이지</dt>
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
          {recentPage ? <div><dt>최근 확인한 페이지</dt><dd>{recentPage}</dd></div> : null}
        </dl>
      </section>
      <div className="actions">
        {cancelError ? <p role="alert" className="error">{cancelError}</p> : null}
        {failed ? <button type="button" onClick={onCancel} className="primary">새로 검사하기</button>
          : <button ref={cancelButtonRef} type="button" onClick={() => setConfirmCancel(true)} disabled={cancelling} className="secondary">
            {cancelling ? "중지 처리 중…" : "점검 중지"}
          </button>}
      </div>
      </div>
      {confirmCancel ? <div className="modal-backdrop"><div ref={confirmRef} role="dialog" aria-modal="true" aria-labelledby="cancel-title" className="modal-panel"
        onKeyDown={(event) => {
          if (event.key === "Escape") { event.preventDefault(); closeConfirmation(); }
          if (event.key === "Tab") {
            const buttons = [...(confirmRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
            if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[buttons.length - 1]?.focus(); }
            else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) { event.preventDefault(); buttons[0]?.focus(); }
          }
        }}>
        <h2 id="cancel-title">점검을 중지할까요?</h2>
        <p>지금 중지하면 이번 점검의 결과 파일은 생성되지 않습니다.</p>
        <div className="actions"><button type="button" className="secondary" onClick={closeConfirmation}>계속 점검</button>{" "}
          <button type="button" className="primary" onClick={cancel}>점검 중지 확인</button></div>
      </div></div> : null}
    </main>
  );
}
