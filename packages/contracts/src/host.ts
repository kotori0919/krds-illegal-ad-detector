/**
 * Contract v0 (frozen 2026-10-01): host capability model + bridge.
 *
 * Normal React code talks to `HostBridge` only. Tauri APIs stay inside the
 * platform adapter (apps/web/src/host/tauri.ts + src-tauri). BrowserHost
 * exposes UI/replay/demo only and must not weaken browser security to fake
 * local scanning.
 */

import type { ScanEvent, ScanRequest, ScanSession } from "./scan.js";
import type { ExtraResult, OfficialResult } from "./result.js";

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
  getCapabilities(): Promise<HostCapabilities>;
  startScan(request: ScanRequest): Promise<ScanSession>;
  cancelScan(sessionId: string): Promise<void>;
  onScanEvent(handler: ScanEventHandler): Unsubscribe;
  getSession(sessionId: string): Promise<ScanSession | undefined>;
  getOfficialResult(sessionId: string): Promise<OfficialResult | undefined>;
  getExtraResult(sessionId: string): Promise<ExtraResult | undefined>;
  exportResult(sessionId: string, directory: string): Promise<ExportPaths>;
}
