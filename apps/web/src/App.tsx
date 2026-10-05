import { useCallback, useEffect, useState } from "react";
import type { HostBridge } from "@krds-detector/contracts";
import { createHost } from "./host/index.js";
import { ScanStart } from "./screens/ScanStart.js";
import { ScanProgressView } from "./screens/ScanProgress.js";
import { ScanResult } from "./screens/ScanResult.js";
import type { OfficialTechnique } from "@krds-detector/contracts";
import { EvidenceView } from "./screens/EvidenceView.js";
import { ExportDialog } from "./screens/ExportDialog.js";
import { stepStates, type Phase } from "./steps.js";

export function App() {
  const [phase, setPhase] = useState<Phase>("start");
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [findingId, setFindingId] = useState<string | undefined>(undefined);
  const [restoreFindingId, setRestoreFindingId] = useState<string | undefined>(undefined);
  const [exportOpen, setExportOpen] = useState(false);
  const [resultQuery, setResultQuery] = useState("");
  const [resultFilter, setResultFilter] = useState<OfficialTechnique | "ALL">("ALL");
  const [resultView, setResultView] = useState<"findings" | "pages" | "coverage">("findings");
  const [reviewedIds, setReviewedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [host, setHost] = useState<HostBridge | undefined>(undefined);

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
  const goResultFromEvidence = useCallback(() => {
    setRestoreFindingId(findingId);
    go("result");
  }, [findingId, go]);
  /** Cancel/restart resets the whole flow, so completion state resets too. */
  const goStart = useCallback(() => {
    setPhase("start");
    setResultQuery("");
    setResultFilter("ALL");
    setResultView("findings");
    setRestoreFindingId(undefined);
    setExportOpen(false);
    setReviewedIds(new Set());
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
      ) : phase === "result" && sessionId ? (
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
          onReviewMany={(ids, reviewed) => setReviewedIds((previous) => {
            const next = new Set(previous);
            for (const id of ids) { if (reviewed) next.add(id); else next.delete(id); }
            return next;
          })}
          restoreFindingId={restoreFindingId}
          onFocusRestored={() => setRestoreFindingId(undefined)}
          onEvidence={(id) => {
            setFindingId(id);
            go("evidence");
          }}
          onExport={() => setExportOpen(true)}
          onRestart={goStart}
        />
      ) : phase === "evidence" && sessionId && findingId ? (
        <EvidenceView
          host={host}
          sessionId={sessionId}
          findingId={findingId}
          reviewed={reviewedIds.has(findingId)}
          onReviewChange={(reviewed) => setReviewedIds((previous) => {
            const next = new Set(previous);
            if (reviewed) next.add(findingId); else next.delete(findingId);
            return next;
          })}
          onBack={goResultFromEvidence}
        />
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
      {phase === "result" && exportOpen && sessionId ? (
        <ExportDialog host={host} sessionId={sessionId} onClose={closeExport} />
      ) : null}
    </>
  );
}
