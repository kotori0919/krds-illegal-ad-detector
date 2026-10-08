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
Image coverage in `점검 요약` uses separate Korean-labelled counts, collection
and OCR limits, reached limits and excluded/failed units instead of a raw JSON
cell. Missing coverage and the unknown full candidate total remain explicitly
unknown. `탐지 상세` and `반복 항목` show Korean technique names beside unchanged
official technique codes; every original finding and management group remains
in the export.
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

## M4 — safe file intake and sequential batch

The secondary **여러 사이트 일괄 점검** path reads XLSX/CSV/JSONL/XML Sitemap
in a disposable offline worker. Input is 2MiB/100 targets; ZIP actual expansion,
active content, formulas, XML entities and materialization bounds precede parsing.
The worker is terminated after ten seconds. Korean CSV template uses native Save As.
Known column aliases are documented in `TARGET_IMPORT.md`; ambiguous mapping is
rejected instead of guessed. Preview counts valid/invalid/duplicate rows and makes
no target connection. Explicit start admits valid rows only.

BatchCoordinator awaits one independently supervised ScanSession at a time.
Pause takes effect after the current site; stop cancels it while keeping completed
results. A lost active session stops admission. Only typed retryable failures can
be explicitly retried. Review notes are keyed by session as well as finding ID.
Per-site native folder export creates a fresh directory with independent
`result.json`, separate extra/coverage and a manifest. Aggregate XLSX has all
target states (including pending/failed unknown counts), with exact session-keyed
detail. Results remain available in this app session; operators must save before
app exit. Restoration of a batch after app restart is not claimed.

File-started scans use a distinct native command that always enables public-only
transport. An authenticated loopback HTTP/CONNECT proxy pins validated public DNS
answers for each connection, including redirects and subresources. Node sitemap
requests use the same pinned policy. Browser loopback bypass/direct DNS/QUIC and
non-proxied UDP are disabled; service workers are blocked. Exact owned origins are
allowed only by a programmatic test policy, never file/CLI/UI configuration.
This is an application transport boundary, not an OS network sandbox.
Single-URL contest mode retains its existing controlled-local inspection behavior.

OBSERVED: 52 parser tests, three orchestration behavior tests, 15 public-network/
sitemap tests, report read-back, frontend build/lint/typecheck and native GNU LLVM
check pass. Actual Chromium attempts through HTTP/HTTPS redirects, images,
iframes, fetch and DNS rebinding reach zero protected-server TCP connections.
The built UI smoke `ui-v21-batch-smoke.mjs` previews all four formats with zero
target requests, runs two owned sites using actual canonical scanSite (peak one
active site), retains independent official outputs, saves a seven-sheet aggregate,
isolates notes for equal finding IDs, and preserves the first completed site when
the second is stopped. Each normal site checks root, sitemap detail and recorded
link; robots-excluded path is not requested. Transport/export IPC in this Linux
smoke is explicitly harnessed, not asserted to be native Save As.
Evidence: `/tmp/illegal-ad-v21-batch/{observed.json,preview.png,preview-360px.png,
completed.png,cancel-retained.png,aggregate.xlsx,exported/}`.

## M5 — focused correctness and operator acceptance

The original sanitized f372 record stays unchanged. Actual owned HTML reproduces
the visible ordinary comment and legitimate collapsed navigation false positives;
both fail before the general correction and pass afterwards while hidden offers,
ad action destinations and fragmented advertising remain detectable. Exact DOM,
styles and surrounding context of the original external sample are unavailable;
it is still review-needed. See `OPERATOR_CANDIDATE_REVIEW.md` for the boundaries.

OBSERVED: the integrated typecheck, lint and 56-file/336-test suite pass. The
latest bundled worker passes actual native-session persistence/evidence smoke.
The rebuilt 617-record workspace smoke passes, with original canonical JSON
unchanged and a full six-sheet XLSX despite the one-record filter.

An independent automated tester, given the operator tasks but no UI instructions,
used visible controls/screens only to find f372, inspect f3/f6 in a 197-record/
197-page group, find the link's 211 affected pages, inspect missing evidence and
save XLSX with a local memo. Actual workbook read-back found 617 detail rows and
that memo. The tester's two usability findings are corrected: aggregate affected
pages are visible in grouped mode, and otherwise identical groups have distinct
representative records plus an optional exact-location explanation.
Evidence: `/tmp/illegal-ad-v21-operator-tester/operator-review.md` and screenshots;
`/tmp/illegal-ad-v21-operator/report.xlsx`. This is an automated, uninstructed
operator exercise, not a human participant study. CUA offered no browser; the
authorized local Playwright fallback used visible accessibility controls.

OBSERVED: the separate `rc-v21-105ce20-20261008` candidate installs under a new
ordinary-user Windows path; 679 static payload hashes match. Actual XLSX Save As
cancellation/retry, six-sheet read-back, canonical JSON Save As, independent
directory export, HTTP 200 challenge, four-format preview and native batch
startup failures pass their focused checks. Normal close disconnects CDP and
the installed host PID is absent. The original RC installer, manifest and all
static payload hashes remain unchanged. Full scope and screenshot mapping are
in [RELEASE_CANDIDATE_V21.md](RELEASE_CANDIDATE_V21.md). Historical acceptance is
not substituted for new paths. Successful owned two-site execution is Linux;
the Windows public-only test uses two nonexistent reserved DNS names and
preserves failure without inventing results. Human participant and assistive-
technology evaluation are NOT_RUN in this environment.
