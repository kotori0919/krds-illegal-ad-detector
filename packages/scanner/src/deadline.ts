import { performance } from "node:perf_hooks";
import { SCAN_POLICY } from "@krds-detector/contracts";

/** One monotonic budget shared by crawl, detection, evidence and finalization. */
export class ScanDeadline {
  static readonly hardLimitSec = SCAN_POLICY.deadline.hardLimitSec;
  static readonly finalizationReserveMs = SCAN_POLICY.deadline.finalizationReserveMs;

  private readonly expiresAtMs: number;
  private readonly reserveMs: number;

  constructor(timeoutSec: number, private readonly now: () => number = () => performance.now()) {
    if (!Number.isFinite(timeoutSec) || timeoutSec <= 0) {
      throw new RangeError("scan timeout must be positive");
    }
    const budgetMs = Math.min(timeoutSec, ScanDeadline.hardLimitSec) * 1000;
    this.expiresAtMs = now() + budgetMs;
    this.reserveMs = Math.min(ScanDeadline.finalizationReserveMs, budgetMs * 0.1);
  }

  remainingMs(): number {
    return Math.max(0, this.expiresAtMs - this.now());
  }

  expired(): boolean {
    return this.remainingMs() <= 0;
  }

  /** Page admission leaves time for one useful page and result finalization. */
  canStartPage(minPageMs: number = SCAN_POLICY.deadline.minPageMs): boolean {
    return this.remainingMs() > this.reserveMs + minPageMs;
  }

  /** Cap a Playwright operation so it cannot consume the finalization reserve. */
  operationTimeoutMs(requestedMs: number): number {
    return Math.max(0, Math.floor(Math.min(requestedMs, this.remainingMs() - this.reserveMs)));
  }
}
