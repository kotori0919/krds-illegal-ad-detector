/**
 * TauriHost: native HostBridge for the desktop app (GOAL Phase 18).
 *
 * React code talks to HostBridge only — this adapter is the single place
 * where Tauri IPC (`@tauri-apps/api/core` invoke + event listen) enters the
 * web codebase. All Tauri commands are narrow and typed:
 * scanner lifecycle (start/cancel), session/result reads, and result export.
 * No arbitrary shell execution is exposed to the frontend.
 */
import {
  TAURI_HOST_CAPABILITIES,
  isWarpStatus, type WarpStatus,
  CONFIG_VERSION,
  isCaseId, isCaseList, isOpenCase, isCaseReview, isReviewRecord, isSupportDiagnostics, parseCaseValue,
  isBatchGroup, isBatchGroupId, isBatchGroupList,
  type BatchGroup, type BatchGroupList,
  type ExportPaths,
  type ExtraResult,
  type HostBridge,
  type HostCapabilities,
  type OfficialResult,
  type ScanCoverageView,
  type FindingDetailView,
  type ImageAnalysisQuery,
  type ImageAnalysisPage,
  type EvidenceAsset,
  type EvidenceSummary,
  type EvidenceGraphQuery,
  type EvidenceGraphSlice,
  type ScanEvent,
  type ScanEventHandler,
  type ScanRequest,
  type BatchScanRequest,
  type ScanSession,
  type Unsubscribe,
  type CaseList, type OpenCase, type CaseReview, type ReviewRecord, type SupportDiagnostics,
} from "@krds-detector/contracts";

interface TauriInvoke {
  <T>(cmd: string, args?: Record<string, unknown>): Promise<T>;
}

interface TauriListen {
  (event: string, handler: (e: { payload: ScanEvent }) => void): Promise<Unsubscribe>;
}

interface EvidenceRead {
  promise: Promise<unknown>;
  bytes?: number;
}

// Conservatively account for UTF-16 serialized data, including base64 images.
// The active view owns its response independently; eviction only costs a later IPC read.
const EVIDENCE_CACHE_BYTES = 16 * 1024 * 1024;
const EVIDENCE_CACHE_ENTRIES = 128;

async function loadTauri(): Promise<{ invoke: TauriInvoke; listen: TauriListen }> {
  const core = (await import("@tauri-apps/api/core")) as unknown as {
    invoke: TauriInvoke;
  };
  const event = (await import("@tauri-apps/api/event")) as unknown as {
    listen: TauriListen;
  };
  return { invoke: core.invoke, listen: event.listen };
}

export class TauriHost implements HostBridge {
  async openWarpTerms(): Promise<void> {
    await (await this.invoke())("open_warp_terms");
  }
  async getWarpStatus(): Promise<WarpStatus> {
    const value = await (await this.invoke())<unknown>("get_warp_status");
    if (!isWarpStatus(value)) throw new Error("Invalid WARP status");
    return value;
  }
  async registerWarp(request: { acceptTerms: boolean }): Promise<WarpStatus> {
    const value = await (await this.invoke())<unknown>("register_warp", { request: { acceptTerms: request.acceptTerms } });
    if (!isWarpStatus(value)) throw new Error("Invalid WARP status");
    return value;
  }
  async onCloseRequested(prepare: () => Promise<boolean>): Promise<Unsubscribe> {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    return getCurrentWindow().onCloseRequested(async (event) => {
      try { if (!await prepare()) event.preventDefault(); }
      catch { event.preventDefault(); }
    });
  }
  async listCases(): Promise<CaseList> { return parseCaseValue(await (await this.invoke())<unknown>("case_list"), isCaseList); }
  async openCase(caseId: string): Promise<OpenCase> {
    if (!isCaseId(caseId)) throw new Error("INVALID_CASE_ID");
    const value = parseCaseValue(await (await this.invoke())<unknown>("case_open", { caseId }), isOpenCase);
    if (value.manifest.caseId !== caseId) throw new Error("INVALID_CASE_CONTRACT: case identity disagrees with request");
    return value;
  }
  async saveCaseReview(caseId: string, expectedRevision: number, records: ReviewRecord[]): Promise<CaseReview> {
    const normalized = records.map((record) => ({ ...record, judgment: record.judgment ?? "unjudged" }));
    if (!isCaseId(caseId) || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || expectedRevision >= Number.MAX_SAFE_INTEGER
      || normalized.length > 20_000 || !normalized.every(isReviewRecord) || new Set(normalized.map(record => record.findingId)).size !== normalized.length) throw new Error("INVALID_REVIEW_REQUEST");
    const value = parseCaseValue(await (await this.invoke())<unknown>("case_save_review", { caseId, expectedRevision, records: normalized }), isCaseReview);
    if (value.revision !== expectedRevision + 1) throw new Error("INVALID_CASE_CONTRACT: review revision disagrees with committed successor");
    return value;
  }
  async exportCase(caseId: string): Promise<string | null> {
    if (!isCaseId(caseId)) throw new Error("INVALID_CASE_ID");
    const value = await (await this.invoke())<unknown>("case_export", { caseId });
    if (value !== null && (typeof value !== "string" || !value || value.length > 4096 || value.includes("\0"))) throw new Error("INVALID_CASE_CONTRACT: invalid export path");
    return value;
  }
  async importCase(): Promise<string | null> {
    const value = await (await this.invoke())<unknown>("case_import");
    if (value !== null && !isCaseId(value)) throw new Error("INVALID_CASE_CONTRACT: invalid imported case identity");
    return value;
  }
  async deleteCase(caseId: string): Promise<void> {
    if (!isCaseId(caseId)) throw new Error("INVALID_CASE_ID");
    await (await this.invoke())("case_delete", { caseId });
    this.evidenceReads.clear();
    this.evidenceCacheBytes = 0;
  }
  async getDiagnostics(): Promise<SupportDiagnostics> { return parseCaseValue(await (await this.invoke())<unknown>("support_diagnostics"), isSupportDiagnostics); }
  private evidenceReads = new Map<string, EvidenceRead>();
  private evidenceCacheBytes = 0;

