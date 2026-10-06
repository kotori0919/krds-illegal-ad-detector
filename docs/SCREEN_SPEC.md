# Screen spec V2

Status: design freeze, 2026-10-05. Content is Korean by default; this is a target spec, not a statement of current rendering.

Implementation note (2026-10-06): the result list now stays mounted during
inspection; a desktop grid shows list and inspector together, and mobile shows
the inspector with a return control. A 20-finding synthetic browser replay
exercised review and retained search/filter context. The remaining requirements
in this document still need verification against the packaged Windows app.

## Shared shell

Header: “공공 웹사이트 불법광고 탐지”, 도움말, and the current site after start. A three-item ordered step indicator labels 점검 설정, 사이트 점검, 결과 검토. The current stage has `aria-current="step"` and a visible non-color cue. At narrow widths it may show “2/3 사이트 점검”; the full step names remain accessible. No permanent left navigation. Main heading receives focus on stage transition, never on every progress event. Minimum 44px interactive targets are the design target; text reflows at 360px and 200% zoom without horizontal page overflow.

## A. 점검 설정

Main heading “공공 웹사이트 점검”. Label “점검할 웹사이트”, URL input with an `https://` example and initial focus, one scope/time hint and inline error. Primary button “점검 시작”. `상세 설정` discloses automatic/quick/custom mode and the three numeric limits only for custom. The quick mode describes reduced coverage before selection. No primary “주제” field. Repeated purpose/scope paragraphs and internal timeout explanations are omitted. Browser replay is labelled as a demonstration; it never implies that replay data came from the entered URL.

## B. 사이트 점검

Heading “{host}을 점검하고 있습니다”. Current action is a Korean sentence such as “페이지를 찾고 콘텐츠를 분석하고 있습니다”; discovery and analysis overlap across live workers, so no false sequential completion indicator. Show elapsed mm:ss, checked pages, queue, in-flight pages, analyzed elements only when actually counted, confirmed findings, current pages (up to four), and up to five meaningful recent events with times. A count that cannot yet be measured is hidden or marked “집계 중”, never shown as a misleading zero. Recent activity is throttled to transitions, findings, and failures, not each element. Status has a polite live region without announcing every counter update. “점검 중지” opens a clear confirmation and remains disabled only while cancellation settles. Failure explains what failed and how to retry. If live event transport fails, poll persisted session state and say that real-time updates are delayed.

## C. 결과 검토 — summary and navigation

Heading “{host} 점검 결과”, status text (완료 / 일부 페이지 확인 실패 / 중지됨), duration, checked pages. Summary cards give official finding count, affected pages, failed pages, extra count. Tabs/segmented navigation: 공식 탐지, 추가 분석, 점검 범위. Official area defaults to 탐지 항목별 with a paired 페이지별 choice. Technique filter uses Korean labels for all four official enums plus 전체. Search covers raw displayed content and page URL; applied filter and result count remain visible. Empty filter state offers 필터 초기화. Results and details are data driven; no raw session ID or CSS column in the primary list.

This workspace follows KRDS search-result behavior: visible total and per-category counts, category navigation, one retained search field, filter controls, stable result list, loading state, zero-result and zero-filter-match messages, and a clear alternative action. Filter changes immediately update the visible count. One search field serves both finding and page views; do not duplicate it in the inspector or header. Search/filter and scroll state persist during inspection.

## C1. Finding list and inspector

Each row/card shows 유형, short 원문 excerpt, page path/host, and “근거 보기”. Long URL wraps; full address can be copied. A desktop two-column layout keeps list and inspector visible; inspector has a stable heading and independent scrolling. It answers (1) 무엇을 발견했나요: Korean type, raw text, affected page; (2) 왜 문제인가요: evidence-grounded plain Korean explanation and, when meaningful, 원문 → 확인된 형태; (3) 실제 화면: capture with location/viewport explanation or a reason no capture exists. `기술 정보` expands selector/frame/CSS/geometry/normalized text/OCR/model or graph details with observed/derived/inferred labels. The inspector does not assert more than the stored evidence. On narrow screens it occupies the screen with a visible “목록으로” control and restored list context.

## C2. Page view, coverage, extra analysis

Page groups show page path, count, and a breakdown by the four Korean technique labels. Selecting a group exposes its findings using the same inspector. 점검 범위 lists checked and failed page totals, with failures grouped by reason: 시간 초과, 접근 불가, 연결 실패, or 기타 with a safe sanitized detail. It also states pages skipped by configured limits, when known. 추가 분석 lists evidence-backed summaries separate from official results and official export; raw graph links and pHash live in technical detail. Never label shared infrastructure “same operator/owner”.

## C3. Result file dialog

“결과 저장” stays in the results action area, available even for a valid zero-finding result. The dialog shows the official finding count and, only when present, failed-page/time-limit status. The official serializer and validator still gate “저장” internally; an invalid result shows one actionable error and disables save. Validation checklists and raw JSON do not occupy the operator dialog. “취소” closes it and restores focus. Native save-dialog cancellation is a no-op. Success names the saved file; failure states a recovery step.

## States to design explicitly

Initial/loading, no findings, no filter matches, detail loading/unavailable, evidence unavailable, partial completion, scan failure, cancel settlement, export validation failure, export save failure, and browser replay are distinct states. Focus, status text, and next action must be specified in the implementation for each. The app does not claim that a successful scan proves the entire site safe.

For each relevant component, verify initial, loading, running, partial, success, empty, no-filter-match, error, unavailable evidence, disabled, cancellation settlement, confirmation, save success, and save failure. A state must have text as well as any color/icon cue. `KRDS_COMPLIANCE.md` maps each interaction to an official pattern and records the release gate.
