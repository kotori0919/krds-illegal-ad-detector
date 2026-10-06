# ADR-0011: Single-pass bounded scanner and deterministic concurrency (2026-10-05)

Status: implementation, Linux L1/L2, actual process/session L3, full-object Windows 200-page C1-C4 acceptance and installed Windows deadline/partial export observed 2026-10-06. Strict product UX release gates remain open in PRODUCT_V2_ACCEPTANCE.md. Expands ADR-0010 and supersedes the two-pass execution implied by ADR-0007. The official result shape and selector format do not change.

## Context

`crawlSite` currently navigates pages serially, takes snapshots, and closes each page. `scanSite` then opens a second browser context and navigates every snapshot URL again for live detection; frame URLs are opened in separate pages. The crawl queue owns a wall-clock timeout based on `Date.now()`, but the second detection pass and finalization do not share it. `buildOfficialResult` assigns `f1`, `f2`, ... in candidate arrival order. Simply running the existing two passes concurrently would retain duplicate navigation, allow deadlines to reset, and make result IDs depend on worker timing.

## Decision

1. One `ScanDeadline`, based on a monotonic clock and created at scan start, is passed through navigation, settle, discovery, live DOM/CSS/geometry detection, live-frame inspection, optional evidence, and finalization. The effective budget is the lesser of the configured budget and an internal 1650 s guard. Never begin page work without a measured minimum processing/finalization reserve. On expiry, stop admissions, settle in-flight workers within the hard guard, persist completed-page results and issues, and finalize. Optional visual capture is skipped before any official detection is skipped.
2. A shared bounded frontier queue feeds a fixed worker pool. Initial policy: <=4 logical CPUs → 2; 5–8 → 3; >8 → 4; hard cap 4. A 4-vCPU/8-GB/GPU-less Windows machine starts at 2. Worker count 1 is a benchmark/control mode. The policy is provisional until measured on Windows; no unbounded `Promise.all` over URLs.
3. Each admitted page is navigated once. On its live Playwright `Page`, perform discovery, DOM/CSS/geometry analysis, direct inspection of available `Frame` objects, official detection, and selective evidence capture before close. Reuse scanner queue/URL, selector, detector, and result modules. Direct live-frame inspection preserves ancestor chain, absolute `src`, selector path, and `>>>` location serialization. Cross-origin and inaccessible frames become bounded typed issues; no automatic second `Page` navigation for every iframe URL.
4. Discovery uses deterministic breadth-depth frontier barriers: sorted entry frontier → bounded workers → collect discovered same-site URLs → normalize/deduplicate/sort → admit next depth up to `maxPages`. Completion order never decides which URL is admitted near the page limit. An equivalent scheduler is acceptable only if it proves the same admitted URL set under worker counts 1–4.
5. After all completed-page candidates arrive, deduplicate by official identity `(url, location, technique)`, choose any duplicate's evidence with a documented stable tie-break, sort by normalized page URL, frame path, location, technique, and stable tie-break, then assign `f1` onward. Stable ordering must not rewrite exported raw text or location. `FindingSet(C1) == FindingSet(C2) == FindingSet(C3) == FindingSet(C4)` is required for the same scenario, including coverage and issue identities; timing metadata may differ.

## Consequences and gates

- The worker pool owns one browser context and at most four active top-level pages, plus bounded live frames. Browser/context/route/resource caps remain. Every worker returns page-local data; one aggregator builds the final result and manifest. Progress counts distinguish discovered, in-flight, checked, failed, and provisional findings.
- Contract v0.2 replaces the sequential `crawling`/`analyzing` session lifecycle with `running`; discovery and analysis overlap across workers. The operator progress screen states the current activity without claiming a global crawl phase completed before analysis.
- A page failure does not discard successful pages. Deadline, cancellation, and host process supervision coordinate so neither worker nor Chromium remains after terminal state. A host watchdog enforces the 1650 s internal guard if the worker stalls; 1800 s is never approached as a normal operating target.
- Benchmark the same realistic L2 scenario at concurrency 1, 2, 3, 4. Record wall time, pages/sec, peak memory, CPU where available, checked/failed pages, TP/FP/FN, official finding set, and output validator. Repeat the delayed-injection case to protect the 1500 ms settle evidence; no speedup is accepted if semantics change.
- The desired acceptance target is 1200 s, configured normal budget 1500 s, internal hard stop 1650 s, official ceiling 1800 s. The internal guard is engineering detail, not ordinary operator copy. `docs/SCAN_STATE_MACHINE.md` owns terminal behavior and `docs/TEST_STRATEGY_V2.md` owns proof.

## Amendment 2026-10-06: browser admission

Browser startup consumes the same scan budget. When the remaining budget cannot
admit a page and preserve finalization time, the crawler returns a timed-out
empty summary without launching Chromium. An admitted launch uses the remaining
operation budget as its Playwright launch timeout. The host watchdog remains the
process-level backstop for stalled browser or worker cleanup.

## Amendment 2026-10-06: live completion feedback

The sorted frontier barrier controls admission and persisted output, while a
completed page emits its progress event immediately after its live processing
and close. Waiting for the whole depth to finish makes a large board appear
stalled. Progress confirmed counts deduplicate the same official identity as
the final result; repeated live-frame observations still count as candidates.
Progress event order may differ by worker completion. Finding IDs and output
order remain assigned only after canonical aggregation.

## Amendment 2026-10-06: recoverable progress

Each worker progress snapshot carries a strictly increasing sequence, queued
and attempted/failed page counts, up to four active page URLs, and the five
newest meaningful activities. Page admission adds the URL before navigation;
page close removes it before completion feedback. Activities use typed kinds
and numeric finding counts, not free-form worker prose. The host retains the
latest snapshot for `getSession`, so late subscription or missed events do not
leave an apparently idle screen. The UI ignores older poll/event sequences;
only the host session status controls terminal navigation. Host terminal
snapshots clear active work and use the validated final finding count.

Elapsed time advances from the worker's monotonic duration between updates.
Advancing the clock is not proof that a page has completed. A failed host
lookup is shown as unavailable status without fabricating a terminal state.

The operator and host accept configured budgets of 60 to 1500 seconds. This
removes the previous 1750-second promise that exceeded the internal guard.
Quick retains its existing 50-page/2-depth/600-second limits, now recorded
consistently in the product spec.

## Amendment 2026-10-06: successful coverage versus attempts

The completion audit found that `checkedPages` included failed snapshots.
This contradicted the operator's coverage model and DOMAIN_MODEL. Keep
`visitedPages`/`pagesVisited` as completed attempts, including failures;
`checkedPages` counts successful navigation and analysis only. Progress shows
successful checks as attempts minus failures. A valid partial result can have
more failed than successful pages; neither JS nor native validation may reject
that relation. Checked counts remain non-negative safe integers.

Fixture admission is unchanged: six attempted pages yield five checked and
one failed; the large scenario still attempts200 and yields199 checked plus
one failed. Benchmarks record attempts separately and compute successful-page
throughput from checked counts. Historical reports retain their measured raw
counts, labelled as attempts. The corrected worker requires fresh current
Windows concurrency, partial-result/export and optional-capture acceptance.
