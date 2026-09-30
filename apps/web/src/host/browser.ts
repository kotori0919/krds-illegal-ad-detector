/**
 * BrowserHost: replay/demo-only HostBridge for the browser preview.
 *
 * No local scanning, no filesystem, no Tauri APIs. Real scanning arrives
 * with the Tauri host (Phase 18); this adapter only lets the KRDS flow be
 * exercised with a deterministic synthetic session.
 */
import {
  BROWSER_HOST_CAPABILITIES,
  initialProgress,
  type ExportPaths,
  type ExtraResult,
  type HostBridge,
  type HostCapabilities,
  type OfficialResult,
  type ScanEventHandler,
  type ScanRequest,
  type ScanSession,
  type Unsubscribe,
} from "@krds-detector/contracts";

let counter = 0;

export class BrowserHost implements HostBridge {
  private sessions = new Map<string, ScanSession>();
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
      status: "crawling",
      startedAt: new Date().toISOString(),
    };
    this.sessions.set(session.id, session);
    const at = new Date().toISOString();
    for (const h of this.handlers) {
      h({
        kind: "session-started",
        sessionId: session.id,
        at,
        progress: initialProgress("crawling"),
        message: "브라우저 미리보기: 실제 스캔은 데스크톱 앱에서 실행됩니다.",
        pageUrl: request.entryUrl,
      });
    }
    return session;
  }

  async cancelScan(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = "cancelled";
      session.finishedAt = new Date().toISOString();
    }
  }

  onScanEvent(handler: ScanEventHandler): Unsubscribe {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  async getSession(sessionId: string): Promise<ScanSession | undefined> {
    return this.sessions.get(sessionId);
  }

  async getOfficialResult(sessionId: string): Promise<OfficialResult | undefined> {
    void sessionId;
    return undefined;
  }

  async getExtraResult(sessionId: string): Promise<ExtraResult | undefined> {
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
