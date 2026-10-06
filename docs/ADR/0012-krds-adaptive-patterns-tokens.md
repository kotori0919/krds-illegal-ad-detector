# ADR-0012: KRDS Adaptive patterns and token hierarchy (2026-10-05)

Status: pattern mapping, official light-mode color/spacing/radius values and
documented layout extension hierarchy applied in React 2026-10-06; packaged
Windows and assistive-technology verification pending. Expands ADR-0010's
operator UI decision.

## Context

The current UI defines a small set of flat CSS variables and has a dated visual/accessibility audit. `docs/KRDS_COMPLIANCE.md` itself notes that primitive, semantic, and component roles are flattened, previously classing that as cosmetic. The five-step UI and main-path JSON/selector presentation also do not demonstrate KRDS result-pattern behavior. Good color contrast or a clean axe run is not evidence that an operator can finish the task.

## Decision

Use KRDS **확장형 (Adaptive)** as the declared style track for this public-service tool, staying close to the base KRDS visual language. Extensions need a service-specific reason. Official KRDS style, component, basic-pattern, and service-pattern guidance is normative. Each interaction is mapped before implementation in `KRDS_COMPLIANCE.md`, including URL form/error, scope choice, scan feedback, list, filters, inspector, search/results, export confirmation, failures, and contextual help.

CSS adopts **primitive → semantic → component** tokens. Components consume component or semantic tokens, never arbitrary hex/spacing/radius when a KRDS role exists. Each local extension documents its KRDS source role, semantic purpose, consumers, and deviation reason. The current flattened token block is a migration target, not V2 conformance. A token audit and computed-style check must trace representative controls back through all levels.

Results follow KRDS search-result behavior: visible result count, category navigation, one search field, immediate filter count, list, loading state, zero-match message and reset action, and retained search/filter state during inspection. Design and verify initial, loading, running, partial, success, empty, no-filter-match, error, unavailable evidence, disabled, cancellation settlement, confirmation, save success, and save failure where relevant.

## Release consequence

Every Product V2 UI PR records pattern mapping and deviation reasons, token lineage, keyboard-only operation, visible and restored focus, 360px reflow, 200% zoom, text/shape state cues, status announcements, dialog focus, plain Korean wording, and mixed-age target size. An unexplained pattern deviation is a release-blocking product defect. Historical checks on the old five-step UI remain evidence of that build only.

## Amendment 2026-10-06: result list reflow

Native Chromium 200% zoom exposed a horizontally scrolling six-column result
table that visually hid most finding content while leaving the outer document
width within the viewport. The result collection now uses a single semantic
list of cards for both narrow and wide layouts. This maps to KRDS 목록 탐색 and
keeps the page, technique, raw evidence, review state and evidence
action together without horizontal navigation. Selectors remain under the
inspector's technical disclosure. A headed Chromium smoke checks entry, results, inspector and
export dialog at native 200% zoom, including nested overflow and focus return.
Windows packaging and assistive-technology verification remain release gates.

## Amendment 2026-10-06: confirmation and factual detail

The user's operator-copy correction removes repeated purpose explanations,
technical validation-success cards and raw JSON preview from export. This
maps to KRDS 확인: show the count, relevant partial-coverage notice, specific
actions, saved path or actionable error. Validation remains an internal gate.
KRDS 상세 정보 확인 uses stored matched terms, destination, normalized text and
measured geometry rather than repeating generic technique definitions. This
decision does not remove unavailable-evidence reasons or recovery actions.

## Amendment 2026-10-06: scan feedback

The scan screen maps to KRDS feedback and error patterns: concise Korean stage,
elapsed `mm:ss`, active page URLs, completed/failed counts and a bounded recent
activity list. Per-element output and internal English messages are excluded.
Announcements occur for meaningful changes rather than each page or clock
tick. Cancellation confirmation states the actual consequence once; settlement
keeps its control disabled until the host reaches a terminal state. Polling
failure has a status message while scanning and cancellation remain available.

Use one KRDS indeterminate spinner beside the Korean scan status after the
first second, including host cancellation settlement. Discovery has no known
total, so no percentage is shown. Its 48px size uses the existing KRDS height
tier, path uses the gray-60 border role, indicator the primary action role and
3px stroke the documented local border extension. Reduced-motion preference
replaces rotation with the existing textual status. The spinner is decorative
to assistive technology; the adjacent polite status carries its meaning.

## Amendment 2026-10-06: asynchronous save states

KRDS confirmation/error feedback must cover the interval between the operator
choosing Save and the host settling its dialog/write. One save may be pending
per dialog. Save/close are disabled and Escape/Tab stay inside the confirmation
while it settles; the visible status names saving. Native cancellation is a
silent return to the validated confirmation. Success, failure and cancellation
restore the Save action's focus after React commits the enabled control.
Coverage loading must settle before Save enables, so a known partial warning
cannot arrive after the operator already opened the native file picker.
A missing coverage record is named once without inventing successful coverage.

Result coverage distinguishes loading, missing and rejected reads. A rejected
official-result read exits loading with an error and the existing new-scan
action; it does not keep a failed IPC call in an endless background loop.

## Amendment 2026-10-06: native desktop zoom

The Windows acceptance run found that the main Tauri window used the default
disabled zoom hotkeys. Browser-only reflow proof cannot satisfy the native
operator zoom gate. Enable Windows zoom hotkeys on the actual main WebView builder;
the existing responsive layout must work under WebView2 zoom without changing
OS display scale. Verify Ctrl+plus/minus, focus and dialog/actions on the
installed application, then restore the normal zoom level before performance
measurements. No detector or scanner policy changes are required.
