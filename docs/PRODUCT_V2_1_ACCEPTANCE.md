# Product V2.1 implementation and acceptance

Baseline: `13a0764`, branch `dev/bootstrap`, Draft PR #2. The immutable
`rc-5e44feb-20261008` and its historical observations remain unchanged.

## M1 — grouped Results Workspace

The default official collection is a management projection: technique,
whitespace-normalized semantic text, site origin, explicit selector href,
and the **exact selector/frame chain** define a pattern. Exact selectors are
conservative selector families; classes/indices/frame resources are not erased.
This prevents unrelated DOM contexts from becoming a single alleged violation.
Only identical whitespace is normalized for display. Original text, IDs,
URLs, selectors, `is_violation`, and all four technique values remain intact.
Selector-derived links are labelled as such; no destination is automatically
opened. Stable pattern keys, IDs, member ordering and page ordering are independent
of input order. Repetition does not establish severity or a legal conclusion.

The supplied sanitized fixture is checked in under
`packages/evidence/test/fixtures/sample_result_617_sanitized.json`. Its actual
counts are 617 occurrences, 211 affected URLs, 616 OFFSCREEN, one JAMO, and
19 conservative patterns. Two patterns have 197 records on 197 unique pages;
the `li.sub-off` family has 187, with other selector contexts separate.
`f372` remains an independent review-needed record, not a confirmed false positive.
Bare official JSON has no measured coverage or screenshots; the UI reports
that absence instead of deriving checked pages from affected pages.

OBSERVED: `npx vitest run apps/web/test packages/evidence/test/review-patterns.test.ts`
passed 88 tests. Typecheck, lint, and frontend build passed. The built product
React -> Tauri adapter was exercised using **explicit offline IPC replay** by
`benchmarks/ui-v21-workspace-smoke.mjs`: 19 default rows, original-record
20/50 pagination, scope-confirmed bulk review, `f372` lookup, sequential group
inspection, keyboard Enter, return focus, 360px reflow, and 200% CSS zoom.
No remote page requests or JavaScript errors occurred. Review/export produced
byte-identical canonical official serialization (not the attachment's original
pretty-print formatting). Images remain lazy. The script's export is replay;
it is not evidence of a native Windows save.

Evidence: `/tmp/illegal-ad-v21-m1/observed.json`, `grouped-desktop.png`,
`f372-inspector.png`, `f372-360px.png`, `workspace-200-percent.png`, `result.json`.
NOT_RUN in M1: installed Windows acceptance and an uninstructed human tester.
Review state remains local screen memory in this milestone.

## M2 — operational workbook and review notes

The Results header provides **엑셀 보고서 저장**, separate from **공식 JSON 저장**.
It reads the same persisted official session, optional coverage/extra/analysis,
and the current local human review records. All records are exported regardless
of the current search/filter. Six sheets include summary, management patterns,
one row per official finding, coverage, supplemental analysis and review history.
Excel forbids `/` in worksheet names, so the coverage sheet is named
`페이지·점검 범위`. Aggregates use the same writer with a `대상 요약` sheet.
Date headings explicitly use UTC. URLs are copyable text, without untrusted
active hyperlinks. Strings are explicitly string cells; length/control-character
limits are explained while official JSON remains unchanged. Header freezing,
widths, wrapping and filters are included. ExcelJS 4.4.0 is pinned locally and
lazy-loaded; no Office, cloud service or GPU is required.

Review marks and notes share one session-screen state and timestamps. Notes
are limited to 2,000 characters. They are included in the workbook; app-restart
persistence is not claimed. Optional read failures are included as report
limitations. Export failure/cancellation retains official results and review.
The HostBridge command always uses native Save As, validates every referenced
official session, bounds bytes, enforces `.xlsx` and commits a complete temporary
file by rename; failed writes preserve the previous destination.

OBSERVED: actual XLSX writer/read-back tests preserve all 617 raw findings,
19 management rows, f372 notes, and independent-session aggregate details.
Hostile `=HYPERLINK`, `+`, `@`, and `-` strings create no formula or hyperlink
cells. The built UI smoke saves and reopens a real six-sheet workbook with
617 detail rows while filtered to f372; native Save As is still explicit replay
in that smoke. The save-failure/cancellation/retry UI test preserves official
JSON. The Rust write-path test preserves an existing destination on invalid
data and leaves no temporary file after a complete write. GNU LLVM Windows
`cargo check` passes for the registered native command.
NOT_RUN at this checkpoint: actual installed Windows Save As; this is reserved
for the integrated candidate acceptance in M5, not asserted from replay or compilation.

The shared migration adds a native workbook bridge, reusable Korean technique
labels and optional typed access/discovery metadata outside official JSON.
Local XML parsing dependencies are prepared for M3/M4 without altering the
official serializer or runtime RC.

## M3 — access limitations and sitemap discovery

HTTP 200 with `cf-mitigated: challenge` is uninspected, not successful/clean.
Typed challenge, denial, rate limit, login, timeout and navigation failures are
kept in supplemental coverage, displayed in Korean and included in XLSX.
Both TypeScript and native validators reconcile status with the typed issue.
429 waits at most five seconds before further site admission, without retries.
All-blocked and zero-admission scans retain a truthful official empty result and
coverage; the operator is told that no page was successfully checked.

Robots declarations, conventional sitemap, bounded nested indexes and live
links share deterministic same-site admission, page/depth limits and deadline.
Limits and robots matching are recorded in `CRAWLER.md`. XML entities/DTD,
malformed/multiple roots and external sitemap redirects are rejected.
No CAPTCHA solver or access-control change is part of this implementation.

OBSERVED: 29 scoped crawler/detector tests pass, including a real `scanSite`
against an owned HTTP 200 challenge (checked 0, failed 1, no findings), recursive
sitemaps, robots exclusions, bounded rate-limit delay and cancellation.
Seven contract/access tests and the native coverage reconciliation test pass.
Scanner build, scoped typecheck and lint pass. The original official serializer
and four technique enums remain unchanged.

## Remaining ordered milestones

M4: network-free safe file preview, sequential independent batch sessions,
per-site official outputs and aggregate workbook.
M5: focused integrated acceptance and separate Windows installer candidate.
