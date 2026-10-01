import { useCallback, useEffect, useState } from "react";
import type { HostBridge } from "@krds-detector/contracts";
import { createHost } from "./host/index.js";
import { ScanStart } from "./screens/ScanStart.js";
import { ScanProgressView } from "./screens/ScanProgress.js";
import { ScanResult } from "./screens/ScanResult.js";
import { EvidenceView } from "./screens/EvidenceView.js";
import { ExportView } from "./screens/ExportView.js";
import { stepStates, type Phase } from "./steps.js";

export function App() {
  const [phase, setPhase] = useState<Phase>("start");
  const [visited, setVisited] = useState<ReadonlySet<Phase>>(() => new Set<Phase>(["start"]));
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [findingId, setFindingId] = useState<string | undefined>(undefined);
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

  /** Record a phase navigation so completion reflects the actual route taken. */
  const go = useCallback((next: Phase) => {
    setVisited((prev) => (prev.has(next) ? prev : new Set([...prev, next])));
    setPhase(next);
  }, []);

  const goResult = useCallback(() => go("result"), [go]);
  const goExport = useCallback(() => go("export"), [go]);
  /** Cancel/restart resets the whole flow, so completion state resets too. */
  const goStart = useCallback(() => {
    setVisited(new Set<Phase>(["start"]));
    setPhase("start");
  }, []);

  const steps = stepStates(phase, visited);

  if (!host) {
    return (
      <main className="page">
        <p role="status">실행 환경을 확인하는 중입니다…</p>
      </main>
    );
  }
  return (
    <>
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
          onEvidence={(id) => {
            setFindingId(id);
            go("evidence");
          }}
          onExport={goExport}
          onRestart={goStart}
        />
      ) : phase === "evidence" && sessionId && findingId ? (
        <EvidenceView
          host={host}
          sessionId={sessionId}
          findingId={findingId}
          onBack={goResult}
          onExport={goExport}
        />
      ) : phase === "export" && sessionId ? (
        <ExportView host={host} sessionId={sessionId} onBack={goResult} onRestart={goStart} />
      ) : (
        <ScanStart
          host={host}
          onStarted={(id) => {
            setSessionId(id);
            go("progress");
          }}
        />
      )}
    </>
  );
}
