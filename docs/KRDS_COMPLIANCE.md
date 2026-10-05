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
| Result collection and category navigation | [목록 탐색](https://www.krds.go.kr/html/site/global/global_04.html), [검색 결과 확인](https://www.krds.go.kr/html/site/service/service_02_04.html) | Finding, page and coverage views; result counts; list and empty state. | 20-finding operator review. |
| Technique filter | [필터링·정렬](https://www.krds.go.kr/html/site/global/global_10.html) | Immediate visible count and no-match reset. | Keyboard path in packaged app. |
| Result search | [검색](https://www.krds.go.kr/html/site/service/service_02_03.html), [검색 결과 확인](https://www.krds.go.kr/html/site/service/service_02_04.html) | One search field; query/filter retained through inspection. | Search semantics on larger real results. |
| Finding inspector | [상세 정보 확인](https://www.krds.go.kr/html/site/global/global_06.html) | Plain-language reason, raw text, source, CSS/geometry, actual JPEG when captured, unavailable state, review control, return focus. | Packaged native evidence and desktop split layout. |
| Export dialog | [확인](https://www.krds.go.kr/html/site/global/global_11.html), [모달](https://www.krds.go.kr/html/site/component/component_04_05.html) | Result-embedded validation, technical disclosure, focus trap and return, save outcomes. | Native save/cancel on Windows; partial coverage warning. |
| Page/scan failure | [오류](https://www.krds.go.kr/html/site/global/global_07.html) | Failed page and timeout coverage with retained findings. | Inject failures in packaged app. |
| Contextual help | [도움](https://www.krds.go.kr/html/site/global/global_02.html) | Short scope help and optional technical explanation. | Keyboard and zoom review. |

The KRDS result pattern motivates a visible count, category navigation, one
search field, a result list, a no-result message, and a recovery action. Scan
status is a progress/status interaction; the KRDS **사용자 피드백** pattern is for
collecting a user's opinion and is not the scanner's status pattern.

## Token hierarchy and local extensions

KRDS defines **primitive → semantic → component**. Primitive values are
references, semantic values express roles, and component values are the styles
consumed by controls. The current CSS implements the color and radius chain
below. Existing legacy aliases and raw spacing remain, so **strong token
conformance is not yet proven**. Token names here describe local roles; they
do not claim an official KRDS token file was imported.

| Local primitive → semantic → component | Source KRDS role | Purpose and consumers | Deviation reason |
| --- | --- | --- | --- |
| `primary-70` → `action` → `accent` | Primary action color | Start, save, step and badge | Transitional component alias; palette value needs official comparison. |
| `gray-5` → `surface-subtle` → `result-card-surface` | Neutral surface | Page groups | None. |
| `danger-60` → `error` → `error` | Error content | Form, export, status error | Transitional alias; text accompanies color. |
| `radius-medium` → `radius-control` → `filter-radius` | Control shape | Page group and filter | None. |
| `scrim` → `overlay-scrim` → `dialog-scrim` | Modal overlay | Export dialog | Local 55% black; compare official overlay and contrast. |

Before adding a custom token, record its exact KRDS source role, semantic
purpose, consuming components, and reason for deviation. The release audit
must inspect computed styles for representative normal, focus, disabled and
error controls and trace each value through the three levels. Raw colors,
spacing and radii in component declarations remain migration work.

## State coverage

| State | Required behavior | Current evidence or gap |
| --- | --- | --- |
| Initial, loading | URL and scope visible; result/detail loading named. | React tests; browser setup and result path observed. |
| Running | Real counts, elapsed time, page and meaningful live status. | React tests; live screen-reader cadence open. |
| Partial, success | Valid findings retained; checked/failed pages shown. | L2 scanner fixture and result coverage view; packaged host open. |
| Empty, no filter match | Distinguish zero findings from a filter miss; reset action. | React and browser demo checks. |
| Error, unavailable evidence | Name the failure and next action; no fabricated image. | React branches; native failure injection open. |
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

**Observed 2026-10-06:** `npm test` passed 117 tests; `npm run typecheck` and
`npm run build -w apps/web` passed. `node benchmarks/ui-smoke.mjs` exercised
the BrowserHost demo in Chromium at 360 CSS px: three stages, five findings,
search/reset, page review, inspector focus return, export focus/Escape/return,
and document width 360 px. A CSS `zoom: 2` check at a 720 px viewport also
found no document overflow. This approximates reflow; it is **not native 200%
browser zoom**. BrowserHost data is a labelled demo, not a live scan.

**Open:** native zoom, assistive technology, full token migration, official
value comparison, large-result review, and packaged Windows acceptance.
