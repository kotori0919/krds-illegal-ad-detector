import { useState } from "react";
import type { HostBridge } from "@krds-detector/contracts";
import { BrowserHost } from "./host/browser.js";
import { ScanStart } from "./screens/ScanStart.js";
import { ScanProgressView } from "./screens/ScanProgress.js";
import { ScanResult } from "./screens/ScanResult.js";

const host: HostBridge = new BrowserHost();

type Phase = "start" | "progress" | "result";

export function App() {
  const [phase, setPhase] = useState<Phase>("start");
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);

  if (phase === "progress" && sessionId) {
    return (
      <ScanProgressView
        host={host}
        sessionId={sessionId}
        onDone={() => setPhase("result")}
        onCancel={() => setPhase("start")}
      />
    );
  }
  if (phase === "result" && sessionId) {
    return (
      <ScanResult
        host={host}
        sessionId={sessionId}
        onRestart={() => setPhase("start")}
      />
    );
  }
  return (
    <ScanStart
      host={host}
      onStarted={(id) => {
        setSessionId(id);
        setPhase("progress");
      }}
    />
  );
}
