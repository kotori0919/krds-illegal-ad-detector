/**
 * Contract v0.2: one running state for concurrent discovery and analysis.
 *
 * The UI drives scans only through HostBridge; these types are the shared
 * vocabulary between the React app, the Tauri host, and the scanner worker.
 */

export interface ScanLimits {
  /** Max navigated pages (same-site, deduplicated). */
  maxPages: number;
  /** Max crawl depth below the entry URL. */
  maxDepth: number;
  /** Configured scan budget in seconds; operator/host range is 60..1500. */
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
  | "running"
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
  progress: ScanProgress;
}

export type ScanEventKind =
  | "session-started"
  | "page-started"
  | "page-failed"
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
  sequence: number;
  visitedPages: number;
  failedPages: number;
  queuedPages: number;
  currentPages: string[];
  recentActivity: ScanActivity[];
  framesInspected: number;
  elementsAnalyzed: number;
  candidates: number;
  confirmedFindings: number;
  elapsedSec: number;
  stage: ScanStatus;
}

export interface ScanActivity {
  sequence: number;
  kind: "session-started" | "finding-confirmed" | "page-failed" | "stage-changed"
    | "session-finished" | "session-cancelled" | "session-failed";
  elapsedSec: number;
  stage: ScanStatus;
  pageUrl?: string;
  findingCount?: number;
}

export interface ScanEvent {
  kind: ScanEventKind;
  sessionId: string;
  at: string;
  progress: ScanProgress;
  message?: string;
  pageUrl?: string;
}

export function initialProgress(stage: ScanStatus = "queued"): ScanProgress {
  return {
    sequence: 0,
    visitedPages: 0,
    failedPages: 0,
    queuedPages: 0,
    currentPages: [],
    recentActivity: [],
    framesInspected: 0,
    elementsAnalyzed: 0,
    candidates: 0,
    confirmedFindings: 0,
    elapsedSec: 0,
    stage,
  };
}
