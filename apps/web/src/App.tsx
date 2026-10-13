import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HostBridge, HostCapabilities } from "@krds-detector/contracts";
import { createHost } from "./host/index.js";
import { ScanStart } from "./screens/ScanStart.js";
import { ScanProgressView } from "./screens/ScanProgress.js";
import { ScanResult } from "./screens/ScanResult.js";
import type { OfficialTechnique } from "@krds-detector/contracts";
import { EvidenceView } from "./screens/EvidenceView.js";
import { ExportDialog } from "./screens/ExportDialog.js";
import { BatchWorkspace } from "./screens/BatchWorkspace.js";
import { stepStates, type Phase } from "./steps.js";
import { useCaseReview } from "./useCaseReview.js";
import { SavedCases } from "./screens/SavedCases.js";

const narrowInspector = () => window.matchMedia?.("(max-width: 63.999rem)").matches ?? false;

export function App() {
  const [phase, setPhase] = useState<Phase>("start");
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchMounted, setBatchMounted] = useState(false);
  const [batchResult, setBatchResult] = useState(false);
  const [findingId, setFindingId] = useState<string | undefined>(undefined);
  const [selectionOrigin, setSelectionOrigin] = useState<"list" | "relation">("list");
  const [findingContext, setFindingContext] = useState<string[]>([]);
  const [restoreFindingId, setRestoreFindingId] = useState<string | undefined>(undefined);
  const [exportOpen, setExportOpen] = useState(false);
  const [resultQuery, setResultQuery] = useState("");
  const [resultFilter, setResultFilter] = useState<OfficialTechnique | "ALL">("ALL");
  const [resultView, setResultView] = useState<"findings" | "pages" | "extra" | "coverage">("findings");
  const [host, setHost] = useState<HostBridge | undefined>(undefined);
  const [capabilities, setCapabilities] = useState<HostCapabilities>();
  const caseReview = useCaseReview(host, sessionId, !!capabilities?.filesystem && (phase === "result" || phase === "evidence"));
  const reviewRecords = caseReview.records;
  const reviewSessions = caseReview.sessions;
  const setReviewRecords = caseReview.edit;
  const reviewedIds = useMemo(() => new Set(Object.values(reviewRecords).filter((record) => record.state === "reviewed").map((record) => record.findingId)), [reviewRecords]);
  const reviewMany = (ids: string[], reviewed: boolean): void => setReviewRecords((previous) => {
    const next = { ...previous };
    const at = new Date().toISOString();
    for (const id of ids) next[id] = { findingId: id, state: reviewed ? "reviewed" : "needed", judgment: previous[id]?.judgment ?? "unjudged", note: previous[id]?.note ?? "", at };
    return next;
  });
  const resultScrollY = useRef(0);
  const relationInvoker = useRef<HTMLElement | null>(null);
  const scrollFrame = useRef<number | undefined>(undefined);

  const scheduleScroll = useCallback((y: number) => {
    if (scrollFrame.current !== undefined) cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = requestAnimationFrame(() => {
      scrollFrame.current = undefined;
      window.scrollTo(0, y);
    });
  }, []);

  useEffect(() => () => {
    if (scrollFrame.current !== undefined) cancelAnimationFrame(scrollFrame.current);
  }, []);

  useEffect(() => {
    let alive = true;
    createHost().then(async (h) => {
      const available = await h.getCapabilities();
      if (alive) { setCapabilities(available); setHost(h); }
    });
    return () => {
      alive = false;
    };
  }, []);

  const go = useCallback((next: Phase) => {
    setPhase(next);
  }, []);

  const goResult = useCallback(() => go("result"), [go]);
  const closeHiddenSelection = useCallback(() => {
    const active = document.activeElement;
    const keepFocus = active instanceof HTMLElement && active !== document.body && !active.closest(".result-inspector");
    setFindingId(undefined);
    go("result");
    requestAnimationFrame(() => {
      if (keepFocus && document.contains(active)) return;
      const target = document.getElementById("result-search")
        ?? document.querySelector<HTMLElement>('.result-navigation button[aria-pressed="true"]');
      target?.focus();
    });
  }, [go]);
  const goResultFromEvidence = useCallback(() => {
    setRestoreFindingId(selectionOrigin === "relation" ? undefined : findingId);
    go("result");
    if (narrowInspector()) scheduleScroll(resultScrollY.current);
    if (selectionOrigin === "relation") requestAnimationFrame(() => {
      const invoker = relationInvoker.current;
      const target = invoker?.isConnected && !invoker.closest("[hidden]") ? invoker
        : document.querySelector<HTMLElement>('.result-navigation button[aria-pressed="true"]');
      target?.focus({ preventScroll: true });
    });
  }, [findingId, selectionOrigin, go, scheduleScroll]);
  /** Cancel/restart resets the whole flow, so completion state resets too. */
  const goStart = useCallback(() => {
    if (scrollFrame.current !== undefined) cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = undefined;
    setPhase("start");
    resultScrollY.current = 0;
    relationInvoker.current = null;
    setResultQuery("");
    setResultFilter("ALL");
    setResultView("findings");
    setRestoreFindingId(undefined);
    setExportOpen(false);
    setFindingContext([]);
  }, []);

  const closeExport = useCallback(() => {
    setExportOpen(false);
    requestAnimationFrame(() => document.getElementById("export-trigger")?.focus());
  }, []);

  const steps = stepStates(phase);

  if (!host) {
    return (
      <main className="page">
        <p role="status">실행 환경을 확인하는 중입니다…</p>
      </main>
    );
  }
  return (
    <>
      <div inert={exportOpen}>
      <header className="app-header">
        <div className="app-header-inner"><span className="app-symbol" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="10" cy="10" r="6" /><path d="m14.5 14.5 6 6M7 10l2 2 4-4" /></svg></span>
          <div><strong>불법광고 탐지 도구</strong><span>웹사이트 점검 · 근거 검토</span></div>
          {!capabilities?.localScan ? <span className="environment-label">화면 미리보기</span> : null}
        </div>
      </header>
      {batchMounted ? <div hidden={!batchOpen}><BatchWorkspace host={host} reviews={reviewSessions}
        onBack={() => { setBatchOpen(false); setBatchResult(false); goStart(); }}
        onInspect={(id) => { setSessionId(id); setBatchResult(true); setBatchOpen(false); setFindingId(undefined);
          setResultQuery(""); setResultFilter("ALL"); setResultView("findings"); setFindingContext([]); setRestoreFindingId(undefined); go("result"); }} /></div> : null}
      <div hidden={batchOpen}>
      <nav aria-label="탐지 단계" className="steps-nav">
        <ol className="steps">
          {steps.map((s) => (
            <li key={s.id} aria-current={s.current ? "step" : undefined} className={s.className}>
              <span aria-hidden="true" className="step-number">{s.done ? <span className="done-check">✓</span> : steps.indexOf(s) + 1}</span>
              {s.done && <span className="sr-only">완료 </span>}
              {s.label}
            </li>
          ))}
        </ol>
      </nav>
      {phase === "progress" && sessionId ? (
        <ScanProgressView
          host={host}
          sessionId={sessionId}
          onDone={goResult}
          onCancel={goStart}
        />
      ) : (phase === "result" || phase === "evidence") && sessionId ? (
        <div className={`result-workspace${phase === "evidence" ? " inspecting" : ""}`}>
        <div className="result-workspace-list">
        {capabilities?.filesystem ? <section className="case-storage" aria-label="케이스 보관 상태">
          <details className="advanced"><summary><span role="status">{caseReview.status === "saved" ? `검토 기록 저장됨 · 수정 번호 ${caseReview.opened?.review.revision ?? 0}`
            : caseReview.status === "saving" ? "검토 기록 저장 중" : caseReview.status === "unsaved" ? "검토 기록 저장 대기"
              : caseReview.status === "error" ? "검토 기록 저장 확인 필요" : "케이스 보관 확인 중"}</span> · 보관 정보</summary>
          {caseReview.opened ? <><p>저장 폴더: {caseReview.opened.directory}</p><p>공식 결과: {caseReview.opened.directory}/result.json · 원본은 검토 판단과 별도로 보존됩니다.</p>
            {caseReview.opened.manifest.issues.length ? <p role="note">일부 근거 사용 제한: {caseReview.opened.manifest.issues.map((issue) => `${issue.scope} (${issue.code})`).join(" · ")}. 공식 결과를 계속 검토할 수 있습니다.</p> : null}</> : null}
          </details>
          {caseReview.status === "error" ? <><p role="alert">검토 기록을 저장하거나 불러오지 못했습니다. 작성 중인 메모는 이 화면에 유지됩니다. 저장 실패·다른 창의 수정 충돌·브라우저 미리보기 여부를 확인해 주세요.</p><button type="button" className="secondary" onClick={caseReview.retry}>현재 메모를 유지하고 저장 재시도</button><p className="hint">다른 창의 변경을 다시 읽고 현재 수정한 항목을 반영합니다. 같은 항목을 수정했다면 현재 화면의 내용을 저장합니다.</p></> : null}
        </section> : null}
        <ScanResult
          host={host}
          sessionId={sessionId}
          query={resultQuery}
          onQueryChange={setResultQuery}
          filter={resultFilter}
          onFilterChange={setResultFilter}
          view={resultView}
          onViewChange={setResultView}
          reviewedIds={reviewedIds}
          onReviewMany={reviewMany}
          reviewRecords={Object.values(reviewRecords)}
          restoreFindingId={restoreFindingId}
          selectedFindingId={phase === "evidence" ? findingId : undefined}
          allowHiddenSelection={selectionOrigin === "relation"}
          onSelectionHidden={closeHiddenSelection}
          onFocusRestored={() => setRestoreFindingId(undefined)}
          onEvidence={(id, context, origin = "list") => {
            relationInvoker.current = origin === "relation" && document.activeElement instanceof HTMLElement
              ? document.activeElement : null;
            if (phase === "result" && narrowInspector()) resultScrollY.current = window.scrollY;
            setFindingId(id);
            setSelectionOrigin(origin);
            setFindingContext(context ?? [id]);
            go("evidence");
            if (phase === "result" && narrowInspector()) scheduleScroll(0);
          }}
          onExport={() => setExportOpen(true)}
          onRestart={batchResult ? () => { setFindingId(undefined); setBatchOpen(true); } : goStart}
          restartLabel={batchResult ? "일괄 점검 현황으로 돌아가기" : undefined}
        />
        </div>
        {phase === "evidence" && findingId ? <EvidenceView
          key={findingId}
          host={host}
          sessionId={sessionId}
          findingId={findingId}
          contextIds={findingContext}
          onSelectFinding={(id) => { setFindingId(id); if (!findingContext.includes(id)) { setFindingContext([id]); setSelectionOrigin("relation"); } }}
          reviewed={reviewedIds.has(findingId)}
          onReviewChange={(reviewed) => reviewMany([findingId], reviewed)}
          note={reviewRecords[findingId]?.note ?? ""}
          judgment={reviewRecords[findingId]?.judgment ?? "unjudged"}
          onJudgmentChange={(judgment) => setReviewRecords((previous) => ({ ...previous,
            [findingId]: { findingId, state: previous[findingId]?.state ?? "needed", judgment, note: previous[findingId]?.note ?? "", at: new Date().toISOString() } }))}
          onNoteChange={(note) => setReviewRecords((previous) => ({ ...previous,
            [findingId]: { findingId, state: previous[findingId]?.state ?? "needed", judgment: previous[findingId]?.judgment ?? "unjudged", note, at: new Date().toISOString() } }))}
          onBack={goResultFromEvidence}
        /> : null}
        </div>
      ) : (
        <><ScanStart
          host={host}
          showSavedCases={!!capabilities?.filesystem}
          onBatch={() => { setBatchMounted(true); setBatchOpen(true); }}
          onStarted={(id) => {
            setBatchResult(false);
            setSessionId(id);
            go("progress");
          }}
        /><SavedCases host={host} onOpen={async (id) => {
          await host.openCase(id);
          setBatchResult(false); setSessionId(id); setFindingId(undefined); setResultQuery(""); setResultFilter("ALL");
          setResultView("findings"); setFindingContext([]); setRestoreFindingId(undefined); go("result");
        }} /></>
      )}
      </div>
      </div>
      {(phase === "result" || phase === "evidence") && exportOpen && sessionId ? (
        <ExportDialog host={host} sessionId={sessionId} onClose={closeExport} />
      ) : null}
    </>
  );
}
