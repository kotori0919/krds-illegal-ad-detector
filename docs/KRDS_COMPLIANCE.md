# KRDS compliance log (Contract v0 freeze 2026-10-01 — full pass in Phase 11)

Every UI PR must answer: pattern, tokens, custom primitives + why, keyboard,
focus, error/empty/responsive states, accessibility review. A significant
unexplained KRDS deviation blocks merge.

## Frozen product journey (5 screens, GOAL §17)

1. 탐지 시작 — title, description, URL field, primary action, advanced config (details).
2. 탐지 진행 — stage, visited/queued pages, analyzed elements, candidates,
   confirmed findings, elapsed time, cancel. No fabricated percent (unknown
   total → indeterminate progress + real counters).
3. 탐지 결과 — summary, counts per official technique, finding table, filters,
   evidence action, export action.
4. 탐지 근거 — original vs normalized text (labelled), selector, iframe path,
   CSS, geometry, screenshot/crop, OCR, resource/infrastructure, inference
   labelled as inference.
5. 결과 검증 / 내보내기 — schema, selector, duplicate, required-field status,
   output path.

No generic admin dashboard; no second design language before the Phase 11 pass.

## Current shell (`apps/web`) vs frozen journey

- Screens 1–3 exist as labelled placeholders (ScanStart/ScanProgress/ScanResult);
  screens 4–5 (EvidencePanel/ExportValidation) + filters + technique counts
  land in Phase 11.
- Pattern: single-column task flow; composites (ScanStart/ScanProgress/
  FindingTable/EvidencePanel/ScanSummary/ExportValidation) must compose
  KRDS-consistent primitives, never custom design primitives without
  justification logged here.

## Token / source-of-truth decision (frozen)

- Official KRDS documentation is normative (KODEX §30–32). A community React
  library is NOT automatically authoritative; where it differs, official docs win.
- Phase 11 maps each screen to official pattern/component + token usage +
  keyboard/a11y/responsive behavior in this log. Until then: baseline CSS
  variables only, no hardcoded palette expansion, custom drawing values only
  for screenshot annotation / OCR overlay / graph / evidence diagrams.

## Accessibility gate (functional correctness)

Semantic HTML, keyboard-only operation, visible focus, labelled controls,
accessible dialogs, screen-reader-compatible progress (`role="status"`,
no color-only status), valid table semantics, logical headings,
reduced-motion guard. New defects block release.

## Merge gate checklist (per UI PR)

- [ ] KRDS pattern + tokens named
- [ ] Custom primitives listed with necessity rationale
- [ ] Keyboard tested / focus tested
- [ ] Error state / empty state / responsive state tested
- [ ] Accessibility reviewed
