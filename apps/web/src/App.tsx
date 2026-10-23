import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HostBridge, HostCapabilities, ScanConnection } from "@krds-detector/contracts";
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
import { InfrastructureAnalysis } from "./screens/InfrastructureAnalysis.js";
import { WarpSetup } from "./screens/WarpSetup.js";

const narrowInspector = () => window.matchMedia?.("(max-width: 63.999rem)").matches ?? false;

type UiMode = "simple" | "advanced";
type Section = "scan" | "saved" | "infrastructure" | "settings";
const MODE_KEY = "inspection.uiMode";
function savedMode(): UiMode | undefined {
  try { const value = window.localStorage?.getItem(MODE_KEY); return value === "simple" || value === "advanced" ? value : undefined; }
  catch { return undefined; }
}

export function App() {
  const [mode, setMode] = useState<UiMode | undefined>(savedMode);
  const [selectedMode, setSelectedMode] = useState<UiMode>("simple");
  const [preferenceError, setPreferenceError] = useState("");
  const [section, setSection] = useState<Section>("scan");
  const [infrastructureId, setInfrastructureId] = useState<string>();
  const [evidenceReturn, setEvidenceReturn] = useState<"result" | "infrastructure">("result");
  const [starting, setStarting] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);
  const [fileBusy, setFileBusy] = useState(false);
  const [reviewTransition, setReviewTransition] = useState(false);
  const [startGeneration, setStartGeneration] = useState(0);
  const [scanConnection, setScanConnection] = useState<ScanConnection>("direct");
  const [modeNotice, setModeNotice] = useState("");
  const simple = mode === "simple";
  const busy = starting || scanBusy || batchBusy || fileBusy || reviewTransition;
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
  const caseReview = useCaseReview(host, sessionId, !!capabilities?.filesystem && section === "scan" && !batchOpen && (phase === "result" || phase === "evidence"));
  const reviewRecords = caseReview.records;
  const reviewSessions = caseReview.sessions;
  const setReviewRecords = caseReview.edit;
  const reviewedIds = useMemo(() => new Set(Object.values(reviewRecords).filter((record) => record.state === "reviewed").map((record) => record.findingId)), [reviewRecords]);
  const reviewMany = (ids: string[], reviewed: boolean): void => { if (fileBusy) return; setReviewRecords((previous) => {
    const next = { ...previous };
    const at = new Date().toISOString();
    for (const id of ids) next[id] = { findingId: id, state: reviewed ? "reviewed" : "needed", judgment: previous[id]?.judgment ?? "unjudged", note: previous[id]?.note ?? "", at };
    return next;
  }); };
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

  const goResult = useCallback(() => { setScanBusy(false); go("result"); }, [go]);
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
    if (evidenceReturn === "infrastructure") {
      setSection("infrastructure"); go("result");
      requestAnimationFrame(() => relationInvoker.current?.focus({ preventScroll: true }));
      return;
    }
    setRestoreFindingId(selectionOrigin === "relation" ? undefined : findingId);
    go("result");
    if (narrowInspector()) scheduleScroll(resultScrollY.current);
    if (selectionOrigin === "relation") requestAnimationFrame(() => {
      const invoker = relationInvoker.current;
      const target = invoker?.isConnected && !invoker.closest("[hidden]") ? invoker
        : document.querySelector<HTMLElement>('.result-navigation button[aria-pressed="true"]');
      target?.focus({ preventScroll: true });
    });
  }, [findingId, selectionOrigin, go, scheduleScroll, evidenceReturn]);
  /** Cancel/restart resets the whole flow, so completion state resets too. */
  const goStart = useCallback(() => {
    if (scrollFrame.current !== undefined) cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = undefined;
    setPhase("start");
    setSection("scan"); setBatchOpen(false); setScanBusy(false);
    setSessionId(undefined); setFindingId(undefined); setEvidenceReturn("result");
    setStartGeneration((value) => value + 1);
    setScanConnection("direct"); setModeNotice("");
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
  const showWarpSetup = () => setSection("settings");
  const applyMode = (next: UiMode) => {
    setMode(next); setPreferenceError("");
    setModeNotice(next === "simple" && (resultFilter !== "ALL" || resultView === "pages")
      ? "간단 모드로 전환하며 기법 필터와 페이지별 보기를 해제했습니다. 검색과 검토 기록은 유지됩니다." : "");
    try {
      if (!window.localStorage) throw new Error("Preferences unavailable");
      window.localStorage.setItem(MODE_KEY, next);
    } catch { setPreferenceError("화면 모드 선택을 저장하지 못했습니다. 이번 실행에는 적용되며 다음 실행 때 다시 선택할 수 있습니다."); }
    if (next === "simple") {
      setResultFilter("ALL");
      if (resultView === "pages") setResultView("findings");
      setEvidenceReturn("result");
      if (section === "infrastructure" || section === "settings") setSection("scan");
      if (batchOpen) { setBatchOpen(false); goStart(); }
    }
  };
  const openStored = async (id: string, infrastructure = false) => {
    setStarting(true);
    try {
    await host?.openCase(id);
    setBatchResult(false); setSessionId(id); setFindingId(undefined); setResultQuery(""); setResultFilter("ALL");
    setResultView("findings"); setFindingContext([]); setRestoreFindingId(undefined); setEvidenceReturn("result"); go("result");
    if (infrastructure) { setInfrastructureId(id); setSection("infrastructure"); }
    else setSection("scan");
    } finally { setStarting(false); }
  };
  const openInfrastructure = () => {
    if ((phase === "result" || phase === "evidence") && sessionId) setInfrastructureId(sessionId);
    else setInfrastructureId(undefined);
    setSection("infrastructure");
  };
  const prepareReviews = async () => capabilities?.filesystem ? caseReview.prepareExport() : Object.values(reviewRecords);

  if (!host) {
    return (
      <main className="page">
        <p role="status">실행 환경을 확인하는 중입니다…</p>
      </main>
    );
  }
  if (!mode) return <main className="page mode-setup">
    <p className="eyebrow">불법광고 탐지 도구</p>
    <h1>어떤 방식으로 사용하시겠습니까?</h1>
    <p className="lede">처음이라면 간단 모드로 시작하세요. 탐지 기능은 두 모드에서 같습니다.</p>
    <fieldset className="scope-options"><legend>사용 방식</legend>
      <label className={selectedMode === "simple" ? "is-selected" : undefined}><input type="radio" name="initial-mode" checked={selectedMode === "simple"} onChange={() => setSelectedMode("simple")} /><span><strong>간단 모드</strong><span>사이트 점검, 근거 확인, 보고서 저장</span></span></label>
      <label className={selectedMode === "advanced" ? "is-selected" : undefined}><input type="radio" name="initial-mode" checked={selectedMode === "advanced"} onChange={() => setSelectedMode("advanced")} /><span><strong>고급 모드</strong><span>상세 설정, 여러 사이트 점검, 인프라 분석</span></span></label>
    </fieldset>
    <p className="hint">화면 위의 모드 선택에서 언제든 변경할 수 있습니다.</p>
    <button type="button" className="primary" onClick={() => applyMode(selectedMode)}>시작하기</button>
  </main>;
  return (
    <div className={simple ? "app-shell simple-mode" : "app-shell advanced-mode"}>
      <div inert={exportOpen}>
      <header className="app-header">
        <div className="app-header-inner"><span className="app-symbol" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="10" cy="10" r="6" /><path d="m14.5 14.5 6 6M7 10l2 2 4-4" /></svg></span>
          <div><strong>불법광고 탐지 도구</strong><span>웹사이트 점검 · 근거 검토</span></div>
          <div className="mode-control"><label htmlFor="ui-mode">화면 모드</label><select id="ui-mode" value={mode} disabled={busy} onChange={(event) => applyMode(event.target.value === "advanced" ? "advanced" : "simple")}>
            <option value="simple">간단 모드</option><option value="advanced">고급 모드</option>
          </select></div>
          <button type="button" className="secondary" disabled={busy} onClick={() => setSection(section === "settings" ? "scan" : "settings")}>설정·도움말</button>
          {!capabilities?.localScan ? <span className="environment-label">화면 미리보기</span> : null}
        </div>
      </header>
      {preferenceError ? <p role="status" className="page">{preferenceError}</p> : null}
      {modeNotice ? <p role="status" className="page">{modeNotice}</p> : null}
      <nav className="workspace-nav" aria-label="주요 업무">
        <button type="button" disabled={busy} aria-current={section === "scan" ? "page" : undefined} onClick={goStart}>새 점검</button>
        <button type="button" disabled={busy} aria-current={section === "saved" ? "page" : undefined} onClick={() => setSection("saved")}>저장된 결과</button>
        {!simple ? <button type="button" disabled={busy} aria-current={section === "infrastructure" ? "page" : undefined} onClick={openInfrastructure}>인프라 분석</button> : null}
      </nav>
      {section === "settings" ? <main className="page"><h1>설정·도움말</h1>
        <p>새 점검은 현재 PC 네트워크를 사용하는 기본 연결로 시작합니다. 저장된 결과를 열 때 사이트에 다시 접속하지 않습니다.</p>
        {!simple && capabilities?.windowsIntegration ? <WarpSetup host={host} /> : null}
        {!simple && !capabilities?.windowsIntegration ? <p>앱 전용 WARP 등록은 Windows 데스크톱 앱에서 제공합니다.</p> : null}
        <button type="button" className="secondary" onClick={() => setSection("scan")}>현재 작업으로 돌아가기</button>
      </main> : null}
      {section === "saved" ? <SavedCases host={host} simple={simple} onOpen={(id) => openStored(id)} /> : null}
      {!simple && section === "infrastructure" && !infrastructureId ? <main className="page"><h1>분석할 저장 결과 선택</h1>
        <p>저장된 사례 한 개의 광고 연관 도메인과 근거를 확인합니다. 새 사이트를 점검하지 않습니다.</p>
        <SavedCases host={host} simple onOpen={(id) => openStored(id, true)} />
      </main> : null}
      {!simple && infrastructureId ? <div hidden={section !== "infrastructure"} className="page">
        <div className="actions"><button type="button" className="secondary" onClick={() => setInfrastructureId(undefined)}>다른 저장 결과 선택</button>
          <button type="button" className="secondary" onClick={() => { setSection("scan"); go("result"); }}>이 사례 결과 검토</button></div>
        <InfrastructureAnalysis host={host} sessionId={infrastructureId} onSelectFinding={(id) => {
          relationInvoker.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          setSessionId(infrastructureId); setFindingId(id); setFindingContext([id]); setSelectionOrigin("relation");
          setEvidenceReturn("infrastructure"); setSection("scan"); go("evidence");
        }} />
      </div> : null}
      {batchMounted ? <div hidden={!batchOpen || section !== "scan"}><BatchWorkspace host={host} reviews={reviewSessions} onWarpSetup={showWarpSetup} onBusyChange={setBatchBusy} prepareReviews={async () => { if (capabilities?.filesystem && !await caseReview.prepareAll()) throw new Error("Unsaved reviews"); }}
        onBack={() => { setBatchOpen(false); setBatchResult(false); goStart(); }}
        onInspect={(id) => { setSection("scan"); setSessionId(id); setBatchResult(true); setBatchOpen(false); setFindingId(undefined);
          setResultQuery(""); setResultFilter("ALL"); setResultView("findings"); setFindingContext([]); setRestoreFindingId(undefined); go("result"); }} /></div> : null}
      <div hidden={batchOpen || section !== "scan"}>
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
          onWarpSetup={!simple && scanConnection === "warp" && capabilities?.windowsIntegration ? showWarpSetup : undefined}
          simple={simple} onBusyChange={setScanBusy}
        />
      ) : (phase === "result" || phase === "evidence") && sessionId ? (
        <div className={`result-workspace${phase === "evidence" ? " inspecting" : ""}`}>
        <div className="result-workspace-list" inert={reviewTransition || fileBusy}>
        {capabilities?.filesystem ? <section className="case-storage" aria-label="케이스 보관 상태">
          <p role="status">{caseReview.status === "saved" ? "검토 기록 저장됨"
            : caseReview.status === "saving" ? "검토 기록 저장 중" : caseReview.status === "unsaved" ? "검토 기록 저장 대기"
              : caseReview.status === "error" ? "검토 기록 저장 확인 필요" : "케이스 보관 확인 중"}</p>
          {!simple && caseReview.opened ? <details className="advanced"><summary>보관 정보</summary>
            <p>저장 폴더: {caseReview.opened.directory}</p><p>검토 수정 번호 {caseReview.opened.review.revision} · 공식 원본은 검토 판단과 별도로 보존됩니다.</p>
            <p>공식 결과: {caseReview.opened.directory}/result.json</p>
          </details> : null}
          {caseReview.opened?.manifest.issues.length ? <p role="note">일부 저장 근거를 사용할 수 없습니다. 공식 결과는 계속 검토할 수 있습니다.</p> : null}
          {caseReview.status === "error" ? <><p role="alert">검토 기록을 저장하거나 불러오지 못했습니다. 작성 중인 메모는 이 화면에 유지됩니다. 저장 실패·다른 창의 수정 충돌·브라우저 미리보기 여부를 확인해 주세요.</p><button type="button" className="secondary" onClick={caseReview.retry}>현재 메모를 유지하고 저장 재시도</button><p className="hint">다른 창의 변경을 다시 읽고 현재 수정한 항목을 반영합니다. 같은 항목을 수정했다면 현재 화면의 내용을 저장합니다.</p></> : null}
        </section> : null}
        <ScanResult
          simple={simple} onInfrastructure={!simple ? openInfrastructure : undefined}
          prepareReviews={capabilities?.filesystem ? prepareReviews : undefined} onBusyChange={setFileBusy}
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
          allowHiddenSelection={selectionOrigin === "relation" || reviewTransition || caseReview.status === "error"}
          onSelectionHidden={closeHiddenSelection}
          onFocusRestored={() => setRestoreFindingId(undefined)}
          onEvidence={(id, context, origin = "list") => {
            if (reviewTransition || fileBusy) return;
            setEvidenceReturn("result");
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
          onRestart={() => {
            if (reviewTransition || fileBusy) return;
            if (batchResult) { setFindingId(undefined); setBatchOpen(true); } else goStart();
          }}
          restartLabel={batchResult ? "일괄 점검 현황으로 돌아가기" : undefined}
        />
        </div>
        {phase === "evidence" && findingId ? <EvidenceView
          key={findingId}
          simple={simple} readOnly={fileBusy}
          onComplete={async () => {
            setReviewTransition(true);
            try {
            reviewMany([findingId], true);
            await prepareReviews();
            const next = findingContext[findingContext.indexOf(findingId) + 1];
            if (next) { setFindingId(next); go("evidence"); } else goResultFromEvidence();
            } finally { setReviewTransition(false); }
          }}
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
          key={startGeneration}
          host={host}
          simple={simple} onBusyChange={setStarting}
          onWarpSetup={!simple && capabilities?.windowsIntegration ? showWarpSetup : undefined}
          onBatch={!simple ? () => { setBatchMounted(true); setBatchOpen(true); } : undefined}
          onStarted={(id, connection = "direct") => {
            setBatchResult(false); setScanBusy(true);
            setScanConnection(connection);
            setSessionId(id);
            go("progress");
          }}
        /></>
      )}
      </div>
      </div>
      {(phase === "result" || phase === "evidence") && exportOpen && sessionId ? (
        <ExportDialog host={host} sessionId={sessionId} onClose={closeExport} />
      ) : null}
    </div>
  );
}
