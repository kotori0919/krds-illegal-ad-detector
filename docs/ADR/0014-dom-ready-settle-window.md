# ADR-0014: Start the bounded settle window after DOM readiness (2026-10-06)

Status: accepted; supersedes the settle-clock part of ADR-0005.

## Context

ADR-0005 measured the settle interval from navigation start. In a concurrent
full-suite run, the delayed-injection fixture missed its 1200 ms DOM timer
despite an 1800 ms settle setting: browser commit and script execution were
separated by load contention. A navigation-start clock can consume the entire
window before the page's timer is scheduled.

## Decision

Navigate with `waitUntil: "commit"`, then wait for `domcontentloaded` within
the shared deadline and per-page budget. Start the configured settle interval
after that barrier. Cap both waits by the remaining page budget (leaving one
second for analysis) and by `ScanDeadline.operationTimeoutMs`, which protects
whole-scan finalization. If DOM readiness cannot be reached in budget, continue
with a bounded best-effort settle and record the page through the existing
navigation/analysis failure path if it cannot be analyzed.

Continue to extract snapshots from the live DOM. A zero-settle control still
waits for DOM readiness but does not wait for delayed timers.

## Consequences

The 1500 ms default now means time after DOM readiness and can increase page
wall time relative to the former navigation-start policy. Re-run concurrency
benchmarks after this change; historical numbers remain labelled by policy.
The actual browser path must retain delayed content under concurrent load.
