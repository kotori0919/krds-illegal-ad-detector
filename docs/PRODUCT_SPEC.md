# Product spec V2 — operator workflow

Status: design freeze, 2026-10-05. Implementation status is tracked in `ARCHITECTURE.md` and PR #2; this document is the target behavior.

## User, job, success

The primary user is a NIA/public-sector employee who checks public websites and coordinates follow-up on suspect advertisements. They may use a computer daily without knowing HTML, CSS, model scores, or crawling. Success means they can enter one site, understand scan scope and progress, identify which public pages need review, inspect credible evidence for each finding, account for uninspected pages, and save a valid official result without developer help.

The official contest target remains Windows 11 on a GPU-less PC, within the 30-minute evaluation timeout. The product's default scanner budget remains 1500 seconds. Detection and output invariants are defined in `KODEX.md`; this redesign does not add official technique values or alter `result.json`.

## Tasks and acceptance

| Operator task | Target behavior | Acceptance observation |
| --- | --- | --- |
| Set scope | URL is focused on entry; automatic default names lower pages, posts/comments, frames, and approximate maximum time. Optional quick/custom modes disclose their actual limits. | Operator starts a scan with URL only; invalid URL gets an actionable field message. |
| Track scan | Korean stage, elapsed time, visited/queued counts, current page, confirmed findings, recent meaningful findings and page failures; no fabricated percentage. | Counters change during a real scan; cancellation settles before UI leaves progress. |
| Review findings | Official count, affected-page count, checked-page count, duration, failures, and extra count. Filter/search and finding/page views share one result set. | Operator can inspect 20 findings in sequence without losing filter, selected row, or scroll context. |
| Judge evidence | Type, raw content, page, plain-language cause, actual visual evidence when available, text transformation, and collapsed technical details. | Each inspector states what was observed and why; absent assets say why they are absent. |
| Assess coverage | Successes and failures are separate, including page address and reason. A few failures do not erase successful findings. | Partial completion is explicit in summary and save dialog; failed pages can be opened as a list. |
| Save | Results workspace opens a short validation dialog; official file uses existing serializer and native save dialog. | Six checks are visible as pass/fail text; save is disabled on invalid result; cancel leaves results intact. |
| Repeat | New scan action returns to URL input. | Previous filters do not contaminate the next session. |

## Information architecture

One restrained application shell, with title, help, current site, and three-stage indicator. No permanent left sidebar. The result workspace has three peer areas: 공식 탐지 (default), 추가 분석 (separate, clearly non-official), 점검 범위. The official area has 탐지 항목별 and 페이지별 views. The inspector and save confirmation remain within results. Technical data is available only through 기술 정보.

The operator sees Korean labels: 닮은꼴 글자 위장, 자모 분해, 투명 텍스트, 화면 밖 은닉. Enum strings and session IDs are secondary technical data. URL/path remains readable and copyable. The '주제' input has no demonstrated operational role; remove it from primary UI while passing the schema-required `meta.topic` as an empty string unless an official requirement later supplies a meaning.

## Scope presets

| Mode | maxPages | maxDepth | timeoutSec | When to use |
| --- | ---: | ---: | ---: | --- |
| 자동 권장 (default) | 200 | 4 | 1500 | Routine site inspection, same current default. |
| 빠른 점검 | 30 | 2 | 300 | Preliminary check; explicitly warns that it covers fewer pages. |
| 직접 설정 | user values | user values | user values | Experienced operator; existing validation bounds apply. |

`maxFrameDepth` stays 4 for all modes. Scope summary describes configured limits, not a promise that every linked page will be accessible. Before implementation, verify Tauri actually forwards each value to the worker and that timeout is enforced. No preset is purely cosmetic.

## Constraints and trust

External pages and destinations are untrusted. Do not auto-open advertisement links. Page URL opening must require an explicit operator action and use safe `http(s)` navigation; copy is safer default. Visual assets come from the scan and are loaded through session-scoped host access, not arbitrary file paths supplied by a page. Keep the cheap-first pipeline: no screenshots for every element, OCR for every image, VLM for every candidate, or graph work in the crawl hot path.

Current implementation gaps are not accepted behavior: five-step navigation, `OfficialFinding`-only evidence, raw selectors in primary list, no persisted coverage/failure list, and no visual capture. Phase B–G migration and acceptance are specified in `TEST_STRATEGY_V2.md`.
