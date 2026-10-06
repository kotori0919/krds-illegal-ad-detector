# KRDS Product V2 pattern and release record

Status: **partial implementation, release gate open** (2026-10-06). The previous
five-stage audit is available in Git history; its tests and line references do
not describe this UI.

## Style track and authority

The product declares KRDS **확장형 (Adaptive)** for a public-institution tool and
stays close to the base visual language. The official [style
track](https://www.krds.go.kr/html/site/style/style_01.html), [design
tokens](https://www.krds.go.kr/html/site/style/style_07.html), component,
basic-pattern, and service-pattern guidance govern implementation. Adaptive
permits a documented service need; it does not waive pattern or accessibility
checks.

## Interaction to official pattern

| Product interaction | KRDS pattern | Implemented behavior | Remaining verification |
| --- | --- | --- | --- |
| Three-stage shell | [단계 표시기](https://www.krds.go.kr/html/site/component/component_07_01.html) | Setup, scan, results; inspector and export stay in results. | Screen reader stage announcement. |
| Site URL and validation | [입력 폼](https://www.krds.go.kr/html/site/global/global_08.html), [오류](https://www.krds.go.kr/html/site/global/global_07.html) | Labelled required URL, field error and focus, retained entry. | Packaged host and 200% browser zoom. |
| Scope | [선택](https://www.krds.go.kr/html/site/component/component_06_01.html), [설정](https://www.krds.go.kr/html/site/global/global_08.html) | Automatic, quick, custom; custom limits disclosed when selected. | Keyboard-only choice and native request. |
| Scan status | [피드백](https://www.krds.go.kr/html/site/component/component_07_02.html) | Real elapsed time, counts, current page, cancellation settlement. | Live status cadence with assistive technology. |
| Result collection and category navigation | [목록 탐색](https://www.krds.go.kr/html/site/global/global_04.html), [검색 결과 확인](https://www.krds.go.kr/html/site/service/service_02_04.html) | Three peer areas: 공식 탐지, 추가 분석, 점검 범위. 탐지 항목별 and 페이지별 are nested under 공식 탐지. Result counts, list and empty state are visible; the one search/filter remains scoped to official findings. | Packaged Windows operator review and extra-list assistive-technology audit. |
| Technique filter | [필터링·정렬](https://www.krds.go.kr/html/site/global/global_10.html) | Immediate visible count and no-match reset. | Keyboard path in packaged app. |
| Result search | [검색](https://www.krds.go.kr/html/site/service/service_02_03.html), [검색 결과 확인](https://www.krds.go.kr/html/site/service/service_02_04.html) | One search field; query/filter retained through inspection. | Search semantics on larger real results. |
| Finding inspector | [상세 정보 확인](https://www.krds.go.kr/html/site/global/global_06.html) | Recorded matched terms, text transformations, source, CSS/geometry, actual JPEG when captured, unavailable state, review control, return focus. The list remains mounted in a desktop split view; mobile shows the inspector alone. | Actual Windows 21-finding review observed; assistive-technology review remains open. |
| Export dialog | [확인](https://www.krds.go.kr/html/site/global/global_11.html), [모달](https://www.krds.go.kr/html/site/component/component_04_05.html), [오류](https://www.krds.go.kr/html/site/global/global_07.html) | “결과 저장” shows the official count and only relevant failed-page/time-limit status. Contract validation remains an internal save gate; a failure gets one actionable alert. No successful-check cards, raw JSON, or repeated explanation. Focus is trapped and restored; native save success/failure is reported. | Compact dialog, keyboard focus and actual saved bytes observed on Windows. Save failure injection and full release walk remain open. |
| Page/scan failure | [오류](https://www.krds.go.kr/html/site/global/global_07.html) | Failed page and timeout coverage with retained findings. | Inject failures in packaged app. |
| Contextual help | [도움](https://www.krds.go.kr/html/site/global/global_02.html) | Short scope help and optional technical explanation. | Keyboard and zoom review. |

The KRDS result pattern motivates a visible count, category navigation, one
search field, a result list, a no-result message, and a recovery action. Scan
status is a progress/status interaction; the KRDS **사용자 피드백** pattern is for
collecting a user's opinion and is not the scanner's status pattern.

## Operator copy and disclosure

The [confirmation pattern](https://www.krds.go.kr/html/site/global/global_11.html)
calls for concise context and action labels. Normal operation shows the facts
needed to act: counts, coverage, current work, saved path, or an error with a
recovery step. Successful validation is internal; six technical check cards,
JSON preview, repeated scope/purpose paragraphs, explanations of progress
implementation, and generic export narration have been removed. The finding
list shows type, page, detected text and review state. CSS selectors remain
under the inspector's 기술 정보; frame/element/candidate statistics are under
the progress view's 기술 정보. Evidence captions show capture time and viewport
size. Demo labels, unavailable-evidence reasons and actionable errors remain
because they change how the operator should interpret or act on the result.

The finding inspector uses “탐지 내용” and “판단 근거” labels. Matched terms,
recorded destinations and HOMOGLYPH/JAMO normalized text replace repeated
technique definitions. A displayed element rectangle is explicitly relative
to its own page or frame viewport. This follows the existing 상세 정보 확인
mapping; raw CSS and the complete selector/frame chain remain in 기술 정보.

## Token hierarchy and local extensions

KRDS defines **primitive → semantic → component**. Primitive values are
references, semantic values express roles, and component values are the styles
consumed by controls. Color values match the [KRDS HTML Component Kit
transformed token JSON](https://github.com/KRDS-uiux/krds-uiux/blob/main/tokens/transformed_tokens.json)
for the light mode. KRDS number and typography `rem` values use a 10 px base;
the app converts them to its 16 px root so their rendered sizes match. The CSS
names are local mappings, not an imported package.
Buttons, inputs, result navigation, badges, result cards and the dialog now
consume component roles backed by semantic roles. The former flat color and
radius aliases have been removed. Their regular borders now consume a local
primitive → semantic mapping of KRDS `mode-light.border-width.static-regular`
instead of component-level `1px` literals. The [KRDS typography guide](https://www.krds.go.kr/html/site/style/style_03.html)
specifies Pretendard GOV; the app bundles the v1.3.9 variable font under its
[OFL license](https://github.com/orioncactus/pretendard/blob/v1.3.9/packages/pretendard-gov/dist/LICENSE.txt)
so packaged Windows use has no font CDN dependency. The source font SHA-256 is
`a2f477842d55918053db560007dd615ab44eab848d3aa09dd61e96b4da76210e`.
The focus ring is a documented local extension; its offset, step underline and
check-status edge use KRDS number tokens. Local layout widths still need the
packaged Windows review, so **full token conformance is not yet proven**.

| Local primitive → semantic → component | Source KRDS role | Purpose and consumers | Deviation reason |
| --- | --- | --- | --- |
| `primary-50` → `action` → `button-primary-fill`, `button-secondary-border`, `button-link-text`, `badge-border`, `result-navigation-active` | `mode-light.color.button.primary-fill` | Start/save, secondary and link buttons, badge, active result topic; 60/70 supply hover/pressed | Local component role names separate consumers; colors are unchanged. |
| `gray-5` → `surface-subtle` → `result-card-surface` | `mode-light.color.surface.gray-subtler` | Page groups (`#f4f5f6`) | None. |
| `danger-60` → `error` | `mode-light.color.text.danger` | Form, export and status errors (`#bd2c0f`) | Generic error text currently consumes the semantic role; error text accompanies color. |
| `number-4` → `radius-control` → `input-radius`, `button-radius`, `filter-radius` | `semantic.radius.medium2` | Control and result group corners (6 px) | App-root rem conversion preserves the KRDS pixel value. |
| `number-5/6/7/8` → `padding-3/4/5/6` → button/input padding | `semantic.padding.3/4/5/6` | Control and result workspace spacing | Rem values are converted to preserve the official pixel scale. |
| `number-16` → `size-control` → button/input minimum height | `semantic.size-height.7` | 48 px button and input targets for mixed-age operators | Local component role selects the KRDS 48 px size tier. |
| `border-width-regular` → `border-width` → input/button/navigation/badge/card/dialog borders | `mode-light.border-width.static-regular` in the [transformed tokens](https://github.com/KRDS-uiux/krds-uiux/blob/main/tokens/transformed_tokens.json) | Shared 1 px regular border across controls and result surfaces | Converted from KRDS's 10px rem base to the app's 16px root; rendered width remains 1 px. |
| local `focus-width` → `focus-width` → keyboard focus rings on buttons, inputs, links, summaries and inspector heading | `mode-light.border-width.variable-medium` (2 px) | 3 px outline remains distinct at 200% zoom and on dense result cards | One extra pixel for a clearer keyboard target; the light KRDS focus color remains unchanged. |
| `number-2/3` → `focus-offset` / `underline-offset` → focus ring and step marker | `primitive.number.2/3` | 2 px focus gap and 4 px underline gap | Local semantic names express each consumer's role; the rendered numeric values are unchanged. |
| `alpha-black-75` → `overlay-scrim` → `dialog-scrim` | `mode-light.color.background.dim` | Export dialog backdrop (`#000000bf`) | None. |
| local `viewport-height` → `dialog-max-height` → `dialog-max-height` | [KRDS modal dialog](https://www.krds.go.kr/html/site/component/component_04_05.html) containment role | Constrain the dialog to the live viewport minus KRDS `padding.8`; allow scrolling when necessary | Viewport extent has no numeric KRDS token. Its 100dvh primitive is reduced by the existing KRDS spacing role. The native window separately fits the monitor work area. |
| 13/15/17/19/24/32px type values → `font-body-*` / `font-heading-*` → badge, step and card title | `responsive-pc.font-size.body` / `heading` in the [transformed tokens](https://github.com/KRDS-uiux/krds-uiux/blob/main/tokens/transformed_tokens.json) | Body, hints, headings, result and dialog text | Numeric rem values are converted from KRDS's 10px base to this app's 16px root; rendered sizes preserve KRDS roles without changing the user's root font setting. |
| `Pretendard GOV Variable` → `font-family` → body text | `primitive.typo.font` | All product text | Bundled font file replaces a network-dependent font source. |

Before adding a custom token, record its exact KRDS source role, semantic
purpose, consuming components, and reason for deviation. The local button,
input, badge and result-navigation roles map existing KRDS semantic colors
without changing their values. The release audit
must inspect computed styles for representative normal, focus, disabled and
error controls and trace each value through the three levels. The 52 rem
reading column, 90 rem split workspace, 42 rem modal width and 64 rem split
breakpoint are local layout limits for the operator workflow; their widths
and reflow still need packaged-app verification. A Linux Chromium layout audit
at 360, 768, 1024 and 1440 CSS px found zero document or nested horizontal
overflow while inspecting a finding. The list was hidden at 360/768 and
visible beside the inspector at 1024/1440, with no column overlap. This
checks these breakpoint choices in the browser, not in the Windows package.
Computed styles on the 360 px browser path reported `1px` borders for the URL
input, result card and export dialog from the shared regular-border token.
The native 200% zoom smoke observed `3px` visible outlines on the focused
inspector heading and the restored export trigger.

## State coverage

| State | Required behavior | Current evidence or gap |
| --- | --- | --- |
| Initial, loading | URL and scope visible; result/detail loading named and settled. | React tests include missing/rejected export result so the dialog exits loading with a recovery action; browser setup and result path observed. |
| Running | Real counts, elapsed time, page and meaningful live status. | React tests and Rust child-process pump verify retained counters; actual Windows progress observed. Live screen-reader cadence remains open. |
| Partial, success | Valid findings retained; checked/failed pages shown; export warns of omitted coverage. | Actual Windows result/save paths observed both the six-page/five-finding and 200-page/21-finding scenarios, each with one expected failed page. |
| Empty, no filter match | Distinguish zero findings from a filter miss; reset action. | React and browser demo checks. |
| Separate extra analysis | Keep the official list/count unchanged; show a Korean summary, item count, loading, empty, unavailable, and technical disclosure states. | Real image-response scan → Chromium IPC replay observed two extra items with zero official findings; keyboard category switch and 360px reflow passed. Headed Chromium at native 200% zoom showed no overflow in the empty-extra view. Packaged host, populated-extra native zoom, and assistive-technology review open. |
| Error, unavailable evidence | Name the failure and next action; no fabricated image. | React start/cancel/save rejection paths show Korean recovery actions without raw host errors; native failure injection open. |
| Disabled | Adjacent explanation and predictable focus. | Export disabled until validation; native controls still need audit. |
| Cancellation settlement | Confirm before stopping, then await host terminal state. | React test; packaged host open. |
| Confirmation, save success, save failure | Modal focus, validation, path/error, return focus. | React and browser checks; Windows native save and file-byte validation observed on the five-finding scenario. Save failure injection and full release walk remain open. |

## Release gate and evidence

Every Product V2 UI change must record: official pattern and any deviation;
token lineage; keyboard-only operation; visible and restored focus; 360px
reflow and native 200% zoom; non-color state cues; loading, empty and error
states; dialog focus behavior; accessible live status; clear Korean language;
and control target size for mixed-age operators. An unexplained deviation
blocks release. The packaged Windows operator walk must verify the actual
Tauri host and real scan/evidence/export.

**Observed 2026-10-06:** `npm test` passed 129 tests; `npm run typecheck` and
`npm run build -w apps/web` passed. `node benchmarks/ui-smoke.mjs` exercised
the BrowserHost demo in Chromium at 360 CSS px: three stages, five findings,
search/reset, page review, inspector focus return, export focus/Escape/return,
and document width 360 px. A CSS `zoom: 2` check at a 720 px viewport also
found no document overflow. This approximates reflow; it is **not native 200%
browser zoom**. At 1280 px the list and inspector were simultaneously visible;
at 360 px the inspector replaced the list and focused its heading. A separate
synthetic Tauri IPC browser replay reviewed 20 findings through the real React
UI using keyboard activation, retained search/filter state, and restored focus
to the search field when a changed filter hid the inspected finding. The same
replay showed a failed-page/time-limit warning in the export dialog while
leaving a valid partial result savable. This
does not verify the packaged host or real evidence. After the typography
change and KRDS spacing conversion, mobile return restored the observed
298 px list scroll position.
With official light color values, the
same browser check measured
body 16.18:1, primary button 4.55:1, secondary button 4.55:1 and hint 8.68:1
contrast; primary button, URL input and scope disclosure each measured 48 px
tall, while scope option targets measured at least 48 px. BrowserHost data is a
labelled demo, not a live scan.
The same Chromium smoke now checks that the bundled Pretendard GOV variable
font reaches the loaded state and computes to a 17 px body size; the 360 px
layout and 200% CSS zoom checks still pass after the typography change.

**Observed native browser zoom 2026-10-06:** `npm run smoke:ui-native-zoom`
used headed Chromium under Xvfb and OS keyboard zoom to reach actual 200%
(`devicePixelRatio=2`, effective viewport 360 CSS px from a 720 px window).
The entry, result list, inspector and export dialog each had document width
352 px and no nested horizontal overflow. The inspector hid the list and
focused its heading; the dialog received focus and returned it to export on
Escape. Visual inspection exposed an unusable wide result table despite a
passing document-width check. The result view now uses one semantic list of
cards at every width, with page, location, raw evidence, technique, review
state and a 48 px evidence action. The export dialog now omits the JSON preview and technical validation cards. The
same native zoom smoke passed again after both changes; `ui-smoke` and the
20-finding keyboard review replay also passed. This is a Linux Chromium
operator slice, not a packaged Windows or assistive-technology audit.

**Observed operator-copy revision 2026-10-06:** all 134 tests passed before the
final empty-selector regression was added; the two changed web suites then
passed 21 tests, including both duplicate and blank-selector save blocking.
The final integrated run passed all 135 tests across 27 files.
Typecheck, lint, build, the 20-finding keyboard replay and native Chromium
200% zoom smoke passed after the revision. At effective 360 CSS px the entry,
result list, extra view, inspector and save dialog had no document or nested
horizontal overflow. The real-scanner-to-React smoke showed five actual JPEGs,
truthful coverage, an enabled valid-result export gate and restored focus.

On `clean11` Windows, the actual native app showed the compact confirmation,
kept both actions visible, trapped Tab and restored export focus on Escape.
Native save created a 1466-byte UTF-8/no-BOM JSON file with five known findings
and no FP/FN; file readback passed the official validator. The first native
review also exposed an initial 860px content height exceeding the 800px
monitor and taskbar. Tauri's `prevent_overflow().center()` now fits the monitor
work area on creation; the result actions were visibly above the taskbar.
The revised app SHA-256 and evidence paths are in `DRY_RUN.md`.

The subsequent inspector revision passed both delayed/rejected-detail tests
and the existing result tests (six tests total), typecheck, lint and build.
The real-scanner-to-React smoke displayed all three stored text transformations,
all five JPEGs, the measured OFFSCREEN position and all four page-level
technique counts. The 20-finding keyboard replay, 360px browser smoke and
native Chromium 200% zoom smoke passed again with retained/restored focus
and no horizontal overflow. These browser observations use IPC replay.
The subsequent actual Windows app reviewed 21 real findings, displayed text
transformations, measured OFFSCREEN positions and JPEGs, returned keyboard
focus, cancelled native Save As without a false message, and saved a validated
21-finding file (21 TP / 0 FP / 0 FN). Exact app/worker and file hashes plus
captures are in `DRY_RUN.md`. The full release walk remains open.

**Open:** assistive technology, remaining local layout limits, native zoom,
error injection, cancellation/restart and the full Windows release walk.
