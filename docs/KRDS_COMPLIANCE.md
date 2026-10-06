# KRDS Product V2 pattern and release record

Status: **partial implementation, release gate open** (2026-10-06). The previous
five-stage audit is available in Git history; its tests and line references do
not describe this UI.

### Resumed native core evidence (2026-10-06)

VM use is authorized. Per the user's ordering, core acceptance precedes the
remaining strict KRDS layout/zoom/assistive-technology checks. The installed
app passed actual cancellation/restart, a clean one-page zero result,
genuine unavailable evidence, all 21 municipal finding reviews and image
decodes, retained search/filter context and six page groups. Native Save As
success/cancellation and disabled pending actions were observed. A real host
write failure reached the actual dialog error; retry saved validated bytes.
The latter used only an export-directory fault injected through native
WebView2 postMessage and did not fabricate a response. Reports and exact
installed app/worker identity are in `DRY_RUN.md`.

Complete official-object equality at C1-C4 has also passed. A subsequent
native run cancelled two active page workers, verified zero remaining
scanner Chromium, then displayed both actual image-based extra findings and
saved an empty validated official file. Strict KRDS/assistive-technology
gates remain separate; these core observations do not declare the overall
release gate complete.

### Native Windows zoom slice (2026-10-06)

OBSERVED: the zoom-enabled NSIS package installed successfully on `clean11`.
OS Ctrl+equal input changed actual WebView2 `devicePixelRatio` from 1 to 2;
the 1200px client became a 600 CSS px viewport. Entry, real synthetic-scan
results and save confirmation reported DPR 2, viewport 600px, document 592px
and no detected horizontal overflow. Escape restored focus to the results
Save button. This establishes actual 200% zoom at 600px; it does not prove
the remaining combined 200%/360px or assistive-technology gates. The report
is `/tmp/illegal-ad-toolchain/current-native-zoom-current.json`. The capture
of confirmation is not sufficient visual proof of its rendered contents.
Installer SHA-256:
`dbbee1a1ac5d82f894a1d51643630e4a938bf62501e45937d002d87faf5c26a4`.

OBSERVED in a subsequent actual OS-window resize: DPR 2 and effective
viewport 355 CSS px, document width 348px, on results, finding inspector and
save confirmation. Keyboard Enter opened the inspector and activated its
return-to-list action; Enter opened confirmation and Escape restored Save
focus. Report: `/tmp/illegal-ad-toolchain/current-native-zoom360-current.json`.
This covers the combined narrow viewport and native zoom metric check.
CDP captures do not establish the full rendered dialog appearance; native
visual and assistive-technology checks remain open.

OBSERVED through the actual VM display, rather than CDP screenshots:
at DPR 2 / effective 355px, the complete save confirmation title, official
count, failed-page notice and both actions were visible without clipping.
OS Tab moved Cancel → Save → Cancel, with a visible focus outline; Escape
closed confirmation and visibly restored Save focus. Native captures are
`/tmp/illegal-ad-toolchain/zoom-native-confirmation-visual.png`,
`zoom-native-save-focus.png`, `zoom-native-focus-wrap.png` and
`zoom-native-focus-restored.png` in the same directory. This closes the
rendered confirmation check only; assistive-technology checks remain open.

### Native status event audit (2026-10-06)

OBSERVED: the actual installed synthetic scan changed its status from 0 to
14 findings before cancellation. An MTA Windows UIAutomation listener received
seven LiveRegionChanged events containing the actual Korean counts
2, 4, 6, 9, 11, 13 and 14. The listener collected descendant accessible text
because the status container's own Name is empty. Report:
`/tmp/illegal-ad-toolchain/current-native-live-current.json` (1678 bytes).
The empty-event municipal run did not establish an application defect.
This proves native delivery of the changing status text, not spoken output.
Intervals as short as 0.188 seconds reveal an unresolved announcement cadence
issue; visible counters must remain immediate while announcements are bounded.
The VM has no audio device, so spoken Narrator output remains unverified.

