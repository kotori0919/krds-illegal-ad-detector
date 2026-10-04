# Scan state machine V2

Status: target behavior for Contract v0.2, 2026-10-05. Current `ScanStatus` has queued/crawling/analyzing/finalizing/succeeded/cancelled/failed; partial coverage is not currently persisted.

## Lifecycle and operator state

| Internal state | Operator text | Data available | Allowed next action |
| --- | --- | --- | --- |
| queued | 점검 준비 중 | entry URL, start time | 점검 중지 |
| crawling | 페이지 수집 중 | measured visited/queued, current URL, issues | 점검 중지 |
| analyzing | 콘텐츠 분석 중 | completed-page counts, provisional findings, recent activity | 점검 중지 |
| finalizing | 결과 정리 중 | counts may be provisional; save disabled | Wait or stop if host supports safe settlement |
| succeeded + no issues | 점검 완료 | persisted official result, detail, coverage | review/save/new scan |
| succeeded + issues | 점검 완료 — 일부 페이지 확인 실패 | same result plus failure list | review/save with warning/new scan |
| cancelled | 점검 중지됨 | retained completed-page result only if manifest was committed | review partial retained data or new scan |
| failed | 점검을 완료하지 못했습니다 | reason and any explicitly retained coverage | return to setup/retry |

Partial completion is a derived **outcome** from `succeeded` and coverage, not a new raw worker enum. A scan with zero successfully analyzed pages is `failed`, even if the crawler discovered URLs. If a page fails during navigation or analysis, record a `ScanIssue`, continue bounded work when safe, and preserve successful findings. A global deadline stops new work, finalizes any already completed pages, and reports partial coverage; whether this is `succeeded` or `failed` follows the zero-success rule. Never announce “all pages checked” from a queue reaching zero alone.

## Transition rules

`queued → crawling → analyzing → finalizing → succeeded` is the normal path. Any active state may enter cancellation settlement, then `cancelled`; a fatal infrastructure error enters `failed`. Terminal states do not transition back to active. A new scan creates a new session. Duplicate terminal events are idempotent. The host records terminal state only after associated artifacts are readable. UI polls the canonical session record to resolve event/persistence races; events update the progress display but do not alone trigger a result route.

The current worker emits page-visited both while crawling and after analysis, and `elementsAnalyzed` currently increments by found candidates. These counters must be corrected or relabelled before the V2 UI presents them as analyzed elements or completed pages. `finding-confirmed` events must carry bounded, display-safe technique/page summaries for the recent activity list; do not rely on free-form worker messages as operator copy.

## Cancellation and retention decision

The target is to settle the worker and persist valid findings from fully analyzed pages with `cancelled` coverage, then show “중지 전 확인한 결과” and a coverage warning. Export of that partial official result is allowed only after normal validation and explicit partial warning in the save dialog. If no page finished or persistence failed, cancellation returns to setup with a clear “저장된 결과 없음” message. Until this retention path exists, the UI must accurately say that cancelling discards current results; it must not promise recovery.

## Bounded activity and failures

Recent activity keeps the five newest meaningful entries: stage change, official finding, page failure, cancellation, completion. Each has timestamp, Korean label, and affected page where known. Per-element debug messages stay out of the operator stream. `ScanIssue.reason` maps to short Korean wording; technical error strings remain expandable and sanitized. No invented percentage: stage is descriptive, page totals are unknown until discovery ends, elapsed time is a monotonic clock.
