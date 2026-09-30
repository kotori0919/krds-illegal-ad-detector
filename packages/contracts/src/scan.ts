/**
 * Contract v0 (frozen 2026-10-01): scan lifecycle.
 *
 * The UI drives scans only through HostBridge; these types are the shared
 * vocabulary between the React app, the Tauri host, and the scanner worker.
 */

export interface ScanLimits {
  /** Max navigated pages (same-site, deduplicated). */
  maxPages: number;
  /** Max crawl depth below the entry URL. */
  maxDepth: number;
  /** Hard wall-clock budget in seconds (official hard timeout: 1800). */
  timeoutSec: number;
  /** Max nested iframe depth to traverse. */
  maxFrameDepth: number;
}

export const DEFAULT_SCAN_LIMITS: ScanLimits = {
  maxPages: 200,
  maxDepth: 4,
  timeoutSec: 1500,
  maxFrameDepth: 4,
};

export interface ScanRequest {
  entryUrl: string;
  topic?: string;
  limits?: Partial<ScanLimits>;
}

export type ScanStatus =
  | "queued"
  | "crawling"
  | "analyzing"
  | "finalizing"
  | "succeeded"
  | "cancelled"
  | "failed";

export interface ScanSession {
  id: string;
  entryUrl: string;
  topic: string;
  status: ScanStatus;
  startedAt: string;
  finishedAt?: string;
  error?: string;
}

export type ScanEventKind =
  | "session-started"
  | "page-visited"
  | "page-queued"
  | "frame-inspected"
  | "element-analyzed"
  | "candidate-found"
  | "finding-confirmed"
  | "stage-changed"
  | "session-finished"
  | "session-cancelled"
  | "session-failed";

export interface ScanProgress {
  visitedPages: number;
  queuedPages: number;
  framesInspected: number;
  elementsAnalyzed: number;
  candidates: number;
  confirmedFindings: number;
  elapsedSec: number;
  stage: string;
}

export interface ScanEvent {
  kind: ScanEventKind;
  sessionId: string;
  at: string;
  progress: ScanProgress;
  message?: string;
  pageUrl?: string;
}

export function initialProgress(stage = "queued"): ScanProgress {
  return {
    visitedPages: 0,
    queuedPages: 0,
    framesInspected: 0,
    elementsAnalyzed: 0,
    candidates: 0,
    confirmedFindings: 0,
    elapsedSec: 0,
    stage,
  };
}
