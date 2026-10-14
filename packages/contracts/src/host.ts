/**
 * Contract v0 (frozen 2026-10-01): host capability model + bridge.
 *
 * Normal React code talks to `HostBridge` only. Tauri APIs stay inside the
 * platform adapter (apps/web/src/host/tauri.ts + src-tauri). BrowserHost
 * exposes UI/replay/demo only and must not weaken browser security to fake
 * local scanning.
 */

import type { ScanEvent, ScanRequest, ScanSession } from "./scan.js";
import type { WarpStatus } from "./warp.js";
import type { BatchScanRequest } from "./batch.js";
import type { CaseList, OpenCase, CaseReview, ReviewRecord, SupportDiagnostics } from "./case.js";
import type { ExtraResult, OfficialResult } from "./result.js";
import type { ImageAnalysisPage, ImageAnalysisQuery, ScanCoverageView, FindingDetailView,
  EvidenceAsset, EvidenceSummary, EvidenceGraphQuery, EvidenceGraphSlice } from "./evidence-access.js";

export interface HostCapabilities {
  /** Arbitrary local scan via Playwright worker (Tauri only). */
  localScan: boolean;
  /** Write result.json / result_extra.json to disk. */
  filesystem: boolean;
  /** Run local decision/OCR models on CPU. */
  localInference: boolean;
  /** Start/cancel/supervise the scanner process tree. */
  nativeProcessControl: boolean;
  /** Windows-specific integration (dialogs, Job Objects). */
  windowsIntegration: boolean;
}

export const BROWSER_HOST_CAPABILITIES: HostCapabilities = {
  localScan: false,
  filesystem: false,
  localInference: false,
  nativeProcessControl: false,
  windowsIntegration: false,
};

export const TAURI_HOST_CAPABILITIES: HostCapabilities = {
  localScan: true,
  filesystem: true,
  localInference: true,
  nativeProcessControl: true,
  windowsIntegration: true,
};

export type ScanEventHandler = (event: ScanEvent) => void;
export type Unsubscribe = () => void;

export interface ExportPaths {
  /** Null when the evaluator cancelled the native dialog: no file, no error. */
  resultJson: string | null;
  resultExtraJson?: string;
}

export interface HostBridge {
  /** Opens only the fixed official terms page; never accepts terms. */
  openWarpTerms(): Promise<void>;
  getWarpStatus(): Promise<WarpStatus>;
  registerWarp(request: { acceptTerms: boolean }): Promise<WarpStatus>;
  /** Native close waits for durable review writes; false keeps the window open. */
  onCloseRequested?(prepare: () => Promise<boolean>): Promise<Unsubscribe>;
  listCases(): Promise<CaseList>;
  openCase(caseId: string): Promise<OpenCase>;
  saveCaseReview(caseId: string, expectedRevision: number, records: ReviewRecord[]): Promise<CaseReview>;
  exportCase(caseId: string): Promise<string | null>;
  importCase(): Promise<string | null>;
  deleteCase(caseId: string): Promise<void>;
  getDiagnostics(): Promise<SupportDiagnostics>;
  getCapabilities(): Promise<HostCapabilities>;
  startScan(request: ScanRequest): Promise<ScanSession>;
  startBatchScan(request: BatchScanRequest): Promise<ScanSession>;
  cancelScan(sessionId: string): Promise<void>;
  onScanEvent(handler: ScanEventHandler): Unsubscribe;
  getSession(sessionId: string): Promise<ScanSession | undefined>;
  getOfficialResult(sessionId: string): Promise<OfficialResult | undefined>;
  getExtraResult(sessionId: string): Promise<ExtraResult | undefined>;
  getScanCoverage(sessionId: string): Promise<ScanCoverageView | undefined>;
  getFindingDetail(sessionId: string, findingId: string): Promise<FindingDetailView | undefined>;
  getImageAnalysis(sessionId: string, query?: ImageAnalysisQuery): Promise<ImageAnalysisPage | undefined>;
  getEvidenceAsset(sessionId: string, assetId: string): Promise<EvidenceAsset | undefined>;
  getEvidenceSummary(sessionId: string): Promise<EvidenceSummary | undefined>;
  getEvidenceGraphSlice(sessionId: string, query: EvidenceGraphQuery): Promise<EvidenceGraphSlice | undefined>;
  exportResult(sessionId: string, directory: string): Promise<ExportPaths>;
  /** Local XLSX bytes from persisted sessions; always asks via native Save As. */
  saveWorkbook(sessionIds: string[], data: Uint8Array): Promise<string | null>;
  /** Separate result.json per session, under a newly created batch directory. */
  exportBatchResults(sessionIds: string[]): Promise<string | null>;
  saveTargetTemplate(): Promise<string | null>;
}
