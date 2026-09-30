import { useCallback, useState } from "react";
import type { HostBridge } from "@krds-detector/contracts";
import { BrowserHost } from "./host/browser.js";
import { ScanStart } from "./screens/ScanStart.js";
import { ScanProgressView } from "./screens/ScanProgress.js";
import { ScanResult } from "./screens/ScanResult.js";
import { EvidenceView } from "./screens/EvidenceView.js";
import { ExportView } from "./screens/ExportView.js";

const host: HostBridge = new BrowserHost();

type Phase = "start" | "progress" | "result" | "evidence" | "export";

const STEPS: { id: Phase; label: string }[] = [
  { id: "start", label: "탐지 시작" },
  { id: "progress", label: "탐지 진행" },
  { id: "result", label: "탐지 결과" },
  { id: "evidence", label: "탐지 근거" },
  { id: "export", label: "검증·내보내기" },
];

export function App() {
  const [phase, setPhase] = useState<Phase>("start");
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [findingId, setFindingId] = useState<string | undefined>(undefined);

  const goResult = useCallback(() => setPhase("result"), []);
  const goExport = useCallback(() => setPhase("export"), []);

  const stepIndex = STEPS.findIndex((s) => s.id === phase);

  return (
    <>
      <nav aria-label="탐지 단계" className="steps-nav">
        <ol className="steps">
          {STEPS.map((s, i) => (
            <li key={s.id} aria-current={s.id === phase ? "step" : undefined} className={i < stepIndex ? "done" : i === stepIndex ? "current" : "todo"}>
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
          onCancel={() => setPhase("start")}
        />
      ) : phase === "result" && sessionId ? (
        <ScanResult
          host={host}
          sessionId={sessionId}
          onEvidence={(id) => {
            setFindingId(id);
            setPhase("evidence");
          }}
          onExport={goExport}
          onRestart={() => setPhase("start")}
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
        <ExportView host={host} sessionId={sessionId} onBack={goResult} onRestart={() => setPhase("start")} />
      ) : (
        <ScanStart
          host={host}
          onStarted={(id) => {
            setSessionId(id);
            setPhase("progress");
          }}
        />
      )}
    </>
  );
}
