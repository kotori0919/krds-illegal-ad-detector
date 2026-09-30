# KRDS compliance log (Phase 11 pass + Phase 22 review 2026-10-01)

## Phase 22 independent review (this phase)

- Initial task clarity: PASS — start screen states one URL in, sub-pages
  auto-collected, 4 techniques judged.
- KRDS hierarchy: PASS — eyebrow + h1 + h2 sections + lede on all screens.
- Form behavior: PASS — URL + topic + 3 validated limits; `noValidate` so
  app errors render in `role=alert` (native bubble suppressed).
- Tables: PASS — caption + `th scope`, horizontal scroll at 360px.
- Dialogs: N/A — none used (`details/summary` only).
- Alerts: PASS — error `role=alert`, validation failures block export.
- Progress feedback: FIXED — persistent `role=status aria-live=polite`
  region (previously conditional, absent when no notice message).
- Keyboard-only: PASS — Tab reaches URL field first, Enter submits.
- Focus handling: PASS — 3px `:focus-visible` ring on all interactives.
- Screen-reader semantics: PASS — `lang=ko`, landmarks, one h1/screen,
  labelled controls, step `aria-current`, table caption/scope.
- Error recovery: PASS — invalid URL/limits alert inline; missing evidence
  id alerts with back action; export disabled until checks pass.
- Responsiveness: PASS — 360px verified, steps wrap, table scrolls.
- Evidence readability: PASS — observed/derived/inference separated with
  headings; raw text in `.raw` pre-wrap block.

Fix applied: persistent polite live region on 탐지 진행.

---


1. 탐지 시작 (`ScanStart`) — title, lede, URL field + hint, topic (optional),
   primary action, advanced `<details>` (max pages/depth/timeout with range
   validation). Pattern: single-purpose task-start form.
2. 탐지 진행 (`ScanProgressView`) — stage, visited/queued, frames, elements,
   candidates, confirmed, elapsed, cancel + result actions. Indeterminate
   progress: real counters, no fabricated percent. Pattern: task progress
   with `role="status"` live region.
3. 탐지 결과 (`ScanResult`) — summary lede, per-technique counts (4 chips),
   technique filter `<select>`, finding table (caption + `th scope`),
   evidence + export actions, empty states for zero findings and zero
   filter matches. Pattern: result list with filter toolbar.
4. 탐지 근거 (`EvidenceView`) — observed (page/location/technique/raw),
   derived (normalized/CSS/iframe path placeholders labelled as desktop-only),
   inference (labelled as non-observation, none in demo). Pattern: evidence
   detail with separated layers.
5. 결과 검증 / 내보내기 (`ExportView`) — 6 checks (schema, encoding,
   technique enum, selector, dedup, ids), JSON preview `<pre>`, gated save
   (disabled until all pass; browser falls back to download). Pattern:
   validation-gated export.

Step indicator (`nav[aria-label=탐지 단계]`, `aria-current="step"`) across all
screens; non-color status (text labels + border position, never color alone).

## Tokens / source of truth

- No community KRDS React library adopted (none authoritative); official
  KRDS documentation remains normative per KODEX §32.
- Semantic CSS variables (`--accent`, `--error`, `--success`, `--border`,
  `--radius`); focus ring `--accent-focus` 3px + 2px offset on all
  interactive elements; custom values only for evidence preview/overlay
  surfaces (`.preview`, `.raw`).
- No custom primitive components: all composites compose native form/table/
  nav elements. Justification: zero custom primitives, nothing to justify.

## Merge gate answers (OBSERVED on dev server, this machine)

- KRDS pattern: task flow (start → progress → result → evidence → export)
  with step indicator; form, progress, filtered table, validation gate.
- KRDS tokens: semantic variables above; single Pretendard/Noto/system stack.
- Custom primitives: none.
- Keyboard tested: Tab lands on `#entry-url` first; Enter submits from the
  field and reaches 탐지 진행.
- Focus tested: 3px visible ring on button/input/select/summary/pre via
  `:focus-visible` (stylesheet rule; manual Tab pass confirmed ring on URL
  field and primary button).
- Error state tested: `notaurl` → `role="alert"` "http(s)로 시작하는 올바른
  주소…"; out-of-range limits → range alerts; export blocked until checks pass.
  (Native `type=url` validation disabled via `noValidate` so the app message
  always renders instead of the browser bubble.)
- Empty state tested: zero findings → guidance paragraph; zero filter match →
  "필터를 바꿔 보세요."; missing evidence id → alert + back action.
- Responsive tested: 360px viewport — table scrolls horizontally
  (`display:block; overflow-x:auto`), steps wrap, no overlap.
- Accessibility reviewed: `<main>` per screen, single `h1`, logical `h2`
  sections, labelled controls, `role=status/alert` live regions, table
  caption + scope, `aria-current="step"`, `prefers-reduced-motion` guard,
  status never color-only (text + position).
