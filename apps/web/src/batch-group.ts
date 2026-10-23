import type {
  BatchGroup, BatchGroupPhase, BatchGroupScope, HostBridge, ScanConnection, ScanLimits,
} from "@krds-detector/contracts";
import { batchResultStatus, type BatchState, type RestoredBatch, type RestoredTarget } from "./batch-coordinator.js";

export interface BatchGroupSource {
  groupId: string;
  createdAt: string;
  scope: BatchGroupScope;
  connection: ScanConnection;
}

/** Recovered targets plus what the operator must be told about them. */
export interface BatchRestore extends RestoredBatch {
  interrupted: number;
  unreadable: number;
}

/** Same scope wording as the import screen; a restored group keeps its own scope. */
export function batchScopeLimits(scope: BatchGroupScope): Partial<ScanLimits> {
  return scope === "entry" ? { maxPages: 1, maxDepth: 0, timeoutSec: 60 }
    : scope === "quick" ? { maxPages: 50, maxDepth: 2, timeoutSec: 600 }
      : { maxPages: 200, maxDepth: 4, timeoutSec: 1500 };
}

/** crypto.randomUUID is not guaranteed in every webview origin. */
export function newBatchGroupId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Durable projection of a live batch: identity, order, per-target status and
 * the case binding only. Official output and review records stay inside each
 * case directory.
 */
export function toBatchGroup(source: BatchGroupSource, state: BatchState, now = new Date().toISOString()): BatchGroup {
  return {
    schemaVersion: 1,
    groupId: source.groupId,
    createdAt: source.createdAt,
    updatedAt: now,
    phase: state.phase,
    scope: source.scope,
    connection: source.connection,
    targets: state.targets.map((target) => ({
      key: target.key,
      label: target.label,
      entryUrl: target.entryUrl,
      kind: target.kind,
      status: target.status,
      // Only a stored result has a case directory to reopen; a running scan does not.
      caseId: target.session?.hasResult ? target.session.id : undefined,
      error: target.error,
    })),
  };
}

/** Durable facts only, so 500 ms progress polling never rewrites the group file. */
export function batchGroupFingerprint(state: BatchState): string {
  return JSON.stringify([state.phase, state.targets.map((target) =>
    [target.key, target.status, target.session?.hasResult ? target.session.id : "", target.error ?? ""])]);
}

/**
 * Reopen a saved group without touching the network. Each completed target's
 * case is opened through the host, which is what makes its official result and
 * saved judgments readable again after a restart. Targets that never stored a
 * result stay "pending" (continue) and are reported as interrupted, never as
 * covered.
 */
export async function restoreBatchGroup(host: HostBridge, group: BatchGroup): Promise<BatchRestore> {
  let interrupted = 0;
  let unreadable = 0;
  const targets = await Promise.all(group.targets.map(async (saved): Promise<RestoredTarget> => {
    if (!saved.caseId) {
      const remaining = saved.status === "pending" || saved.status === "running"
        || saved.status === "failed" || saved.status === "cancelled";
      if (remaining) interrupted += 1;
      return { status: remaining ? "pending" : saved.status, canRetry: false };
    }
    try {
      await host.openCase(saved.caseId);
      const session = await host.getSession(saved.caseId);
      if (!session) throw new Error("case session unavailable");
      const coverage = session.hasResult ? await host.getScanCoverage(saved.caseId) : undefined;
      // A committed case can precede the group's final status write at shutdown.
      // Keep that result instead of admitting the target as new work.
      const status = saved.status === "running" && session.hasResult ? batchResultStatus(session, coverage)
        : saved.status === "running" ? "pending" : saved.status;
      return {
        status,
        session,
        error: saved.error,
        canRetry: status === "failed" || status === "cancelled"
          || (coverage?.pageOutcomes.some((page) => page.issue?.retryable) ?? false),
      };
    } catch {
      // A case file that cannot be reopened must be visible as missing evidence.
      unreadable += 1;
      return {
        status: "failed",
        canRetry: false,
        error: "저장된 사례를 다시 열지 못했습니다. 이 대상은 통합 보고서에 포함되지 않습니다.",
      };
    }
  }));
  return {
    targets,
    // A crash mid-run is shown as paused work the operator can continue.
    phase: group.phase === "running" || group.phase === "ready" ? "paused" : group.phase,
    interrupted,
    unreadable,
  };
}

export const batchGroupPhaseLabels: Record<BatchGroupPhase, string> = {
  ready: "시작 전", running: "진행 중", paused: "일시정지됨", stopped: "중지됨", complete: "완료",
};
