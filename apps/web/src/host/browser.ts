/**
 * BrowserHost: replay/demo-only HostBridge for the browser preview.
 *
 * No local scanning, no filesystem, no Tauri APIs. Serves the deterministic
 * demo result (apps/web/src/demo/findings.ts) so the KRDS flow — filters,
 * evidence, export validation — exercises against stable data. The banner in
 * ScanProgress and the demo topic label make clear these are not live scan
 * results. Real scanning arrives with the Tauri host (Phase 18).
 */
import {
  BROWSER_HOST_CAPABILITIES,
  initialProgress,
  type ExportPaths,
  type ExtraResult,
  type HostBridge,
  type HostCapabilities,
  type OfficialResult,
  type ScanDetailBundle,
  type ScanEventHandler,
  type ScanProgress,
  type ScanRequest,
  type ScanSession,
  type Unsubscribe,
} from "@krds-detector/contracts";
import { DEMO_ENTRY_URL, demoResult } from "../demo/findings.js";

let counter = 0;

export class BrowserHost implements HostBridge {
  private sessions = new Map<string, ScanSession>();
  private results = new Map<string, OfficialResult>();
  private handlers = new Set<ScanEventHandler>();

  async getCapabilities(): Promise<HostCapabilities> {
    return { ...BROWSER_HOST_CAPABILITIES };
  }

  async startScan(request: ScanRequest): Promise<ScanSession> {
    counter += 1;
    const session: ScanSession = {
      id: `browser-demo-${counter}`,
      entryUrl: request.entryUrl,
      topic: request.topic ?? "",
      status: "running",
      startedAt: new Date().toISOString(),
    };
    this.sessions.set(session.id, session);
    const demo = demoResult();
    // Retarget demo findings at the requested entry URL so filters and
    // evidence screens show coherent data for any input.
    const host = (() => {
      try {
        return new URL(request.entryUrl).host;
      } catch {
        return new URL(DEMO_ENTRY_URL).host;
      }
    })();
    this.results.set(session.id, {
      ...demo,
      meta: { ...demo.meta, entry_url: request.entryUrl },
      findings: demo.findings.map((f) => ({
        ...f,
        url: f.url.replace(new URL(DEMO_ENTRY_URL).host, host),
        location: f.location.replaceAll(
          new URL(DEMO_ENTRY_URL).host,
          host,
        ),
      })),
    });
    const at = new Date().toISOString();
    const progress: ScanProgress = {
      ...initialProgress("running"),
      visitedPages: 14,
      queuedPages: 0,
      framesInspected: 3,
      elementsAnalyzed: 42,
      candidates: 15,
      confirmedFindings: 5,
      elapsedSec: 52,
    };
    const emit = (kind: Parameters<ScanEventHandler>[0]["kind"], message?: string): void => {
      for (const h of this.handlers) {
        h({ kind, sessionId: session.id, at, progress: { ...progress }, message, pageUrl: request.entryUrl });
      }
    };
    emit("session-started", "미리보기 데모 데이터를 불러왔습니다. 실제 스캔은 데스크톱 앱에서 실행됩니다.");
    emit("stage-changed", "데모: 분석 완료");
    progress.stage = "succeeded";
    emit("session-finished", "데모 결과 준비됨");
    return session;
  }

  async cancelScan(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = "cancelled";
      session.finishedAt = new Date().toISOString();
      const at = new Date().toISOString();
      for (const h of this.handlers) {
        h({
          kind: "session-cancelled",
          sessionId,
          at,
          progress: initialProgress("cancelled"),
          message: "취소되었습니다.",
        });
      }
    }
  }

  onScanEvent(handler: ScanEventHandler): Unsubscribe {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  async getSession(sessionId: string): Promise<ScanSession | undefined> {
    const session = this.sessions.get(sessionId);
    if (session && session.status === "running") {
      return { ...session, status: "succeeded", finishedAt: new Date().toISOString() };
    }
    return session;
  }

  async getOfficialResult(sessionId: string): Promise<OfficialResult | undefined> {
    return this.results.get(sessionId);
  }

  async getExtraResult(sessionId: string): Promise<ExtraResult | undefined> {
    void sessionId;
    return undefined;
  }

  async getDetailBundle(sessionId: string): Promise<ScanDetailBundle | undefined> {
    void sessionId;
    return undefined;
  }

  async exportResult(sessionId: string, directory: string): Promise<ExportPaths> {
    void sessionId;
    void directory;
    throw new Error(
      "브라우저 미리보기에서는 파일 내보내기를 지원하지 않습니다.",
    );
  }
}
