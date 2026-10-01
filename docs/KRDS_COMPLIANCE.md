# KRDS conformance evidence matrix

Status date: 2026-10-01 · Code freeze 2026-10-22 · Submission 2026-10-23 18:00 KST

**This document records what was verified and how. It does not claim full KRDS
conformance, and it does not claim contest readiness.** Several functional
findings remain OPEN, one accessibility gap remains OPEN, and the packaged
Windows flow has never been executed end to end. Read the OPEN rows as blockers.

Architecture statements that remain in force: the UI is **React canonical** —
all markup and interaction live in `apps/web`; **Tauri** is a wrapper only and
carries no presentation logic.

## Normative sources

| Ref | URL | What it governs |
| --- | --- | --- |
| S-STEP | https://www.krds.go.kr/html/site/component/component_07_01.html | 단계 표시기 (Step indicator) — structure, count, skip affordance, accessibility |
| S-FORM | https://www.krds.go.kr/html/site/global/global_08.html | 입력폼 (Input form) — structure, labels, error messages, focus |
| S-TYPO | https://www.krds.go.kr/html/site/style/style_03.html | 타이포그래피 — line height, base size, rem, type scale |
| S-TOKEN | https://www.krds.go.kr/html/site/style/style_07.html | 디자인 토큰 — primitive / semantic / component levels, style track |

Secondary, cited where used: https://www.krds.go.kr/html/site/style/style_01.html
(style track definition), https://www.krds.go.kr/html/site/style/style_02.html
(colour, magic numbers, colour-vision).

## Declared style track

**확장형 (Adaptive).** Per S-TOKEN/style_01, the 표준형 (Standard) track is
mandatory for central administrative agencies presenting the government symbol
logo; the 확장형 (Adaptive) track is for institutions with their own identity.
This project is neither, so Adaptive is the correct declaration. Adaptive still
requires compliance with the colour, typography, shape, layout, icon and
elevation *rules* while permitting institutional variation — which is what
legitimises the local token set below.

Custom CSS variables are **not** a deviation. S-TOKEN's purpose is consistency
and verifiable contrast, and `apps/web/src/styles.css:1-15` does exactly that:
tokens are declared once and consumed everywhere. What must accompany them is
the role mapping (below) and the measured ratios (below).

## Verification methods used

These are kept separate on purpose, because they prove different things.

- **A — Automated test.** jsdom/Vitest. Proves DOM/ARIA state after an
  interaction. Says nothing about rendering, contrast, or a real screen reader.
- **B — Browser/CUA observation.** Headless Chromium against the Vite dev
  server using the `BrowserHost` deterministic demo replay
  (`apps/web/src/host/browser.ts`). Proves computed styles, layout geometry,
  real focus behaviour. Says nothing about the packaged app or AT.
- **C — Manual assistive-technology check.** Requires a Windows VM + GUI. **Not
  performed.** No rows below claim C.

Current automated baseline: `npx vitest run` → **15 files / 92 tests pass**
(73 packages + 19 web). `npm run typecheck -w apps/web` clean.
`npm run build -w apps/web` emits `apps/web/dist/` (index.html, assets/, hashed
js/css bundles present).

---

## Matrix — Web UI conformance

