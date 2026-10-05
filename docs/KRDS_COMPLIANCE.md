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
| Result collection and category navigation | [목록 탐색](https://www.krds.go.kr/html/site/global/global_04.html), [검색 결과 확인](https://www.krds.go.kr/html/site/service/service_02_04.html) | Finding, page and coverage views; result counts; list and empty state. | Packaged Windows operator review. |
| Technique filter | [필터링·정렬](https://www.krds.go.kr/html/site/global/global_10.html) | Immediate visible count and no-match reset. | Keyboard path in packaged app. |
| Result search | [검색](https://www.krds.go.kr/html/site/service/service_02_03.html), [검색 결과 확인](https://www.krds.go.kr/html/site/service/service_02_04.html) | One search field; query/filter retained through inspection. | Search semantics on larger real results. |
| Finding inspector | [상세 정보 확인](https://www.krds.go.kr/html/site/global/global_06.html) | Plain-language reason, raw text, source, CSS/geometry, actual JPEG when captured, unavailable state, review control, return focus. The list remains mounted in a desktop split view; mobile shows the inspector alone. | Packaged native evidence and assistive-technology review. |
| Export dialog | [확인](https://www.krds.go.kr/html/site/global/global_11.html), [모달](https://www.krds.go.kr/html/site/component/component_04_05.html) | Result-embedded validation, technical disclosure, partial-coverage warning, focus trap and return, save outcomes. | Native save/cancel on Windows. |
| Page/scan failure | [오류](https://www.krds.go.kr/html/site/global/global_07.html) | Failed page and timeout coverage with retained findings. | Inject failures in packaged app. |
| Contextual help | [도움](https://www.krds.go.kr/html/site/global/global_02.html) | Short scope help and optional technical explanation. | Keyboard and zoom review. |

The KRDS result pattern motivates a visible count, category navigation, one
search field, a result list, a no-result message, and a recovery action. Scan
status is a progress/status interaction; the KRDS **사용자 피드백** pattern is for
collecting a user's opinion and is not the scanner's status pattern.

## Token hierarchy and local extensions

KRDS defines **primitive → semantic → component**. Primitive values are
references, semantic values express roles, and component values are the styles
consumed by controls. The local primitive values now match the [KRDS HTML
Component Kit transformed token JSON](https://github.com/KRDS-uiux/krds-uiux/blob/main/tokens/transformed_tokens.json)
for the light mode; the CSS names are local mappings, not an imported package.
Buttons, inputs, result navigation, badges, result cards and the dialog now
consume component roles backed by semantic roles. The former flat color and
radius aliases have been removed. The [KRDS typography guide](https://www.krds.go.kr/html/site/style/style_03.html)
specifies Pretendard GOV; the app bundles the v1.3.9 variable font under its
[OFL license](https://github.com/orioncactus/pretendard/blob/v1.3.9/packages/pretendard-gov/dist/LICENSE.txt)
so packaged Windows use has no font CDN dependency. The source font SHA-256 is
`a2f477842d55918053db560007dd615ab44eab848d3aa09dd61e96b4da76210e`.
Some layout spacing and state-specific component styles still need audit, so
**full token conformance is not yet proven**.

| Local primitive → semantic → component | Source KRDS role | Purpose and consumers | Deviation reason |
| --- | --- | --- | --- |
| `primary-50` → `action` → `button-primary-fill`, `button-secondary-border`, `button-link-text`, `badge-border`, `result-navigation-active` | `mode-light.color.button.primary-fill` | Start/save, secondary and link buttons, badge, active result topic; 60/70 supply hover/pressed | Local component role names separate consumers; colors are unchanged. |
| `gray-5` → `surface-subtle` → `result-card-surface` | `mode-light.color.surface.gray-subtler` | Page groups (`#f4f5f6`) | None. |
| `danger-60` → `error` | `mode-light.color.text.danger` | Form, export and status errors (`#bd2c0f`) | Generic error text currently consumes the semantic role; error text accompanies color. |
| `number-4` → `radius-control` → `input-radius`, `button-radius`, `filter-radius` | `semantic.radius.medium2` | Control and result group corners (`0.6rem`) | None. |
| `number-5/6/7/8` → `padding-3/4/5/6` → button/input padding | `semantic.padding.3/4/5/6` | Control and result workspace spacing | None for controls; remaining layout numbers need audit. |
| `alpha-black-75` → `overlay-scrim` → `dialog-scrim` | `mode-light.color.background.dim` | Export dialog backdrop (`#000000bf`) | None. |
| 13/15/17/19/24/32px type values → `font-body-*` / `font-heading-*` → badge, step, card title, check detail and preview | `responsive-pc.font-size.body` / `heading` in the [transformed tokens](https://github.com/KRDS-uiux/krds-uiux/blob/main/tokens/transformed_tokens.json) | Body, hints, headings, result and dialog text | Numeric rem values are converted from KRDS's 10px base to this app's 16px root; rendered sizes preserve KRDS roles without changing the user's root font setting. |
| `Pretendard GOV Variable` → `font-family` → body text | `primitive.typo.font` | All product text | Bundled font file replaces a network-dependent font source. |

Before adding a custom token, record its exact KRDS source role, semantic
purpose, consuming components, and reason for deviation. The local button,
input, badge and result-navigation roles map existing KRDS semantic colors
without changing their values. The release audit
must inspect computed styles for representative normal, focus, disabled and
error controls and trace each value through the three levels. Residual raw
layout spacing remains migration work.

## State coverage

| State | Required behavior | Current evidence or gap |
| --- | --- | --- |
| Initial, loading | URL and scope visible; result/detail loading named. | React tests; browser setup and result path observed. |
| Running | Real counts, elapsed time, page and meaningful live status. | React tests; live screen-reader cadence open. |
| Partial, success | Valid findings retained; checked/failed pages shown; export warns of omitted coverage. | L2 scanner fixture, result coverage view, and synthetic browser export dialog; packaged host open. |
| Empty, no filter match | Distinguish zero findings from a filter miss; reset action. | React and browser demo checks. |
| Error, unavailable evidence | Name the failure and next action; no fabricated image. | React start/cancel/save rejection paths show Korean recovery actions without raw host errors; native failure injection open. |
| Disabled | Adjacent explanation and predictable focus. | Export disabled until validation; all controls need audit. |
| Cancellation settlement | Confirm before stopping, then await host terminal state. | React test; packaged host open. |
| Confirmation, save success, save failure | Modal focus, validation, path/error, return focus. | React and browser dialog checks; native save open. |

## Release gate and evidence

Every Product V2 UI change must record: official pattern and any deviation;
token lineage; keyboard-only operation; visible and restored focus; 360px
reflow and native 200% zoom; non-color state cues; loading, empty and error
states; dialog focus behavior; accessible live status; clear Korean language;
and control target size for mixed-age operators. An unexplained deviation
blocks release. The packaged Windows operator walk must verify the actual
Tauri host and real scan/evidence/export.

**Observed 2026-10-06:** `npm test` passed 118 tests; `npm run typecheck` and
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
change, mobile return restored the observed 366 px list scroll position.
With official light color values, the
same browser check measured
body 16.18:1, primary button 4.55:1, secondary button 4.55:1 and hint 8.68:1
contrast; primary button height was at least 44 px. BrowserHost data is a
labelled demo, not a live scan.
The same Chromium smoke now checks that the bundled Pretendard GOV variable
font reaches the loaded state and computes to a 17 px body size; the 360 px
layout and 200% CSS zoom checks still pass after the typography change.

**Open:** native zoom, assistive technology, residual layout token audit,
large-result native review, and packaged Windows acceptance.
