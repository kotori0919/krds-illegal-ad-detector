# Product spec V2 — operator workflow

Status: target behavior, revised 2026-10-06 for concise operator copy. Implementation and remaining acceptance evidence are tracked in `ARCHITECTURE.md`, `KRDS_COMPLIANCE.md` and `DRY_RUN.md`.

## User, job, success

The primary user is a NIA/public-sector employee who checks public websites and coordinates follow-up on suspect advertisements. They may use a computer daily without knowing HTML, CSS, model scores, or crawling. Success means they can enter one site, understand scan scope and progress, identify which public pages need review, inspect credible evidence for each finding, account for uninspected pages, and save a valid official result without developer help.

The official contest target remains Windows 11 on a GPU-less PC, within the 30-minute evaluation timeout. The product's default scanner budget remains 1500 seconds. Detection and output invariants are defined in `KODEX.md`; this redesign does not add official technique values or alter `result.json`.

Product V2 acceptance has **two inseparable tracks**. The operator track includes three-stage workflow, KRDS Adaptive patterns/tokens, real evidence, page/finding review, and export inside results. The scanner track includes one global monotonic deadline, single-pass live-page processing, bounded concurrency, deterministic aggregation, realistic L2/L3 equivalence, and Windows performance acceptance. A polished UI on the current serial double-pass engine is not V2 completion.

## Tasks and acceptance

| Operator task | Target behavior | Acceptance observation |
| --- | --- | --- |
| Set scope | URL is focused on entry; automatic default names lower pages, posts/comments, frames, and approximate maximum time. Optional quick/custom modes disclose their actual limits. | Operator starts a scan with URL only; invalid URL gets an actionable field message. |
| Track scan | Korean stage, elapsed time, visited/queued counts, current page, confirmed findings, recent meaningful findings and page failures; no fabricated percentage. | Counters change during a real scan; cancellation settles before UI leaves progress. |
| Review findings | Official count, affected-page count, checked-page count, duration, failures, and extra count. Filter/search and finding/page views share one result set. | Operator can inspect 20 findings in sequence without losing filter, selected row, or scroll context. |
| Judge evidence | Type, raw content, page, plain-language cause, actual visual evidence when available, text transformation, and collapsed technical details. | Each inspector states what was observed and why; absent assets say why they are absent. |
| Assess coverage | Successes and failures are separate, including page address and reason. A few failures do not erase successful findings. | Partial completion is explicit in summary and save dialog; failed pages can be opened as a list. |
| Save | Results workspace opens a concise confirmation with official count and relevant coverage failure; official file uses the validated serializer and native save dialog. | Internal validation blocks an invalid result with one actionable error; native cancellation leaves results intact; success names the saved path. |
| Repeat | New scan action returns to URL input. | Previous filters do not contaminate the next session. |
| Finish within bounds | Shared deadline and adaptive bounded pool; optional evidence yields before official detection. | On 4-vCPU/8-GB Windows without GPU, default concurrency starts at 2; wall time, memory, CPU and semantic equivalence are recorded at 1–4 workers. |

## Information architecture

One restrained application shell, with title, help, current site, and three-stage indicator. No permanent left sidebar. The result workspace has three peer areas: 공식 탐지 (default), 추가 분석 (separate, clearly non-official), 점검 범위. The official area has 탐지 항목별 and 페이지별 views. The inspector and save confirmation remain within results. Technical data is available only through 기술 정보.

The operator sees Korean labels: 닮은꼴 글자 위장, 자모 분해, 투명 텍스트, 화면 밖 은닉. Enum strings and session IDs are secondary technical data. URL/path remains readable and copyable. The '주제' input has no demonstrated operational role; remove it from primary UI while passing the schema-required `meta.topic` as an empty string unless an official requirement later supplies a meaning.

Results use one search input for content/page URL, a visible total and category count, official/extra/coverage navigation, instant filter count, loading and zero-match states, and a clear reset action. Search and filter values persist while the operator inspects findings. KRDS Adaptive is the declared style track; `KRDS_COMPLIANCE.md` owns the component/basic/service pattern map and primitive → semantic → component token migration. Unexplained deviations block release.

## Scope presets

| Mode | maxPages | maxDepth | timeoutSec | When to use |
| --- | ---: | ---: | ---: | --- |
| 자동 권장 (default) | 200 | 4 | 1500 | Routine site inspection, same current default. |
| 빠른 점검 | 30 | 2 | 300 | Preliminary check; explicitly warns that it covers fewer pages. |
| 직접 설정 | user values | user values | user values | Experienced operator; existing validation bounds apply. |

`maxFrameDepth` stays 4 for all modes. Scope summary describes configured limits, not a promise that every linked page will be accessible. Before implementation, verify Tauri actually forwards each value to the worker and that timeout is enforced. No preset is purely cosmetic.

The user-facing normal budget is 1500 s (about 25 minutes); internal hard stop 1650 s is not ordinary UI copy. V2 custom settings must not promise a duration beyond that guard: reduce the currently accepted 1750 s custom maximum to at most the supported configured limit, with explicit migration/validation in Contract v0.2. Desired Windows completion is <=1200 s for the acceptance scenario, not a fake per-scan progress percentage.

## Constraints and trust

External pages and destinations are untrusted. Do not auto-open advertisement links. Page URL opening must require an explicit operator action and use safe `http(s)` navigation; copy is safer default. Visual assets come from the scan and are loaded through session-scoped host access, not arbitrary file paths supplied by a page. Keep the cheap-first pipeline: no screenshots for every element, OCR for every image, VLM for every candidate, or graph work in the crawl hot path.

The three-stage implementation now provides recorded details, selective actual JPEGs, collapsed selectors and persisted coverage. Remaining acceptance gates are recorded in `TEST_STRATEGY_V2.md`; these implemented slices alone do not establish full V2 release readiness.