  private forgetEvidenceRead(key: string, entry: EvidenceRead): void {
    // A late failure/completion from a deleted case must not evict its replacement.
    if (this.evidenceReads.get(key) !== entry) return;
    this.evidenceReads.delete(key);
    this.evidenceCacheBytes -= entry.bytes ?? 0;
  }

  private cachedRead<T>(command: string, args: Record<string, unknown>): Promise<T | undefined> {
    const key = JSON.stringify([command, args]);
    const pending = this.evidenceReads.get(key);
    if (pending) {
      this.evidenceReads.delete(key);
      this.evidenceReads.set(key, pending);
      return pending.promise as Promise<T | undefined>;
    }
    const read = this.invoke().then((invoke) => invoke<T | undefined>(command, args));
    const entry: EvidenceRead = { promise: read };
    this.evidenceReads.set(key, entry);
    void read.then((value) => {
      if (this.evidenceReads.get(key) !== entry) return;
      if (value == null) { this.forgetEvidenceRead(key, entry); return; }
      try {
        const bytes = 2 * (key.length + JSON.stringify(value).length);
        // A single oversized response is usable by its caller, but must not
        // displace the entire useful cache before being evicted itself.
        if (bytes > EVIDENCE_CACHE_BYTES) { this.forgetEvidenceRead(key, entry); return; }
        entry.bytes = bytes;
      } catch {
        // Optional caching must never turn an otherwise successful IPC read into an error.
        this.forgetEvidenceRead(key, entry); return;
      }
      this.evidenceCacheBytes += entry.bytes;
      for (const [oldKey, oldEntry] of this.evidenceReads) {
        if (this.evidenceReads.size <= EVIDENCE_CACHE_ENTRIES && this.evidenceCacheBytes <= EVIDENCE_CACHE_BYTES) break;
        // Keep in-flight coalescing; bounded retention applies once reads settle.
        if (oldEntry.bytes !== undefined) this.forgetEvidenceRead(oldKey, oldEntry);
      }
    }, () => this.forgetEvidenceRead(key, entry));
    return read;
  }
  private invokePromise: Promise<TauriInvoke> | undefined;
  private handlers = new Set<ScanEventHandler>();
  private subscribed = false;
  private subscriptionPending: Promise<void> | undefined;

  private async invoke(): Promise<TauriInvoke> {
    if (!this.invokePromise) {
      this.invokePromise = loadTauri().then((t) => t.invoke);
    }
    return this.invokePromise;
  }

  private async ensureSubscribed(): Promise<void> {
    if (this.subscribed) return;
    if (this.subscriptionPending) return this.subscriptionPending;
    // Subscription failure must surface: silent best-effort hides ACL
    // denials and loses completion events. Share registration with callers
    // arriving before listen settles; all must wait before invoking a scan.
    this.subscriptionPending = (async () => {
      const { listen } = await loadTauri();
      await listen("scan-event", (e) => {
        for (const h of this.handlers) h(e.payload);
      });
      this.subscribed = true;
    })();
    try {
      await this.subscriptionPending;
    } finally {
      // A rejected registration must not poison subsequent retries.
      this.subscriptionPending = undefined;
    }
  }

