/**
 * BrowserHost: replay/demo-only HostBridge for the browser preview.
 *
 * No local scanning, no filesystem, no Tauri APIs. Serves the deterministic
 * demo result (apps/web/src/demo/findings.ts) so the KRDS flow — filters,
 * evidence, export validation — exercises against stable data. The banner in
 * ScanProgress and the preview banner make clear these are not live scan
 * results. The Tauri host runs the real scanner and validates its artifacts.
 */
import {
  BROWSER_HOST_CAPABILITIES,
  type WarpStatus,
  initialProgress,
  type ExportPaths,
  type ExtraResult,
  type HostBridge,
  type HostCapabilities,
  type OfficialResult,
  type ScanDetailBundle,
  type ImageAnalysisQuery,
  type EvidenceGraphQuery,
  type ScanEventHandler,
  type ScanProgress,
  type ScanRequest,
  type BatchScanRequest,
  type ScanSession,
  type Unsubscribe,
  type CaseList, type OpenCase, type CaseReview, type ReviewRecord, type SupportDiagnostics,
} from "@krds-detector/contracts";
import { DEMO_ENTRY_URL, demoResult } from "../demo/findings.js";
import { indexSessionEvidence } from "./session-evidence.js";
import { sliceEvidenceGraph } from "@krds-detector/evidence/graph";

let counter = 0;

export class BrowserHost implements HostBridge {
  async getWarpStatus(): Promise<WarpStatus> { return { state: "unsupported" }; }
  async registerWarp(_request: { acceptTerms: boolean }): Promise<WarpStatus> { throw new Error("WARP registration requires the Windows app"); }
  async listCases(): Promise<CaseList> { throw new Error("브라우저 미리보기는 저장된 케이스와 영구 보관을 지원하지 않습니다. 데스크톱 앱을 사용해 주세요."); }
  async openCase(caseId: string): Promise<OpenCase> { void caseId; throw new Error("저장된 케이스는 데스크톱 앱에서 열 수 있습니다."); }
  async saveCaseReview(caseId: string, expectedRevision: number, records: ReviewRecord[]): Promise<CaseReview> {
    void caseId; void expectedRevision; void records;
    throw new Error("브라우저 미리보기 메모는 영구 저장되지 않습니다.");
  }
  async exportCase(caseId: string): Promise<string | null> { void caseId; throw new Error("케이스 전달은 데스크톱 앱에서 지원합니다."); }
  async importCase(): Promise<string | null> { throw new Error("케이스 가져오기는 데스크톱 앱에서 지원합니다."); }
  async deleteCase(caseId: string): Promise<void> { void caseId; throw new Error("케이스 삭제는 데스크톱 앱에서 지원합니다."); }
  async getDiagnostics(): Promise<SupportDiagnostics> { throw new Error("설치 진단은 데스크톱 앱에서 지원합니다."); }
  private sessions = new Map<string, ScanSession>();
  private results = new Map<string, OfficialResult>();
  private extraResults = new Map<string, ExtraResult>();
  private evidence = new Map<string, ReturnType<typeof indexSessionEvidence>>();
  private handlers = new Set<ScanEventHandler>();

  async getCapabilities(): Promise<HostCapabilities> {
    return { ...BROWSER_HOST_CAPABILITIES };
  }

  async startScan(request: ScanRequest): Promise<ScanSession> {
    counter += 1;
    const session: ScanSession = {
      id: `browser-demo-${counter}`,
      entryUrl: request.entryUrl,
      status: "running",
      startedAt: new Date().toISOString(),
      progress: initialProgress("running"),
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
    session.hasResult = true;
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
    session.progress = progress;
    emit("session-finished", "데모 결과 준비됨");
    return session;
  }

  async cancelScan(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = "cancelled";
      session.finishedAt = new Date().toISOString();
      session.progress = { ...session.progress, sequence: session.progress.sequence + 1,
        stage: "cancelled", currentPages: [], queuedPages: 0 };
      const at = new Date().toISOString();
      for (const h of this.handlers) {
        h({
          kind: "session-cancelled",
          sessionId,
          at,
          progress: session.progress,
          message: "취소되었습니다.",
        });
      }
    }
  }

  async startBatchScan(request: BatchScanRequest): Promise<ScanSession> {
    void request;
    throw new Error("일괄 점검은 데스크톱 앱에서 실행해 주세요.");
  }
  async exportBatchResults(sessionIds: string[]): Promise<string | null> {
    void sessionIds;
    throw new Error("브라우저 미리보기에서는 파일 저장을 지원하지 않습니다.");
  }
  async saveTargetTemplate(): Promise<string | null> {
    throw new Error("브라우저 미리보기에서는 파일 저장을 지원하지 않습니다.");
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
    return this.extraResults.get(sessionId);
  }

  /** Install validated replay data; the same lazy boundary serves demo review. */
  setReplayResult(session: ScanSession, result: OfficialResult, detail: ScanDetailBundle, extra?: ExtraResult): void {
    this.sessions.set(session.id, session);
    this.results.set(session.id, result);
    this.evidence.set(session.id, indexSessionEvidence(detail));
    if (extra) this.extraResults.set(session.id, extra);
  }

  async getScanCoverage(sessionId: string) { return this.evidence.get(sessionId)?.coverage; }
  async getFindingDetail(sessionId: string, findingId: string) { return this.evidence.get(sessionId)?.findings.get(findingId); }
  async getImageAnalysis(sessionId: string, query?: ImageAnalysisQuery) { return this.evidence.get(sessionId)?.imagePage(query); }
  async getEvidenceAsset(sessionId: string, assetId: string) { return this.evidence.get(sessionId)?.assets.get(assetId); }
  async getEvidenceSummary(sessionId: string) { return this.evidence.get(sessionId)?.summary; }
  async getEvidenceGraphSlice(sessionId: string, query: EvidenceGraphQuery) {
    const graph = this.evidence.get(sessionId)?.graph;
    return graph ? sliceEvidenceGraph(graph, query) : undefined;
  }

  async exportResult(sessionId: string, directory: string): Promise<ExportPaths> {
    void sessionId;
    void directory;
    throw new Error(
      "브라우저 미리보기에서는 파일 내보내기를 지원하지 않습니다.",
    );
  }

  async saveWorkbook(_sessionIds: string[], _data: Uint8Array): Promise<string | null> {
    void _sessionIds; void _data;
    throw new Error("브라우저 미리보기에서는 파일 저장을 지원하지 않습니다.");
  }
}
