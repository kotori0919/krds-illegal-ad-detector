import type { HostBridge, ImportedTarget, ScanConnection, ScanLimits, ScanSession } from "@krds-detector/contracts";

export type TargetStatus = "pending" | "running" | "complete" | "partial" | "blocked" | "failed" | "cancelled";
export interface BatchTarget extends ImportedTarget {
  key: number; status: TargetStatus; session?: ScanSession; canRetry: boolean; error?: string;
}
export interface BatchState {
  phase: "ready" | "running" | "paused" | "stopped" | "complete";
  targets: readonly BatchTarget[]; pauseRequested: boolean;
}
/** One target recovered from a durable group; index-aligned with the targets. */
export interface RestoredTarget {
  status: TargetStatus; session?: ScanSession; error?: string; canRetry?: boolean;
}
export interface RestoredBatch {
  phase: BatchState["phase"]; targets: readonly RestoredTarget[];
}
const terminal = (status: ScanSession["status"]): boolean => ["succeeded", "failed", "cancelled"].includes(status);

/** One awaited native session at a time; completed sessions are never discarded. */
export class BatchCoordinator {
  private state: BatchState;
  private listeners = new Set<(state: BatchState) => void>();
  private active?: Promise<void>;
  private stopping = false;
  constructor(private readonly host: HostBridge, targets: readonly ImportedTarget[],
    private readonly limits: Partial<ScanLimits> = {}, private readonly pollMs = 500,
    private readonly connection: ScanConnection = "direct", restored?: RestoredBatch) {
    if (!targets.length || targets.length > 100) throw new Error("일괄 대상은 1~100개여야 합니다.");
    if (restored && restored.targets.length !== targets.length) throw new Error("복원된 일괄 대상 수가 일치하지 않습니다.");
    this.state = { phase: restored?.phase ?? "ready", pauseRequested: false,
      targets: targets.map((target, key) => {
        const saved = restored?.targets[key];
        return { ...target, key, status: saved?.status === "running" ? "pending" : saved?.status ?? "pending",
          session: saved?.session, error: saved?.error, canRetry: saved?.canRetry ?? false };
      }) };
  }
  snapshot(): BatchState { return this.state; }
  subscribe(listener: (state: BatchState) => void): () => void {
    this.listeners.add(listener); listener(this.state);
    return () => { this.listeners.delete(listener); };
  }
  private publish(patch: Partial<BatchState>): void {
    this.state = { ...this.state, ...patch }; for (const listener of this.listeners) listener(this.state);
  }
  private update(key: number, patch: Partial<BatchTarget>): void {
    this.publish({ targets: this.state.targets.map((target) => target.key === key ? { ...target, ...patch } : target) });
  }
  pause(): void { if (this.state.phase === "running") this.publish({ pauseRequested: true }); }
  async stop(): Promise<void> {
    this.stopping = true;
    const current = this.state.targets.find((target) => target.status === "running");
    if (current?.session) await this.host.cancelScan(current.session.id);
    if (!this.active) this.publish({ phase: "stopped", pauseRequested: false });
    await this.active;
  }
  start(): Promise<void> {
    if (this.active) return this.active;
    this.stopping = false;
    this.publish({ phase: "running", pauseRequested: false });
    this.active = this.run().finally(() => { this.active = undefined; });
    return this.active;
  }
  retry(key: number): Promise<void> {
    const target = this.state.targets.find((item) => item.key === key);
    if (this.active || !target?.canRetry) throw new Error("현재 대상은 재시도할 수 없습니다.");
    this.update(key, { status: "pending", canRetry: false, error: undefined });
    return this.start();
  }
  private async run(): Promise<void> {
    for (const target of this.state.targets) {
      if (this.stopping || this.state.pauseRequested) break;
      if (target.status !== "pending") continue;
      this.update(target.key, { status: "running", error: undefined });
      let session: ScanSession | undefined;
      try {
        session = await this.host.startBatchScan({ entryUrl: target.entryUrl, kind: target.kind, limits: this.limits, connection: this.connection });
        this.update(target.key, { session });
        if (this.stopping) await this.host.cancelScan(session.id);
        const expires = Date.now() + ((this.limits.timeoutSec ?? 1500) + 45) * 1000;
        while (!terminal(session.status)) {
          if (Date.now() > expires) throw new Error("점검 상태 확인 시간이 초과되었습니다. 현재 점검을 중지했습니다.");
          await new Promise((resolve) => setTimeout(resolve, this.pollMs));
          const next = await this.host.getSession(session.id);
          if (!next) throw new Error("점검 세션을 읽지 못했습니다. 현재 점검을 중지했습니다.");
          session = next; this.update(target.key, { session });
        }
        let status: TargetStatus = session.status === "cancelled" ? "cancelled" : session.status === "failed" ? "failed" : "complete";
        let canRetry = false;
        if (session.hasResult) {
          const coverage = await this.host.getScanCoverage(session.id);
          canRetry = coverage?.pageOutcomes.some((page) => page.issue?.retryable) ?? false;
          if (session.status === "succeeded") status = !coverage ? "partial" : coverage.coverage.checkedPages === 0 ? "blocked"
            : coverage.coverage.failedPages.length || coverage.coverage.timedOut || coverage.coverage.cancelled ? "partial" : "complete";
        }
        this.update(target.key, { status, session, canRetry, error: session.error });
      } catch (error) {
        if (session && !terminal(session.status)) {
          // Do not admit another site while ownership of the old worker is uncertain.
          this.stopping = true;
          try { await this.host.cancelScan(session.id); } catch { /* Keep stopped and surface the original failure. */ }
        }
        this.update(target.key, { status: "failed", session, canRetry: false,
          error: error instanceof Error ? error.message : "점검을 시작하지 못했습니다." });
      }
    }
    this.publish({ phase: this.stopping ? "stopped" : this.state.pauseRequested ? "paused" : "complete", pauseRequested: false });
  }
}
