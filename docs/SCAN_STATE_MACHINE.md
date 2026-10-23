# Scan state machine V2

Status: Contract v0.2 running-state, zero-success failure, active-page feedback,
bounded recent activity and host snapshot recovery implemented 2026-10-06.
`ScanStatus` uses queued/running/finalizing/succeeded/cancelled/failed because
each page is discovered and analyzed in one live pass. Actual packaged
Windows progress, active-worker cancellation settlement, restart and short
deadline partial-result/export observations are recorded in DRY_RUN and PERF.
Cancellation cooperatively settles the worker and preserves validated results
from completed pages. The canonical host snapshot exposes `hasResult` only after
all three artifacts have been validated and stored. Deadline expiry finalizes a
partial succeeded result.

## Lifecycle and operator state

| Internal state | Operator text | Data available | Allowed next action |
| --- | --- | --- | --- |
| queued | 점검 준비 중 | entry URL, start time | 점검 중지 |
| running | 페이지를 찾고 분석하는 중 | discovered/queued/in-flight/checked counts, current pages, provisional findings and issues | 점검 중지 |
| finalizing | 결과 정리 중 | counts may be provisional; save disabled | Wait or stop if host supports safe settlement |
| succeeded + no issues | 점검 완료 | persisted official result, detail, coverage | review/save/new scan |
| succeeded + issues | 점검 완료 — 일부 페이지 확인 실패 | same result plus failure list | review/save with warning/new scan |
| cancelled + hasResult | 중지 전 확인한 결과 | validated official result, detail and extra result; cancelled coverage | review/save with partial warning/new scan |
| cancelled + no result | 점검 중지됨 — 저장된 결과 없음 | terminal session/progress snapshot | return to setup and start a new scan |
| failed | 점검을 완료하지 못했습니다 | reason and any explicitly retained coverage | return to setup/retry |

Partial completion is a derived **outcome** from `succeeded` and coverage, not a new raw worker enum. A scan with zero successfully analyzed HTTP-success pages is `failed`, even if the crawler discovered URLs. If a page fails during navigation or analysis, record a `ScanIssue`, continue bounded work when safe, and preserve successful findings. A global deadline stops new work, finalizes any already completed pages, and reports partial coverage; whether this is `succeeded` or `failed` follows the zero-success rule. Never announce “all pages checked” from a queue reaching zero alone.

## One deadline across concurrent work

Create a monotonic `ScanDeadline` when the scan starts; do not restart it between crawl, analysis, frames, evidence, and serialization. The effective expiry is `min(configured budget, 1650 s internal guard)`. Normal preset is 1500 s, desired Windows acceptance is 1200 s, and the official ceiling is 1800 s. Before admitting a page, all workers check that remaining time exceeds an initial 30 s finalization reserve plus a measured minimum safe page budget. The 30 s reserve is provisional until the Windows benchmark establishes finalization tail latency. Each Playwright navigation/settle/frame/capture timeout is capped by remaining time; no worker starts a frame or capture that cannot finish before reserve. Optional capture yields before detection. A host watchdog covers a hung worker and closes its process tree by the hard guard.

The host backstop uses `min(configured worker budget + 150 s, 1650 s)` from
sidecar launch, independently of the worker's monotonic scan deadline. This
allows worker startup, browser shutdown and artifact persistence to finish.
The grace never admits additional page work.

The coordinator admits a sorted breadth-depth frontier to a bounded pool:
2 active pages on <=4 logical CPUs, 3 on 5–8, 4 above 8; hard cap 4.
Depth-frontier completion creates the next sorted frontier, so completion
order does not choose pages at `maxPages`. Attempted pages increment checked
coverage after close; failed pages are a subset, not additional checked pages.
Active pages are separate from queued work. Unstarted pages yield to the shared
deadline. Finding counts during work are provisional; IDs and official totals
exist only after deterministic aggregation.

## Transition rules

`queued → running → finalizing → succeeded` is the normal V2 path. Discovery and analysis overlap inside `running`; the UI may describe a specific current activity but must not pretend that all crawling ended before analysis began. Any active state may enter cancellation settlement, then `cancelled`; a fatal infrastructure error enters `failed`. Terminal states do not transition back to active. A new scan creates a new session. Duplicate terminal events are idempotent. The host records terminal state only after associated artifacts are readable. UI polls the canonical session record to resolve event/persistence races; events update the progress display but do not alone trigger a result route.

The worker emits `page-started` at admission and removes the active URL after
page close. `page-visited` or `page-failed` increments attempted-page coverage;
failed pages are a subset of that count, consistent with the detail contract.
`elementsAnalyzed` counts extracted elements. A progress snapshot carries an
increasing sequence, at most four current URLs and five typed activities.
Finding activities carry the newly deduplicated count and affected URL.
The host stores this snapshot and its finalizing stage for `getSession`.
Older poll/event sequences are ignored; terminal host snapshots clear work,
include a terminal activity and reconcile validated official counts.
Operator text maps typed fields to Korean and does not render worker messages.
The `mm:ss` clock advances between snapshots with `performance.now()` without
announcing every tick or pretending that another page completed.

## Cancellation and retention decision

The host sends `{"type":"cancel"}` over the worker's piped stdin and keeps the
session `finalizing` while active work settles. The worker stops admissions,
aborts active pages and writes completed-page artifacts with cancelled coverage.
After a ten-second cooperative grace, the host forces process termination; the
Windows Job Object remains the process-tree backstop. The worker monitor waits
for exit before the host validates and stores the official, detail and extra
bundle, then emits its terminal event. A late natural exit cannot turn an
accepted cancellation into success.

Valid completed-page artifacts produce `cancelled` with `hasResult: true` and
“중지 전 확인한 결과”. Export uses the same official validation as success and
the save dialog explicitly warns that coverage is partial. No completed page,
missing artifacts or failed validation produce `cancelled` with `hasResult:
false` and “저장된 결과 없음”. UI navigation follows this stored snapshot rather
than a worker event or a cancellation request alone.

## Bounded activity and failures

Recent activity keeps the five newest meaningful entries: stage change, official finding, page failure, cancellation, completion. Each has timestamp, Korean label, and affected page where known. Per-element debug messages stay out of the operator stream. `ScanIssue.reason` maps to short Korean wording; technical error strings remain expandable and sanitized. No invented percentage: stage is descriptive, page totals are unknown until discovery ends, elapsed time is a monotonic clock.