  /** True once the scan-event subscription succeeded. */
  subscribedToEvents(): boolean {
    return this.subscribed;
  }

  async getCapabilities(): Promise<HostCapabilities> {
    return { ...TAURI_HOST_CAPABILITIES };
  }

  async startScan(request: ScanRequest): Promise<ScanSession> {
    await this.ensureSubscribed();
    const invoke = await this.invoke();
    return invoke<ScanSession>("scan_start", { request: { ...request, configVersion: CONFIG_VERSION } });
  }

  async cancelScan(sessionId: string): Promise<void> {
    const invoke = await this.invoke();
    await invoke<void>("scan_cancel", { sessionId });
  }

  async startBatchScan(request: BatchScanRequest): Promise<ScanSession> {
    await this.ensureSubscribed();
    const invoke = await this.invoke();
    return invoke<ScanSession>("scan_start_batch", { request: { ...request, configVersion: CONFIG_VERSION } });
  }

  async exportBatchResults(sessionIds: string[]): Promise<string | null> {
    const invoke = await this.invoke();
    return invoke<string | null>("scan_export_batch", { sessionIds });
  }
  async saveTargetTemplate(): Promise<string | null> {
    const invoke = await this.invoke();
    return invoke<string | null>("scan_save_template");
  }

  onScanEvent(handler: ScanEventHandler): Unsubscribe {
    this.handlers.add(handler);
    void this.ensureSubscribed().catch(() => undefined);
    return () => {
      this.handlers.delete(handler);
    };
  }

  async getSession(sessionId: string): Promise<ScanSession | undefined> {
    const invoke = await this.invoke();
    return invoke<ScanSession | undefined>("scan_get_session", { sessionId });
  }

  async getOfficialResult(sessionId: string): Promise<OfficialResult | undefined> {
    const invoke = await this.invoke();
    return invoke<OfficialResult | undefined>("scan_get_result", { sessionId });
  }

  async getExtraResult(sessionId: string): Promise<ExtraResult | undefined> {
    const invoke = await this.invoke();
    return invoke<ExtraResult | undefined>("scan_get_extra_result", { sessionId });
  }

  getScanCoverage(sessionId: string): Promise<ScanCoverageView | undefined> {
    return this.cachedRead("scan_get_coverage", { sessionId });
  }

  getFindingDetail(sessionId: string, findingId: string): Promise<FindingDetailView | undefined> {
    return this.cachedRead("scan_get_finding_detail", { sessionId, findingId });
  }

  getImageAnalysis(sessionId: string, query: ImageAnalysisQuery = {}): Promise<ImageAnalysisPage | undefined> {
    return this.cachedRead("scan_get_image_analysis", { sessionId, query });
  }

  getEvidenceAsset(sessionId: string, assetId: string): Promise<EvidenceAsset | undefined> {
    return this.cachedRead("scan_get_evidence_asset", { sessionId, assetId });
  }

  getEvidenceSummary(sessionId: string): Promise<EvidenceSummary | undefined> {
    return this.cachedRead("scan_get_evidence_summary", { sessionId });
  }

  getEvidenceGraphSlice(sessionId: string, query: EvidenceGraphQuery): Promise<EvidenceGraphSlice | undefined> {
    return this.cachedRead("scan_get_evidence_graph_slice", { sessionId, query });
  }

  async exportResult(sessionId: string, directory: string): Promise<ExportPaths> {
    const invoke = await this.invoke();
    return invoke<ExportPaths>("scan_export", { sessionId, directory });
  }

  async saveWorkbook(sessionIds: string[], data: Uint8Array): Promise<string | null> {
    const invoke = await this.invoke();
    return invoke<string | null>("scan_export_workbook", { sessionIds, data: Array.from(data) });
  }
  async listBatchGroups(): Promise<BatchGroupList> {
    return parseCaseValue(await (await this.invoke())<unknown>("batch_group_list"), isBatchGroupList);
  }
  async saveBatchGroup(group: BatchGroup): Promise<BatchGroup> {
    if (!isBatchGroup(group)) throw new Error("INVALID_BATCH_GROUP");
    const value = parseCaseValue(await (await this.invoke())<unknown>("batch_group_save", { group }), isBatchGroup);
    if (value.groupId !== group.groupId || !isBatchGroupId(group.groupId)) {
      throw new Error("INVALID_CASE_CONTRACT: batch group identity disagrees with request");
    }
    return value;
  }
}
