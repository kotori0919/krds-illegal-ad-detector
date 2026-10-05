# UX flow V2

Status: design freeze, 2026-10-05. `SCREEN_SPEC.md` defines content and responsive behavior.

## Canonical path

1. **점검 설정**: Focus URL. Operator enters a public-site address, reads the scope summary, optionally opens 상세 설정, then selects 점검 시작. Inline URL/limit errors keep entered values and move focus to the first error.
2. **사이트 점검**: The shell identifies the site and shows preparation → live page discovery/analysis → finalization with text state. Page collection and analysis overlap in bounded workers. A running clock and confirmed counters make progress verifiable. Recent activity shows meaningful findings and page failures, capped to a short list. 점검 중지 requires confirmation that the active scan will stop; UI waits for host settlement and reports whether any completed-page data is available.
3. **결과 검토**: Once a result is persisted, the operator sees official findings, affected/checked pages, duration, partial failures, and separate extra-analysis count. They can filter by technique, search content or page, group by page, inspect many findings, view coverage failures, then generate `result.json`.

## Review loop

`공식 탐지 → 필터/검색 → 항목 선택 → 근거 확인 → 다음 항목` remains on one desktop workspace. Choosing another row replaces the inspector content. The selected row has a text/shape cue and accessible current indication. If a filter hides the selection, the inspector closes with a clear message or selects the first visible result; it never displays an out-of-filter finding as if it matched. No automatic list reset after closing the inspector.

The result header states the total and visible count. A single search field remains populated while the operator changes category, filter, and finding selection. Filter changes update the visible count immediately; a zero match says why and offers 조건 초기화. Search does not reappear in the header or inspector. This follows KRDS search-result and filtering behavior, with loading, empty, and recovery states distinct.

On narrow screens, 항목 선택 opens a full-screen detail view. Back returns to the exact official list mode, filter, search, selected row, and scroll position where the platform permits; focus returns to the invoking row. If the row was removed by a changed filter, focus goes to the list heading. Browser back follows the same restoration rule. Keyboard users can tab through rows and open details with Enter/Space; Escape closes a non-modal detail sheet or the save dialog as applicable.

`페이지별` groups official findings by canonical `OfficialFinding.url`, shows count and technique breakdown, then expands to the same finding inspector. Filtering and search operate on findings first; group counts reflect the visible subset and also state when a group is filtered. A full absolute URL is available for copy, while the path is the scan-friendly label. iframe location stays in technical detail; its containing public page remains the primary page label.

## Other result paths

- **추가 분석**: Separate from official counts/export. Summaries say what was observed (repeated creative, shared technical indicator, destination/redirect) without asserting common ownership. A graph is optional secondary detail.
- **점검 범위**: Checked pages and failures with page address, Korean reason, and next action (retry in a new scan or inspect access). No false claim that a failed page was checked.
- **결과 파일 생성**: Opens a confirmation dialog with six text validation states, official finding count, and partial-coverage warning if needed. 파일 저장 calls the existing validated native export. Cancel, save-dialog cancel, and save error all leave the workspace intact. Raw JSON is optional technical detail.
- **새 점검**: Returns to setup with the previous URL optionally retained, but clears session-scoped review/filter state.

## Terminal and empty paths

No findings after a successful scan means “탐지된 항목 없음” plus coverage facts, not a promise that the site is safe. Partial completion keeps findings visible with failed-page count. A scan with no usable page gives a failure explanation and a route back to setup. Cancellation states whether completed-page findings are retained and whether they can be saved. A result-loading delay shows an explicit loading state; it must not be mistaken for zero findings.