| # | Official requirement (source) | Implementation | Test method | Observed result | Remaining gap |
| --- | --- | --- | --- | --- | --- |
| 1 | Each input element needs an accessible name — KWCAG 2.2 레이블 제공, WCAG 2.1 Name/Role/Value (A) (S-FORM) | `ScanStart.tsx:114` label→`#entry-url`, `:134`→`#scan-topic`, `:162`→`#limit-pages`, `:185`→`#limit-depth`, `:208`→`#limit-timeout`; form named at `:112` | A | All six controls resolve a `<label for>`; axe-core 4.13.0 reports violations 0 | none |
| 2 | Label must convey purpose and requiredness; units shown separately from the label — KWCAG 2.2 레이블 제공 (S-FORM) | `ScanStart.tsx:114` "검사할 웹사이트 주소"; `:101` "주제 (선택)"; `:141` "제한 시간(초)" unit in label; required attr at `:127` | A | Units present; optional field marked "(선택)"; required carried by the native `required` attribute at `:127` | Requiredness is attribute-only, not a visual "필수" marker. S-FORM permits attribute+top-of-form text when all fields are required; with one required of six, a visible marker is the safer read. **MINOR GAP.** |
| 3 | Error message must state *which* item failed; on server-side validation move focus to the errored item after acknowledgement — KWCAG 2.2 오류 정정, WCAG 2.1 Error Identification (A) (S-FORM) | `ScanStart.tsx:133-137` `#entry-url-error`, `:178-182` `limit-pages-error`, `:201-205` `limit-depth-error`, `:224-228` `limit-timeout-error`; each `role="alert"`; focus via `focusFirstInvalid` `:36-43` | A + B | A: *"marks the pages input, not the URL input…"* and *"expands the collapsed 고급 설정 and focuses the depth input…"* both pass. B at 360px with a valid URL and pages=9999: `details.open` flipped false→true, `activeElement=#limit-pages`, `#entry-url` `aria-invalid=null`, `aria-describedby=scan-hint`, `#entry-url-error` absent | none |
| 4 | Validate client-side and give feedback on non-conforming input (S-FORM) | `ScanStart.tsx:46-79` single validation pass; bounds pages 1–2000 `:70`, depth 0–10 `:73`, timeout 60–1750 `:76` | A + B | A: *"submits valid values and clears prior field errors"* asserts the exact `limits` payload. A: *"exposes min/max matching the validator bounds"*. B: rendered `min`/`max` confirmed `1/2000`, `0/10`, `60/1750`, all `type=number` | none |
| 5 | Suppress the native bubble so the application's own message is the one that renders (S-FORM) | `ScanStart.tsx:112` `noValidate` | B | `form.noValidate === true` in live DOM | none |
| 6 | Provide labels and descriptions adjacent to the field (S-FORM) | `ScanStart.tsx:128-132` `#scan-hint` bound via `aria-describedby` at `:126`; per-field descriptions via `aria-describedby` at `:126`, `:174-176`, `:190-192`, `:220-222` | A | A: URL-clean state resolves `aria-describedby="scan-hint"`; error state resolves `"entry-url-error"` | none |
| 7 | Do not auto-delete a value the user got wrong (S-FORM) | `ScanStart.tsx:48-79` — validators only read state, never write it | A | A: after a rejected pages value, a subsequent submit with a corrected URL submits successfully | none |
| 8 | Offer `autocomplete` for repeatedly entered data (S-FORM) | `ScanStart.tsx:120` `autoComplete="url"` on the URL field | B | Attribute present in DOM | none |
| 9 | Step list uses `<ol>`/`<li>` — KWCAG 2.2 제목 제공, WCAG 2.1 Info and Relationships (A) (S-STEP) | `App.tsx:54-55` `<ol className="steps">` / `<li>` | A + B | A: `apps/web/test/app-steps.test.tsx` queries `ol.steps > li` and asserts 5 items | none |
| 10 | Step count 3–7 (S-STEP) | `steps.ts:3-9` five steps | B | 5 items rendered in the nav | none |
| 11 | Current step must be distinguishable and announced — WCAG 2.1 Name, Role, Value (A) (S-STEP) | `App.tsx:56` `aria-current={s.current ? "step" : undefined}` | A | A: *"keeps aria-current on the current step and no done cue at start"* | none |
| 12 | Current/completed steps must **not** be distinguished by colour alone; use underline, ≥1px border, or an identifier — KWCAG 2.2 색에 무관한 콘텐츠 인식, WCAG 2.1 Use of Color (A) (S-STEP) | current: `styles.css:278-283` bold + underline; completed: `App.tsx:57` `✓` glyph, `:58` sr-only "완료", `:291-293` `.done-check` | A + B | A: *"marks visited steps done with a non-color cue; skipped Evidence stay not-done"*. B: computed `text-decoration` present on the current item; completed items carry the glyph | none |
| 13 | Provide a labelled text affordance for skipping optional steps (S-STEP) | `ScanResult.tsx:127-129` "검증 및 내보내기" leads directly to the export step; `steps.ts:26-37` derives completion from an actual `visited` set so a skipped step is never marked done | A | A: *"skip-Evidence visitor path leaves Evidence not done"*; *"full walk marks all non-current visited steps done"*; *"restart resets completion so no step stays done"*. **Was broken before**: completion was positional (`i < stepIndex`), so a skipped Evidence step rendered as completed | none |
| 14 | Line height ≥ 150 %, body ≥ 16px, relative units (S-TYPO) | `styles.css:27` body `line-height: 1.6`; `:43-47` h1 `1.75rem` / `line-height: 1.5` | B | B: body computed 16px / 25.6px (1.6); h1 computed 28px / 42px (1.5). **Was 1.3** before the fix — below the S-TYPO floor | none |
| 15 | Redundant weight values only; regular + bold (S-TYPO) | `styles.css:27-28` `line-height: 1.6`; weights limited to 400/700 across the stylesheet | B | B: computed h1 700, body 400, `.hint` 400 — two weights in use | none |
| 16 | Colour must be built from tokens, not ad-hoc hex (S-TOKEN) | `styles.css:1-15` single `:root` token block | B | B: all component rules resolve through `var(--…)`; no raw hex below the token block | none |
| 17 | Token roles must be explicit across primitive/semantic/component levels (S-TOKEN) | `styles.css:3-14` | B (review) | Mapped below — each local token has a declared primitive and semantic role | The three levels are flattened into one `:root` block rather than separated. Cosmetic; documented rather than restructured. |
| 18 | Step indicator structure includes a current identifier and a completed identifier (S-STEP) | `steps.ts:26-37`; rendered by `App.tsx:56-59` | A + B | A: three sibling step-state tests plus the skip/full-walk/restart cases | none |
| 19 | Table needs a caption and header associations | `ScanResult.tsx:94` `<caption>`, `:97-101` `<th scope="col">` | B | B: ARIA snapshot shows `table > caption + rowgroup > row > columnheader/cell` for all 5 rows; caption text "확정된 탐지 목록 (5건)"; `table { display:block }` at `styles.css:227-233` does **not** strip table semantics | none |
| 20 | Table must remain reachable at narrow widths | `styles.css:227-233` `display:block; overflow-x:auto` | B | B at 360px: table `clientWidth` 328 / `scrollWidth` 672 scrolling internally; document `scrollWidth` 360 == `clientWidth` 360, no page-level overflow | none |