OBSERVED after the cadence correction: the revised NSIS installed successfully.
Its executable SHA-256 matches the host build
`70320694da2e504d9bab0891382b1dee4b488a07a6af5870871d9049ec41b1b3`;
the bundled worker remains `90aed157e13c8a3d32cba551a271edb47915f3afdd632ef80ec53768a0889013`.
Actual synthetic work advanced the visible count to 13 while the status
announcement had reached 6. Windows delivered Korean 0- and 6-finding events
7.537835 seconds apart in this run; cancellation settled, and the final
native process summary contained only the three preexisting idle fixture
servers, with no product or scanner Chromium process. This is a single-run
smoke of announcement coalescence, not an assertion that native delivery is
exactly every 2 seconds or a spoken-output check. Report:
`/tmp/illegal-ad-toolchain/current-native-live-current.json` (682 bytes);
identity/process capture: `announcement-installed-identity.png` in the same
directory. The original 1678-byte audit is retained separately as
`native-live-unthrottled-baseline.json`. Eight scan-feedback tests, typecheck,
lint and the actual-scanner browser IPC replay smoke also passed.

### Populated extra analysis at native zoom (2026-10-06)

OBSERVED on the installed announcement package: actual two-page image analysis
returned both extra findings and displayed their Korean list with zero official
findings. At actual OS zoom DPR 2 / effective 355px, document width was 348px.
The native VM display showed the category controls, count 2 and the first card
heading; this capture does not show both complete card bodies. A native-command
export wrote 246 validated bytes with zero official findings. The same run
cancelled active workers and observed zero scanner Chromium after settlement.
Report: `/tmp/illegal-ad-toolchain/current-native-extra-core-current.json`
(2629 bytes); native display: `native-extra-zoom-visual.png` in the same directory.
The earlier core report is retained as `native-extra-core-before-zoom.json`.

### Native state reflow batch (2026-10-06)

OBSERVED on the same installed package: initial entry, no-filter-match,
actual host save failure, successful retry and a fresh one-page zero-finding
scan all reported DPR 2, effective width 355px and document width 348px.
Search reset cleared the entered query. The read-only ISO host-write rejection
displayed the actual Korean save error, and the second export action wrote
4660 UTF-8/no-BOM bytes validated as the actual 17-finding result. No responses
were fabricated; only the export directory in native postMessage was changed.
The fresh negative scan reached the actual empty-result message and official
count 0. Report: `/tmp/illegal-ad-toolchain/current-native-save-error-current.json`
(1076 bytes); the earlier report is `native-save-error-before-zoom.json`.
The native display capture `native-state-zoom-empty-visual.png` shows the zero
counts and result controls. CDP failure/success captures were blank and do not
prove their rendered appearance. The metric and behavioral assertions above
remain separate from visual capture and spoken-output verification.

### Installed keyboard-only workflow (2026-10-06)

OBSERVED: the installed app completed URL entry, expansion of custom scope,
radio choice with arrows, entry of page/depth/time limits, real scan start,
search no-match/reset, technique selection, finding inspection/review/return,
page grouping, save confirmation focus cycle/Escape/return, and restart using
only Tab, Enter, arrows and text keyboard input. The driver used no pointer
clicks, forced focus or direct form value assignment. Native OS window setup
is outside this workflow; WebView2 CDP delivered the actual keyboard events.
The selected technique was HOMOGLYPH, nine page groups were present, the Save
outline computed to 3px, and Save/URL focus restoration passed. This walk
checks confirmation, not native chooser file writing; separate native save
runs prove the latter. Report:
`/tmp/illegal-ad-toolchain/current-native-keyboard-current.json` (448 bytes).

### Current confirmation and result-state evidence (2026-10-06)

