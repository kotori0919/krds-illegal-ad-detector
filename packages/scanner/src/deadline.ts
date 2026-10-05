import { availableParallelism } from "node:os";
import { performance } from "node:perf_hooks";

/** One monotonic budget shared by crawl, detection, evidence and finalization. */
export class ScanDeadline {
  static readonly hardLimitSec = 1650;
  static readonly finalizationReserveMs = 30_000;

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
  canStartPage(minPageMs = 2_000): boolean {
    return this.remainingMs() > this.reserveMs + minPageMs;
  }

  /** Cap a Playwright operation so it cannot consume the finalization reserve. */
  operationTimeoutMs(requestedMs: number): number {
    return Math.max(0, Math.floor(Math.min(requestedMs, this.remainingMs() - this.reserveMs)));
  }
}

/** Conservative initial policy; benchmarked at 1–4 workers before release. */
export function pageConcurrency(logicalCpus = availableParallelism()): number {
  if (!Number.isFinite(logicalCpus) || logicalCpus < 1) throw new RangeError("logical CPU count must be positive");
  return logicalCpus <= 4 ? 2 : logicalCpus <= 8 ? 3 : 4;
}