---

## Matrix — Colour, contrast, non-colour cues

Ratios measured **in-browser** by parsing `getComputedStyle()` colour strings
through WCAG 2.x relative luminance (styles.css:1-15 token values, verified
unchanged against the live DOM).

| Role | fg on bg | Ratio | Required | Result |
| --- | --- | --- | --- | --- |
| body / h1 | `#1a1a1a` on `#fff` | 17.40 | 4.5 | AAA |
| `.hint`, `.eyebrow`, `.lede` | `#4f4f4f` on `#fff` | 8.19 | 4.5 | AAA |
| `.badge` | `#003675` on `#fff` | 11.77 | 4.5 | AAA |
| `.steps li.done` | `#003675` on `#f4f6f9` | 10.87 | 4.5 | AAA |
| `.steps li.current` | `#1a1a1a` on `#f4f6f9` | 16.08 | 4.5 | AAA |
| `.error` | `#b3261e` on `#fff` | 6.54 | 4.5 | AA |
| `button.primary` label | `#fff` on `#003675` | 11.77 | 4.5 | AAA |
| `button.secondary` label | `#003675` on `#fff` | 11.77 | 4.5 | AAA |
| focus ring | `#0050a0` on `#fff` | 7.91 | 3 | AAA |
| focus ring on nav | `#0050a0` on `#f4f6f9` | 7.31 | 3 | AAA |
| `--success` border cue | `#1e6b2e` on `#fff` | 6.57 | 3 | AAA |
| `--border` (input/table boundary) | `#767676` on `#fff` | 4.54 | 3 | AA |
| `--border-soft` | `#c9c9c9` on `#fff` | 1.66 | 3 | **below** — see note |

**`--border-soft` is a documented non-issue, not a failure.** `#c9c9c9` is used
only for decorative dividers and card edges (`styles.css` `.advanced`, `.counts
li`, `.checks li`, `.empty`, `.preview`, `.steps-nav` border, `.stats`/
`.evidence` row rules). No control boundary depends on it — every boundary
required to identify a control uses `--border` at 4.54:1. Raising it is optional
polish, recorded here so a reviewer does not misread it as a contrast defect.

### Token → KRDS role and magic number

style_02 publishes magic numbers as contrast targets: **40 → 3:1, 50 → 4.5:1,
70 → 7:1, 90 → 15:1**.

| Local token | Primitive | Semantic | Measured | Magic tier met |
| --- | --- | --- | --- | --- |
| `--surface` / `--surface-alt` | gray-0 / gray-5 | background surface / surface-alt | — | n/a |
| `--ink` / `--ink-sub` | gray-90 / gray-70 | content text-primary / secondary | 17.40 / 8.19 | 90 / 70 |
| `--accent` | primary-70 | action primary | 11.77 | 70 |
| `--accent-focus` | primary-60 | focus ring | 7.91 | 70 |
| `--error` | danger-60 | content text-danger | 6.54 | 50 |
| `--success` | success-60 | content text-success | 6.57 | 50 |
| `--border` | gray-60 | border gray-default | 4.54 | 50 |
| `--border-soft` | gray-30 | border gray-light (decorative) | 1.66 | below 40 — decorative only |
| `--radius` | shape radius | radius medium | — | n/a |

