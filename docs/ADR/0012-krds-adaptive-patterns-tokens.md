# ADR-0012: KRDS Adaptive patterns and token hierarchy (2026-10-05)

Status: pattern mapping and official light-mode color/spacing/radius token values applied in React 2026-10-06; residual tokens and packaged Windows verification pending. Expands ADR-0010's operator UI decision.

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
keeps the page, selector, technique, raw evidence, review state and evidence
action together without horizontal navigation. The export JSON preview wraps
long lines. A headed Chromium smoke checks the entry, results, inspector and
export dialog at native 200% zoom, including nested overflow and focus return.
Windows packaging and assistive-technology verification remain release gates.