OBSERVED: `smoke:ui-states` used actual scanner output (17 official findings
and a separate zero-finding scan) in the built React app through browser IPC
replay. Two immediate Save activations produced one pending host request;
Escape/Tab stayed inside the confirmation. Cancellation returned focus to
the enabled Save action. An actual Linux filesystem `EACCES` became a Korean
alert without exposing its path, and retry saved 4680 bytes with unchanged
findings and a passing official validator. Coverage loading blocked Save;
missing/rejected coverage retained valid findings. A rejected result read
exited loading and allowed a new scan. A genuine capture-budget omission
showed no fabricated image while retaining the raw evidence and review action.

OBSERVED: the save-error state had no document or nested overflow at 360px;
headed Linux Chromium at actual 200% zoom reported DPR 2, effective 360px
viewport and 352px document. Pending, error, retry and inspector-return focus
checks passed. The integrated JavaScript suite passed 139/139. This browser
replay and Linux file write do not verify the native Windows save dialog,
Windows ACLs, screen-reader announcements or the installed package.

### Current progress and layout evidence (2026-10-06)

OBSERVED: the real relocated Node worker and actual Rust session registry
retained 21 progress events, six attempted pages, one expected failed page,
five official findings and five JPEG details. Active-page admission, typed
failure, finalizing snapshot and terminal clearing were checked. The native
registry tests pass 16/16; the JavaScript suite passes 134/134 after replacing
wording assertions with progress recovery, stale snapshot, clock, settlement,
focus and failure behavior checks.

OBSERVED: `npm run smoke:live-progress-ui` ran the actual scanner against the
six-page fixture with browser IPC replay and deliberately delivered no events.
Polling displayed current work, `00:02`, failed coverage and the partial result.
At 360px the document was 360px wide with 17px body type; Escape restored the
stop control. This validates React recovery, not native Windows IPC.

OBSERVED on the same live-progress path at native Linux Chromium 200% zoom:
DPR 2, effective 360px viewport, 352px document, no nested overflow, `00:02`
clock, restored stop focus and reduced-motion text-only feedback. The single
KRDS indeterminate spinner stays hidden from the speech stream.