Colour-vision (style_02 flags red/green pairs, 99 % of CVD cases): the
`.checks` pass/fail pair is exactly that combination and is already backed by
visible "통과" / "실패" text (`ExportView.tsx:128`) plus a 6px left border
(`styles.css:323-329`), so the guidance is met without icons. `--error` is
never a sole signal; every error carries a message.

---

## Matrix — Responsive, keyboard, motion

| Claim | Method | Observed | Gap |
| --- | --- | --- | --- |
| All five screens fit 360px | B | ScanStart clean / ScanStart error / ScanProgress / ScanResult / ExportView: `scrollWidth` 360 == `clientWidth` 360, zero elements exceeding the viewport. **ScanResult's table children exceed the viewport box but the table scrolls internally, so the page does not** | none |
| ScanProgress fits 360px | B | `scrollWidth` 360 == `clientWidth` 360 | none |
| ScanResult fits 360px | B | as above; dense 5-row table contained | none |
| EvidenceView fits 360px | B | **Was 231px of page overflow** (`scrollWidth` 591 vs 360) caused by `.stats div, .evidence div { grid-template-columns: 10rem 1fr }` plus a URL `<dd>` with no `overflow-wrap`. Fixed in `styles.css:170` (`minmax(0, 1fr)`) and `:184` / `:252` / `:256` (`overflow-wrap: anywhere`) | **FIXED in CSS; re-measured in-browser after the fix: `scrollWidth` 360 == `clientWidth` 360, zero offenders** |
| ExportView fits 360px | B | `scrollWidth` 360 == `clientWidth` 360; `pre.preview` scrolls internally (`clientWidth` 326 / `scrollWidth` 1378 inside `max-height: 24rem`) | none |
| Long URLs survive | B | a long evidence URL and a long `code` selector both wrap rather than push the layout | none |
| 200 % zoom | B | viewport 640: `scrollWidth` 640 == 640, zero offenders | none |
| 400 % zoom | B | viewport 320: `scrollWidth` 320 == 320, zero offenders | none |
| Text-only zoom (root font-size forced to 32px) | B | body 32px / 51.2px; h1 56px / 84px; `ol.steps` and `ul.counts` both `flex-wrap: wrap`; `scrollWidth` 1280 == 1280 | none |
| Pinch-zoom not suppressed | B | `index.html:5` viewport meta has no `user-scalable=no` and no `maximum-scale` | none |
| Keyboard-only order, ScanStart | B | `#entry-url` → `#scan-topic` → 탐지 시작 → 고급 설정 → browser chrome → wraps. No trap | none |
| Keyboard-only order, ScanResult | B | `#technique-filter` → 5 × 근거 보기 → 검증 및 내보내기 → 새로 검사하기 → browser chrome | none |
| Visible focus on every stop | B | computed `outline-width: 3px`, `outline-color: rgb(0, 80, 160)` at every tab stop; `styles.css:122-130` covers `button, input, select, summary, a, pre` | none |
| `lang` set | B | `index.html:2` `<html lang="ko">` | none |
| Reduced motion honoured | B | `styles.css:346-350` `prefers-reduced-motion` guard | none |
| Automated axe sweep | B | ScanResult violations 0 / incomplete 0 / passes 34; EvidenceView violations 0 / incomplete 0 / passes 27 | none |
| **Focus placement after navigation and Back** | B | `document.activeElement` is `BODY` after ScanResult → EvidenceView and after EvidenceView → Back. Focus is lost to the document root on every screen change, so a keyboard user restarts from the top and hears no announcement of the new screen | **OPEN.** Fix is a `useEffect` keyed on `[phase]` that focuses the new screen's `<h1>` (`tabIndex={-1}`), with `goStart`/`go`/`stepStates` left intact so background scan events cannot steal focus mid-typing. Exact patch text is held in the workstream record; it was not applied here because `App.tsx` is owned by a parallel workstream. |
| Assistive-technology walkthrough | C | not performed | **NOT RUN** — no Windows VM or GUI available in this environment. Every "B" row above is Chromium, not a screen reader. NVDA/JAWS/VoiceOver behaviour on the live regions, the step indicator, and the table is unverified. |

