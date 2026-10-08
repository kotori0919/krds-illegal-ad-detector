import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReviewRecord } from "@krds-detector/evidence/report";
import type { HostBridge } from "@krds-detector/contracts";
import { createHost } from "./host/index.js";
import { ScanStart } from "./screens/ScanStart.js";
import { ScanProgressView } from "./screens/ScanProgress.js";
import { ScanResult } from "./screens/ScanResult.js";
import type { OfficialTechnique } from "@krds-detector/contracts";
import { EvidenceView } from "./screens/EvidenceView.js";
import { ExportDialog } from "./screens/ExportDialog.js";
import { stepStates, type Phase } from "./steps.js";

const narrowInspector = () => window.matchMedia?.("(max-width: 63.999rem)").matches ?? false;

export function App() {
  const [phase, setPhase] = useState<Phase>("start");
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [findingId, setFindingId] = useState<string | undefined>(undefined);
  const [findingContext, setFindingContext] = useState<string[]>([]);
  const [restoreFindingId, setRestoreFindingId] = useState<string | undefined>(undefined);
  const [exportOpen, setExportOpen] = useState(false);
  const [resultQuery, setResultQuery] = useState("");
  const [resultFilter, setResultFilter] = useState<OfficialTechnique | "ALL">("ALL");
  const [resultView, setResultView] = useState<"findings" | "pages" | "extra" | "coverage">("findings");
  const [reviewRecords, setReviewRecords] = useState<Record<string, ReviewRecord>>({});
  const reviewedIds = useMemo(() => new Set(Object.values(reviewRecords).filter((record) => record.state === "reviewed").map((record) => record.findingId)), [reviewRecords]);
  const reviewMany = (ids: string[], reviewed: boolean): void => setReviewRecords((previous) => {
    const next = { ...previous };
    const at = new Date().toISOString();
    for (const id of ids) next[id] = { findingId: id, state: reviewed ? "reviewed" : "needed", note: previous[id]?.note ?? "", at };
    return next;
  });
  const [host, setHost] = useState<HostBridge | undefined>(undefined);
  const resultScrollY = useRef(0);
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
    createHost().then((h) => {
      if (alive) setHost(h);
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
    setRestoreFindingId(findingId);
    go("result");
    if (narrowInspector()) scheduleScroll(resultScrollY.current);
  }, [findingId, go, scheduleScroll]);
  /** Cancel/restart resets the whole flow, so completion state resets too. */
  const goStart = useCallback(() => {
    if (scrollFrame.current !== undefined) cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = undefined;
    setPhase("start");
    resultScrollY.current = 0;
    setResultQuery("");
    setResultFilter("ALL");
    setResultView("findings");
    setRestoreFindingId(undefined);
    setExportOpen(false);
    setReviewRecords({});
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
      <nav aria-label="탐지 단계" className="steps-nav">
        <ol className="steps">
          {steps.map((s) => (
            <li key={s.id} aria-current={s.current ? "step" : undefined} className={s.className}>
              {s.done && <span aria-hidden="true" className="done-check">✓ </span>}
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
          onSelectionHidden={closeHiddenSelection}
          onFocusRestored={() => setRestoreFindingId(undefined)}
          onEvidence={(id, context) => {
            if (phase === "result" && narrowInspector()) resultScrollY.current = window.scrollY;
            setFindingId(id);
            setFindingContext(context ?? [id]);
            go("evidence");
            if (phase === "result" && narrowInspector()) scheduleScroll(0);
          }}
          onExport={() => setExportOpen(true)}
          onRestart={goStart}
        />
        </div>
        {phase === "evidence" && findingId ? <EvidenceView
          key={findingId}
          host={host}
          sessionId={sessionId}
          findingId={findingId}
          contextIds={findingContext}
          onSelectFinding={setFindingId}
          reviewed={reviewedIds.has(findingId)}
          onReviewChange={(reviewed) => reviewMany([findingId], reviewed)}
          note={reviewRecords[findingId]?.note ?? ""}
          onNoteChange={(note) => setReviewRecords((previous) => ({ ...previous,
            [findingId]: { findingId, state: previous[findingId]?.state ?? "needed", note, at: new Date().toISOString() } }))}
          onBack={goResultFromEvidence}
        /> : null}
        </div>
      ) : (
        <ScanStart
          host={host}
          onStarted={(id) => {
            setSessionId(id);
            go("progress");
          }}
        />
      )}
      </div>
      {(phase === "result" || phase === "evidence") && exportOpen && sessionId ? (
        <ExportDialog host={host} sessionId={sessionId} onClose={closeExport} />
      ) : null}
    </>
  );
}