OBSERVED: headed Linux Chromium at actual 200% zoom (DPR 2, 360px viewport)
showed no document or nested overflow in setup, results, extra analysis,
inspector and save dialog. Inspector/dialog focus and 3px outline/restoration
passed after the layout token migration. Windows zoom and assistive technology
remain NOT_RUN for this change; VM use is now authorized, and the user
explicitly deferred these strict UX checks until core acceptance is settled.

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
| Scan status | [불확정 스피너·피드백](https://www.krds.go.kr/html/site/component/component_07_02.html), [오류](https://www.krds.go.kr/html/site/global/global_07.html) | One spinner with Korean status after one second; real elapsed time, active pages, failures, five recent activities, poll recovery and cancellation settlement. Reduced-motion preference keeps text only. | Live status cadence with assistive technology and packaged Windows snapshot recovery. |
| Result collection and category navigation | [목록 탐색](https://www.krds.go.kr/html/site/global/global_04.html), [검색 결과 확인](https://www.krds.go.kr/html/site/service/service_02_04.html) | Three peer areas: 공식 탐지, 추가 분석, 점검 범위. 탐지 항목별 and 페이지별 are nested under 공식 탐지. Result counts, list and empty state are visible; the one search/filter remains scoped to official findings. | Packaged Windows operator review and extra-list assistive-technology audit. |
| Technique filter | [필터링·정렬](https://www.krds.go.kr/html/site/global/global_10.html) | Immediate visible count and no-match reset. | Keyboard path in packaged app. |
| Result search | [검색](https://www.krds.go.kr/html/site/service/service_02_03.html), [검색 결과 확인](https://www.krds.go.kr/html/site/service/service_02_04.html) | One search field; query/filter retained through inspection. | Search semantics on larger real results. |
| Finding inspector | [상세 정보 확인](https://www.krds.go.kr/html/site/global/global_06.html) | Recorded matched terms, text transformations, source, CSS/geometry, actual JPEG when captured, unavailable state, review control, return focus. The list remains mounted in a desktop split view; mobile shows the inspector alone. | Actual Windows 21-finding review observed; assistive-technology review remains open. |
| Export dialog | [확인](https://www.krds.go.kr/html/site/global/global_11.html), [모달](https://www.krds.go.kr/html/site/component/component_04_05.html), [오류](https://www.krds.go.kr/html/site/global/global_07.html) | “결과 저장” shows the official count and only relevant failed-page/time-limit status. Internal validation and coverage settlement gate Save. One pending save disables both actions and retains dialog focus; settlement restores Save focus. Failure gets one actionable alert. No successful-check cards, raw JSON, or repeated explanation. | OBSERVED: installed Windows Save As success/cancel, disabled pending actions, focus restoration, actual host write failure and retry with validated bytes. Native zoom and assistive-technology checks remain open. |
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

The [KRDS layout guide](https://www.krds.go.kr/html/site/style/style_05.html)
governs the following local dimensions. These are service extensions, not
claims that KRDS specifies these exact widths. Each passes through primitive,
semantic and component roles while preserving the existing responsive layout:

| Local primitive | Semantic purpose | Component consumers | Source role and deviation |
| --- | --- | --- | --- |
| `layout-reading-width` (52rem) | `reading-width` | `page-max-width`, `steps-max-width` | Layout content width; narrower reading column for URL form, status and long Korean evidence. |
| `layout-workspace-width` (90rem) | `workspace-width` | `workspace-max-width` | Layout multicolumn content; list/inspector need parallel room on large windows. |
| `layout-dialog-width` (42rem) | `dialog-width` | `dialog-max-width` | Modal content width; concise confirmation stays bounded and shrinks to available width. |
| `layout-label-width` (10rem) | `label-width` | `stats-label-width`, `counts-min-width`, `filter-min-width` | Form alignment and selectable-option readability; space for Korean labels and technique names. |
| `layout-search-width` (16rem) | `search-width` | `search-basis` | Input readable width; preferred flex basis, allowed to shrink at 360px. |
| `layout-inspector-width` (20rem) | `inspector-width` | `inspector-min-width` | Detail column readability; desktop minimum, removed by the existing narrow-layout switch. |
| `focus-width` (3px) | `active-indicator-width` | `result-navigation-indicator-width` | KRDS selection/border state cue; shares the documented 3px primitive to keep the active category visible in dense results. |
| `focus-width` (3px) | `progress-stroke-width` | `spinner-stroke` | KRDS indeterminate spinner path; the same local border extension remains visible during scan/settlement. |
| `motion-cycle` (1s) | `progress-cycle-duration` | `spinner-cycle-duration` | KRDS continuous indeterminate rotation; local duration gives a readable cycle without a false percentage. Reduced-motion preference uses the adjacent textual status instead of rotation. |

The 64rem desktop media condition is a documented local breakpoint for the
list/detail split, expressed literally because CSS custom properties cannot
be evaluated inside media queries. The off-screen 1px screen-reader utility
is accessibility clipping geometry. Neither is a component spacing token.
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
| Initial, loading | URL and scope visible; result/detail loading named and settled. | Result/coverage pending, absent and rejected reads exercised through React tests and actual-scanner browser replay. A rejected result exits loading; Save waits for coverage settlement. Native Windows read failures remain open. |
| Running | Real counts, elapsed time, page and meaningful live status. | React tests and Rust child-process pump verify retained counters; actual Windows progress observed. Live screen-reader cadence remains open. |
| Partial, success | Valid findings retained; checked/failed pages shown; export warns of omitted coverage. | Actual Windows result/save paths observed both the six-page/five-finding and 200-page/21-finding scenarios, each with one expected failed page. |
| Empty, no filter match | Distinguish zero findings from a filter miss; reset action. | OBSERVED: installed Windows app completed a one-page zero-finding scan. Search/filter context persisted through inspection; reset recovered all 21 municipal findings. |
| Separate extra analysis | Keep the official list/count unchanged; show a Korean summary, item count, loading, empty, unavailable, and technical disclosure states. | OBSERVED: installed Windows app displayed both actual image-based extra findings and saved a validated 246-byte official file containing zero findings. Populated-extra native zoom passed at DPR 2 / 355px; assistive-technology review remains open. |
| Error, unavailable evidence | Name the failure and next action; no fabricated image. | OBSERVED: installed Windows inspector showed genuine budget-unavailable evidence. A real host write rejection reached the dialog error; retry saved validated bytes. Only the export directory was fault-injected through native postMessage; no response was fabricated. |
| Disabled | Adjacent explanation and predictable focus. | Coverage and validation gate Save; a pending save disables both actions and keeps Escape/Tab focus inside. Browser replay passed; native controls still need audit. |
| Cancellation settlement | Confirm before stopping, then await host terminal state. | OBSERVED: installed Windows app cancelled with two page workers active, reached cancelled status, and left zero scanner Chromium processes. A subsequent scan completed. The transient disabled state was not captured natively. |
| Confirmation, save success, save failure | Modal focus, validation, path/error, return focus. | OBSERVED: native Save As success/cancel, disabled pending actions, Save focus restoration, actual host write failure and successful retry. Saved official bytes passed validation. Native 200% zoom and assistive-technology release checks remain open. |

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
error injection and the full Windows release walk. Actual native cancellation,
restart and retained search/filter inspector focus are recorded in `DRY_RUN.md`.

## Installed accessibility and extra disclosure correction (2026-10-06)

OBSERVED: the70320694 installed executable exposed the actual WebView2
accessibility tree for entry, URL validation error, running, results,
inspector and confirmation. Labelled URL textbox, Korean error alert,
progress status, result searchbox, technique combobox, review control and
named modal were present. The modal was marked modal and its inert
background restart action was absent from the active accessibility tree.
Current-stage DOM metadata identified setup, scan and result phases. Invalid
URL submission restored URL focus; technical disclosure opened with Enter.
All visible measured main-workflow controls had targets at least48 CSS px.
This is actual programmatic accessibility evidence; no Narrator spoken-output
claim is made. Report: `current-native-accessibility-current.json` (13291bytes)
in `/tmp/illegal-ad-toolchain`. The first temporary probe incorrectly expected
the search input to have textbox role; the actual searchbox role is correct.
The corrected probe passed; the first report is retained separately.

A separate actual two-page image scan exposed both populated extra headings,
named ordered list and disclosures in the native accessibility tree. It also
measured both technical disclosure targets at27.1875px. This was a real
mixed-age target defect. The extra details now reuse the existing `advanced`
KRDS disclosure object, including its semantic48px control size, focus and
spacing. No new tokens or pattern were introduced. The real-scanner browser
extra smoke at360px now checks target size and Enter activation; both measured
48px, opened with the keyboard and retained no horizontal overflow. Lint and
Windows release build passed.

OBSERVED after NSIS Add/Reinstall: both actual native extra disclosures
measured48px, opened with Enter and exposed their real headings/list in the
accessibility tree. Official count remained0 and actual native export wrote
246 validated bytes; active cancellation settled with no scanner Chromium.
Report: `/tmp/illegal-ad-toolchain/current-native-extra-accessibility-current.json`
(2878bytes); before-fix report retained as
`native-extra-accessibility-before-fix.json`. Installed EXE SHA-256:
`719664a407f558d64284aae34edbd784c287d0bb9cf8058567bfff34a0a3d149`.
It matches the executable extracted from the9fc8c667 NSIS payload; the raw
Cargo executable has a different hash because this bundle patches its payload.
Worker remained90aed157. Native inspection after close showed only the three
idle fixture Node servers, no app or scanner Chromium. Identity/process
capture: `extra-target-installed-identity.png` in the same temporary directory.

The remaining release audit includes the original element-crop/analysis-position
visual-evidence requirement. This correction does not close that functional gap.