---

## Matrix — Live region / status messaging

| Claim | Implementation | Method | Observed | Gap |
| --- | --- | --- | --- | --- |
| `aria-busy` must not suppress the status region | `ScanProgress.tsx:62` `aria-busy={finishing ? "true" : undefined}`; `finishing` set at `:41` (session-finished) and `:49` (cancel) | A + B | A: *"does not mark the page busy while the scan runs…"*, *"keeps the status region outside any aria-busy ancestor"*. B: `aria-busy` is `null` while running; `status.closest("[aria-busy=true]")` is `null` | none. **Was hardcoded `aria-busy="true"` on `<main>` with the `role="status"` region nested inside it, so live updates were suppressed and busy stayed true through unmount.** |
| Busy clears on completion | `ScanProgress.tsx:40-42` | A | A: *"marks the page busy on session-finished and hands off to onDone"*, *"marks the page busy while cancelling"* | none |
| Announcements must change on meaningful transitions | `ScanProgress.tsx:33-41` composed line + `lastSpoken` ref `:27` | A | A: *"announces stage and confirmed-count changes"*, *"does not re-announce identical lines while per-page counters still update"* (3 events differing only in `visitedPages` leave the line unchanged while `dl.stats` reaches 5) | none |
| Cross-session events must not leak | `ScanProgress.tsx:32` session guard | A | A: *"ignores events belonging to another session"* | none |

---

## Matrix — Functional findings (contest acceptance)

These are **product** requirements, recorded here because the UI evidence above
cannot be read as evidence that the underlying behaviour works. Line references
are the implementation sites as of 2026-10-01.

| # | Finding | Status | Evidence / note |
| --- | --- | --- | --- |
| F1 | Worker packaging | **OPEN** | The packaged Windows flow has never been executed. `cargo check` against the msvc target passes, which proves **only** that the Rust code type-checks — it says nothing about MSVC linking, WebView2 provisioning, or NSIS packaging. Recorded per the parallel packaging workstream (t5). Must be run on a Windows VM before any submission claim. |
| F2 | URL / limit delivery to the scan pipeline | **OPEN** | `ScanStart` now produces a validated `{ entryUrl, topic, limits }` payload (proved by A: *"submits valid values and clears prior field errors"*), but delivery end-to-end into the crawler is not covered by any test in this record. |
| F3 | Result consumption (findings → evidence → export) | **OPEN** | The web flow is exercised only against the deterministic `BrowserHost` demo replay. No test consumes a real scanner result end to end. |
| F4 | JobGuard (child-process lifetime on cancel) | **FIXED** | `src-tauri/src/job.rs:59-69` — `JobGuard` with `Send`/`Sync` impls and a `Drop`-based cleanup path; the guard is created at cancel time and torn down deterministically rather than relying on the OS to reap the child. |
| F5 | Deadline / timeout enforcement | **OPEN** | The 1500s default and the 1750s ceiling are validated in the form only (`ScanStart.tsx:76`). No test observes the scanner actually stopping at the limit. |
| F6 | Detection of non-`id` elements | **OPEN** | `packages/detection/src/selectors.ts` has no non-`id` targeting covered by a test in this record. |
| F7 | Private-network / loopback restriction | **OPEN** | No host-resolution guard found in `packages/scanner/src/*.ts`. Without one, a submitted URL could resolve to a loopback or RFC1918 address. This is a contest-scope concern, not a styling one. |
| F8 | Offscreen geometry judgement | **OPEN** | `packages/detection/src/visibility.ts:14` documents the judgement (zero-size box, offscreen transform, clip/overflow concealment) and `pipeline.ts:116-121` emits an `offscreen-signal` node — but per the re-verification this logic is only exercised in unit tests, not against a real rendered page, so the DOM heuristics are unproven on live sites. |

---

## What this document does not establish

- **Not** a claim of full KRDS conformance. Rows 2 and the focus row above are
  open; the manual AT column is entirely unrun.
- **Not** a claim of contest readiness. F1, F2, F3, F5, F6, F7, F8 are OPEN, and
  F1 alone (an unexecuted packaged build) blocks any submission claim.
- **Not** a substitute for running the Windows installer. The Chromium evidence
  covers the web layer only.

Before 2026-10-22 (code freeze) the OPEN accessibility row and F1 warrant
attention first: F1 is the only item that cannot be closed by any code change
made in this repository.