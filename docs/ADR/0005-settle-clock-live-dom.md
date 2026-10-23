# ADR-0005: Settle clock from navigation start, live-DOM snapshots

Status: settle-clock decision superseded by ADR-0014; live-DOM snapshot decision remains accepted.

## Context

Delayed ad injection (`setTimeout` 1.2 s) must be observed without unbounded
waits, but `domcontentloaded`/`networkidle` pre-waits already consume the
delay budget, and raw response bodies never contain injected nodes.

## Decision

- `waitUntil: "commit"`; the settle window is measured from navigation start
  (`settleBudget - waited`), not after load-state barriers.
- Snapshots read the live DOM (`page.content()`), never the raw response body.
- Fixture delayed element uses a distinct id (`ad-delayed-injected`) so
  script-text false positives are impossible; the integration test asserts
  element presence at settle 1800 ms and absence at settle 0.

## Consequences

- Settle cost is bounded and predictable per page (default 1500 ms).
- Evaluation timing claims must cite settle values; zero-settle runs are
  negative controls, not performance figures.
