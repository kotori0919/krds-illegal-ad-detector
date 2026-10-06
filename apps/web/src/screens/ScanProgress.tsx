import { useEffect, useRef, useState } from "react";
import {
  initialProgress,
  type HostBridge,
  type ScanProgress,
  type ScanActivity,
} from "@krds-detector/contracts";
import { formatElapsed, scanStatusLabel } from "../scan-format.js";

interface Props {
  host: HostBridge;
  sessionId: string;
  onDone: () => void;
  onCancel: () => void;
}

const INITIAL = initialProgress("running");

function activityLabel(activity: ScanActivity): string {
  switch (activity.kind) {
    case "session-started": return "점검 시작";
    case "finding-confirmed": return `탐지 ${String(activity.findingCount ?? 0)}건`;
    case "page-failed": return "페이지 확인 실패";
    case "stage-changed": return scanStatusLabel(activity.stage);
    case "session-finished": return "점검 완료";
    case "session-cancelled": return "점검 중지됨";
    case "session-failed": return "점검 실패";
  }
}

export function ScanProgressView({ host, sessionId, onDone, onCancel }: Props) {
  const [progress, setProgress] = useState<ScanProgress>(INITIAL);
  const [notice, setNotice] = useState<string>(
    "점검 준비 중",
  );
  const [entryUrl, setEntryUrl] = useState("");
  const [elapsedSec, setElapsedSec] = useState(0);
  const [pollUnavailable, setPollUnavailable] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelError, setCancelError] = useState<string | undefined>(undefined);
  const [finishing, setFinishing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [hasResult, setHasResult] = useState(false);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (confirmCancel) confirmRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [confirmCancel]);

  useEffect(() => {
    if (cancelError) cancelButtonRef.current?.focus();
  }, [cancelError]);

  useEffect(() => {
    let disposed = false;
    let settled = false;
    let polling = false;
    let sequence = -1;
    let lastSpoken = "";
    let pendingNotice = "";
    let noticeTimer: ReturnType<typeof setTimeout> | undefined;
    const announce = (): void => {
      noticeTimer = undefined;
      if (disposed || pendingNotice === lastSpoken) return;
      lastSpoken = pendingNotice;
      setNotice(lastSpoken);
    };
    let clock = { base: 0, at: performance.now(), active: true };
    const acceptProgress = (next: ScanProgress): void => {
      if (disposed || settled || next.sequence <= sequence) return;
      sequence = next.sequence;
      setProgress(next);
      const now = performance.now();
      clock = { base: Math.max(next.elapsedSec, clock.base + (clock.active ? (now - clock.at) / 1000 : 0)), at: now,
        active: !["succeeded", "failed", "cancelled"].includes(next.stage) };
      setElapsedSec(clock.base);
      const line = `${scanStatusLabel(next.stage)} · 탐지 ${String(next.confirmedFindings)}건${next.failedPages ? ` · 페이지 실패 ${String(next.failedPages)}개` : ""}`;
      pendingNotice = line;
      if (!lastSpoken || !clock.active) {
        clearTimeout(noticeTimer);
        announce();
      } else if (line !== lastSpoken && noticeTimer === undefined) {
        noticeTimer = setTimeout(announce, 2000);
      }
    };
    const onTick = async (): Promise<void> => {
      if (polling || disposed || settled) return;
      polling = true;
      try {
        const s = await host.getSession(sessionId);
        if (disposed || settled) return;
        if (!s) { setPollUnavailable(true); return; }
        setPollUnavailable(false);
        setEntryUrl(s.entryUrl);
        acceptProgress(s.progress);
        if (s.status === "succeeded") {
          settled = true;
          setFinishing(true);
          clearInterval(timer);
          onDone();
        } else if (s.status === "failed") {
          settled = true;
          setFailed(true);
          setHasResult(s.hasResult === true);
          setNotice("점검 실패");
          clearInterval(timer);
        } else if (s.status === "cancelled") {
          settled = true;
          clearInterval(timer);
          if (s.hasResult === true) onDone();
          else onCancel();
        }
      } catch {
        if (!disposed) setPollUnavailable(true);
      } finally { polling = false; }
    };
    const timer = setInterval(() => { void onTick(); }, 2000);
    const clockTimer = setInterval(() => {
      if (clock.active && !settled) setElapsedSec(clock.base + (performance.now() - clock.at) / 1000);
    }, 1000);
    const stop = host.onScanEvent((event) => {
      if (event.sessionId !== sessionId) return;
      acceptProgress(event.progress);
      // Navigation is poll-driven ONLY: the poll reads the terminal
      // session status and stored-result availability. Reacting to worker events caused
      // empty-result races (OBSERVED: cancel landed on running/empty).
    });
    void onTick();
    return () => {
      disposed = true;
      stop();
      clearInterval(timer);
      clearInterval(clockTimer);
      clearTimeout(noticeTimer);
    };
  }, [host, sessionId, onDone, onCancel]);

  async function cancel() {
    setConfirmCancel(false);
    setCancelError(undefined);
    setCancelling(true);
    try {
      await host.cancelScan(sessionId);
      // The session poll owns navigation after the host confirms settlement.
    } catch {
      setCancelling(false);
      setCancelError("중지 요청 실패. 다시 시도해 주세요.");
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
      {entryUrl ? <p className="lede">{entryUrl}</p> : null}
      <p role="status" aria-live="polite" className="scan-status">
        {elapsedSec >= 1 && !failed && !finishing ? <span className="krds-spinner" aria-hidden="true" /> : null}
        <span>{cancelling && !failed ? "중지 처리 중" : notice}</span>
      </p>
      {pollUnavailable ? <p role="alert" className="error">진행 상태 조회 실패. 다시 연결하는 중입니다.</p> : null}
      {failed ? (
        <p role="alert" className="error">
          시작 주소와 접속 상태를 확인해 주세요.
        </p>
      ) : null}
      <section aria-label="탐지 현황">
        <dl className="stats">
          <div>
            <dt>확인한 페이지</dt>
            <dd>{Math.max(0, progress.visitedPages - progress.failedPages)}</dd>
          </div>
          <div>
            <dt>대기 중인 페이지</dt>
            <dd>{progress.queuedPages}</dd>
          </div>
          <div>
            <dt>탐지</dt>
            <dd>{progress.confirmedFindings}</dd>
          </div>
          <div>
            <dt>실패한 페이지</dt>
            <dd>{progress.failedPages}</dd>
          </div>
          <div><dt>경과 시간</dt><dd>{formatElapsed(elapsedSec)}</dd></div>
        </dl>
      </section>
      {progress.currentPages.length ? <section aria-label="현재 확인 중">
        <h2>현재 확인 중</h2>
        <ul className="progress-pages">{progress.currentPages.map((url) => <li key={url}>{url}</li>)}</ul>
      </section> : null}
      {progress.recentActivity.length ? <section aria-label="최근 활동">
        <h2>최근 활동</h2>
        <ol className="progress-activity">{progress.recentActivity.map((activity) => <li key={activity.sequence}>
          <span>{formatElapsed(activity.elapsedSec)} · {activityLabel(activity)}</span>
          {activity.pageUrl ? <span className="hint">{activity.pageUrl}</span> : null}
        </li>)}</ol>
      </section> : null}
      <details className="advanced"><summary>기술 정보</summary>
        <dl className="stats">
          <div><dt>검사한 프레임</dt><dd>{progress.framesInspected}</dd></div>
          <div><dt>분석한 요소</dt><dd>{progress.elementsAnalyzed}</dd></div>
          <div><dt>탐지 후보</dt><dd>{progress.candidates}</dd></div>
        </dl>
      </details>
      <div className="actions">
        {cancelError ? <p role="alert" className="error">{cancelError}</p> : null}
        {failed ? <>{hasResult ? <button type="button" onClick={onDone} className="primary">완료된 결과 보기</button> : null}
          <button type="button" onClick={onCancel} className={hasResult ? "secondary" : "primary"}>새로 검사하기</button></>
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
        <p>완료된 페이지의 결과는 유지됩니다. 진행 중인 페이지의 확인을 종료합니다.</p>
        <div className="actions"><button type="button" className="secondary" onClick={closeConfirmation}>계속 점검</button>{" "}
          <button type="button" className="primary" onClick={cancel}>점검 중지 확인</button></div>
      </div></div> : null}
    </main>
  );
}
