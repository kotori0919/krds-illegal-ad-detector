# Product V2 integration and release acceptance

## Current integration (2026-10-07)

The current source replaces the historical package described below. No new
freeze or whole-product audit is required before connecting features.

**Feature integration incomplete**

- Optional learned VLM inference remains disabled; no accuracy or CPU/package
  value has been demonstrated for the remaining difficult cases.

**Feature integration complete, release verification incomplete**

- Session-scoped selected-detail, paged image metadata and opaque asset reads
  replace full-bundle React transfer. Graph summary and bounded click-only
  finding/page/creative/domain slices use the same native session index.
- Gated IMG, computed CSS backgrounds, selected SVG and canvas feed the real
  offline OCR backend. IMAGE_ONLY_ILLEGAL_AD requires semantic evidence,
  independent corroboration and absence of equivalent visible DOM text.
- Advertisement witnesses qualify infrastructure relations; repeated normal
  CDN, analytics, font and logo resources remain observed-only. Optional
  classifier failure is disclosed and preserves the official result.
- The unused operator topic has been removed from UI, DTO and worker CLI.
- Measured visual scope is persisted separately from page-scan coverage:
  considered/known-unconsidered pages, observed candidates, acquired images,
  stored analyses, distinct OCR attempts/completions/unavailable results and
  reasoned skips. Candidate totals remain unknown. Attained limits are reported
  even when no additional excluded candidate was observed.
- Summary/detail/image/asset/graph reads expose recovery states and retry only
  the selected failed read. Scoped response guards preserve the current session
  and selection. Relations use Korean names/reasons with exact identities in
  technical disclosure; extracted link targets are not final landing claims.
- Operator review marks are temporary in-memory reading state, lost on a new
  scan or app reload. They do not confirm a violation, complete remediation,
  change official classification or change the exported official JSON.
- General text owners, independent-child exclusion, inline CSS sources and
  unique round-trip selectors run in the live single-pass scanner.
- Official and extra metadata use literal TOPIC. PageOutcome, FindingDetail,
  coverage, zero-width analysis and offline Korean/English OCR are serialized
  by the main worker and validated/persisted by the host.
- Shared deadline, bounded concurrency and deterministic official aggregation
  remain active. Cooperative cancellation preserves completed-page artifacts;
  the UI routes only after terminal state and confirmed hasResult.
- The KRDS three-step UI includes search, filters, page outcomes, evidence,
  image analysis and official file saving. The baseline 5bfdd56 NSIS-installed
  Windows app exercised the real Tauri bridge; the earlier 360px Chromium observation
  used explicitly marked IPC replay and retains that narrower scope.

OBSERVED for the P0 changes: a rebuilt portable Windows app scanned two served
pages through the native Tauri bridge. IMG, background, SVG and canvas produced
eight validated IMAGE_ONLY_ILLEGAL_AD findings, one reused creative and one
ad-related infrastructure relation; the official result retained its separate
TRANSPARENT finding. Results showed the domain with its two related pages,
click-only relationships and selected image/official inspector assets.
Read-only queries against that completed native session returned image-free
metadata (543-byte summary), selected JPEG bytes and bounded graph endpoints;
foreign-session/file-path access and oversized graph queries were rejected.
The throwaway observer's attempt to replace immutable native invoke failed;
these observations came from subsequent direct queries, not that observer.
The Windows smoke preceded the final frame-text and graph-collision fixes;
those fixes have real browser/OCR and exact-key collision regressions on Linux.
The complete native session suite, typecheck, lint and current source builds
pass. No installer cycle, 200-page sweep or full release audit was repeated.

MEASURED binary sizes: the rebuilt host is 18,751,488 bytes (+282,624 versus
the baseline installed host); bundled scanner JS is 119,070 bytes (+22,029).
No new external runtime/model dependency was added. Full installer size and
comparative runtime overhead are NOT_RUN. The existing first-eight-page,
250-KB/page acquisition, six-distinct-image OCR and shared deadline limits
remain active. OCR fidelity and skipped/unavailable bounded acquisitions are
still limitations; these fixtures do not establish broad classification accuracy.
OBSERVED for P1: real browser/OCR fixtures distinguish checked pages from visual
scope, positive/no-evidence images, exact attained limits and known exclusions;
an OCR failure retains valid official findings. The focused real-scan-output
IPC replay exercises isolated summary retry, rapid selection, readable bounded
relations, review/export immutability, focus return and narrow reflow. Its export
writes canonical worker JSON through an explicitly replayed transport; a
separate BrowserHost/ExportDialog test checks actual download Blob bytes.
Normal integration tests retain all assertions; file concurrency is bounded
to two because each file can launch multiple real browser/OCR processes.
The oversized-original fixture waits for actual image decode before checking
the already-declared response size. Final-candidate Windows observations and
exact artifact hashes are recorded in PR #2, separately from earlier binaries.
Remaining release checks are final installation/uninstallation, native
deadline/export and forced process-backstop acceptance. Historical evidence
keeps its original artifact scope; documentation-only changes do not invalidate
unchanged component observations. Learned VLM remains disabled.

## Earlier baseline observations

The observations below predate the P0 changes; they are not a current-build
release verdict.

OBSERVED: live served Chromium text/selector/zero-width/OCR/cancel regressions,
the packaged Node worker's complete and cancelled scans, native Rust worker
launch -> validated persistence -> retrieval/export, UI behavior and scoped
type/lint checks. The Korean image fixture produced the expected phrase with
0.96 confidence. This is one fixture, not a broad OCR accuracy measurement.
Baseline 5bfdd56 remote CI passed type checking, lint, tests and builds.

OBSERVED: current packaged Node/worker/OCR dependencies executed on Windows
10.0.26100.9457, Node v22.19.0. The served non-ID text produced one official
TRANSPARENT finding and one ZERO_WIDTH_OBFUSCATION auxiliary finding. Real
offline Korean image OCR returned the expected phrase with 0.96 confidence.
Cooperative cancellation during a second, hanging navigation retained the
checked page, official/detail/extra artifacts and completed OCR. All six
tracked worker/browser process IDs were absent after worker settlement.
This is packaged-worker evidence, not installed Tauri UI or JobObject proof.

OBSERVED: current-worker Linux 200-page C1-C4 sweep retained identical complete
official objects and PageOutcome arrays: 21 true positives, zero false
positives/negatives, 199 checked and one intended failed page in every run.
Each main-document URL was requested once. See PERF for scope and timings.

OBSERVED/MEASURED: current-candidate packaged Windows C1-C4 and worker A-F
cases. The200-page benchmark passed all validators and full-object equality,
TP21/FP0/FN0,199 checked/one intended failure; wall seconds were
347.131/174.271/112.477/87.849 (4-vCPU/8-GiB). The additional
`benchmarks/windows-v2-boundaries.mjs` executes the actual worker: capped
admission requested only root/a/b once at C1/C4, cross-origin outer/inner
frames once with complete selector chains, exact official/PageOutcome
equality, and a hanging navigation settled under the shared12s deadline in
11.207s while preserving the completed finding. These worker observations
do not prove the installed host's JobObject backstop or strict native UX.

OBSERVED: the fresh NSIS candidate installed and ran on the same Windows VM.
Installed host, scanner and OCR worker hashes matched the candidate report.
The actual UI -> Tauri commands -> installed worker -> artifact persistence
-> ResultsWorkspace path returned one TRANSPARENT finding, one zero-width
extra finding and offline OCR text/confidence0.96/rule decision2/2. Search,
filter and evidence-panel context survived review; actual CSS opacity0,
coordinates, viewport/crop and analysis-position evidence were displayed.
The page view distinguished a checked zero-finding page from HTTP404.
Cancellation stayed on progress while settling, then displayed the retained
one-finding result with checked1/failed8 and an explicit partial-result banner.
Native Save As exported the complete and cancelled official results; canonical
validation passed for482 and498 bytes respectively, including literal TOPIC
and exact original text. The installed host remained alive while its Node,
OCR and browser processes were absent after settlement. Raw final-file/hash/
process report: `/tmp/illegal-ad-v2-windows-native-export.json`.

NOT_RUN: current-candidate strict native UX matrix, native60s deadline/export
and forced long-duration host-guard exhaustion. Normal worker deadline and
cooperative process settlement do not prove that forced backstop. Native
control was recovered without changing Windows execution policy. Historical
evidence below retains its original hashes and does not close these gates.

## Historical package observations (2026-10-06)

Date: 2026-10-06. Historical overall status: OPEN.

Completion audit: two additional defects were found and corrected in source:
the inspector retained a finding excluded by a new search/filter, and checked
page coverage included failed attempts. The source141-test suite,20-finding
React walk, actual scanner/detail/export UI replay and native session L3 passed.
The corrected worker's Windows C1-C4 full-object sweep and actual native
checked1/failed2 result/export acceptance passed. Native60s deadline/export
also passed (54.125s,62 successful/one failed page,five findings,1,486 validated
bytes). Paired optional-capture acceptance also passed: selective and injected
unavailable modes preserve the corrected C2 full official and failure sets.
These current scanner/partial-export gates are closed; final combined scope
audit and native verification of the selection correction remain OPEN. Earlier claims below
retain their exact package scope and raw counts; those old checked counts
mean attempts, not successful pages. See ADR-0011 and KRDS_COMPLIANCE.

This audit preserves the expanded A-M scope. Core acceptance precedes strict
UX checks per the user's ordering. A passing slice does not close the release.
Earlier build observations retain their original environment and scope.

The earlier core workflow was OBSERVED: actual installed scans, real evidence,
review/filter/page navigation, validated export/retry, cancellation/restart,
full-object C1-C4 benchmark, deadline partial export and rejected-read recovery
passed. The original visual-evidence steering also names image-creative
presentation. Element-region crops and analysis
position overlays and image-creative assets passed actual installed Windows
execution. The updated worker's full Windows C1-C4 benchmark, paired
capture-unavailable comparison and native60s deadline/export passed. Core
functional acceptance was recorded for that earlier worker; the coverage
correction's fresh Windows gates also passed as recorded above. Full V2 remains
open for the final requirement-by-requirement audit of the original steering
and expanded A-M scope. The new visual controls' strict native UX gates now
passed, including the intrinsic-media correction; KRDS_COMPLIANCE preserves
exact package and execution scopes.

| Requirement | Concrete acceptance evidence | Current assessment |
| --- | --- | --- |
| A: bounded concurrency | CPU policy 2/3/4; reject >4; real overlapping page callbacks at C1-C4 | OBSERVED in worker-pool tests and Windows benchmark; see TEST_STRATEGY_V2 and PERF. |
| B: single pass | Each admitted URL requested once at C1/C4, including capped admission; live detection in that page | OBSERVED in single-pass served request-log tests. |
| C: live frames | Cross-origin and nested frames requested once per live instance; absolute full `>>>` chain; depth bound | OBSERVED in cross-origin-frame tests and the Windows shared-frame finding. |
| D: deterministic identity | Compare complete official objects, full URL/frame chain, order and IDs after canonical aggregation | OBSERVED in the repeated full-object Windows 200-page C1-C4 run. |
| E: correctness benchmark | Wall time, throughput, memory, CPU, coverage, TP/FP/FN, complete official set and validators at C1-C4 | MEASURED for current00298f worker: 334.756/170.419/111.326/86.184s, 200 attempts/199 checked/one intended failure, TP21/FP0/FN0. Complete official objects and failures equal; validators and1200s target pass. Paired C2 injected-unavailable captures preserve the full official set. PERF records metrics and limits. |
| F: one deadline | Shared monotonic worker deadline, admission/finalization reserve, bounded operations and optional capture; host process guard | OBSERVED short-budget scanner tests and current installed Windows60s partial scan/export: 54.125s wall,62 successful/one intended failure,five findings,timedOut=true, validated1,486-byte export identical to persisted result. Configured1500/internal cap1650/ceiling1800 implementation recorded in ADR-0011. Forced long-duration host guard exhaustion was NOT_RUN; this observation exercises normal deadline settlement. |
| G: Adaptive style | Explicit track and official normative references, documented deviations | INFERRED from ADR-0012 and KRDS_COMPLIANCE implementation mapping; this alone does not close visual/interaction gates. |
| H: token hierarchy | Primitive to semantic to component, custom role/purpose/consumers/deviation record | INFERRED from styles.css and KRDS_COMPLIANCE token tables; computed style/reflow observations are separately recorded. |
| I: pattern mapping | Every named interaction maps to the official component/basic/service pattern | Documented in KRDS_COMPLIANCE; per-interaction verification remains scoped in that table. |
| J: results behavior | Count, categories, one search, immediate filter count, no-match recovery and retained context | OBSERVED in actual installed 21-finding review plus native no-match/reset and zero-result runs. |
| K: state coverage | Initial/loading/running/partial/success/empty/no-match/error/unavailable/disabled/cancel/confirmation/save success/failure | OBSERVED across native runs and React/browser state checks; native narrow zoom batches cover extra, no-match, save error/retry and empty. Native result/detail/extra command rejection now settles with Korean alerts, correct save gating and fresh-scan recovery. Transient cancellation-disabled behavior remains covered by React execution, rather than a native screenshot. |
| L: strict UX release gate | Keyboard-only workflow, focus/return, 360 reflow/200% zoom, non-color state, dialogs, live status, Korean copy and target sizes | Native narrow zoom, confirmation focus cycle, Korean UIAutomation live events and complete keyboard-only workflow passed. Installed WebView2 accessibility roles/labels/modal isolation and 48px targets were observed; the extra disclosure's27px defect was reproduced and corrected to48px in the installed package. Reconcile remaining scoped rows; no spoken-output claim from this audio-less VM. |
| M: combined definition of done | Product workflow/evidence/review/export plus scanner deadline/single-pass/concurrency/determinism/realistic Windows acceptance | OPEN while any applicable release gate lacks evidence; do not infer completion from core benchmark success. |

## Historical installed build and evidence

Worker SHA-256:
`00298fe383b706b5642f9f4beb74e1894b9a3da8b18ac8466aca4db191f5cbd1`.
Installed executable SHA-256, matched against the extracted NSIS payload:
`22963b2577b2c82c50829e25862bc7272b84de6cd5c36324e062eeb44ccab3b9`.
NSIS SHA-256:
`84e1a1f2e34c9703bc9464a6e6ebaeb866e09130d01a583b3a13707a21a48efe`.
PERF and DRY_RUN record the current full-set sweep, paired capture modes,
native failure-heavy result/export and deadline partial export.
Before committing, the fresh suite passed all 141 tests in 29 files; typecheck,
lint and the rebuilt 20-finding React IPC replay also passed. The replay
verifies inspector exclusion and retained filter focus; it is not native proof.

## Earlier installed build and evidence

Earlier installed executable SHA-256 (also matched by extracting the NSIS payload):
`103bad66844c684d120d5f5ce354a5f51a2893cd136c9899dcc6b8d66cd927ff`.
NSIS SHA-256:
`0b5efc85a91a9530589a5e0c7fc6997cd6472d1a33ac1a7fdf124ebfc2d3a721`.
This presentation-only correction preserves the benchmarked worker below.
Installed original-byte/decode/intrinsic-size, named image/list,48px keyboard
disclosure and200%/350px reflow passed; current position/crop, dialog Tab
containment and return focus also passed. The earlier5120e88 executable
provided the current-worker60s deadline and original asset/crop core proof.
The earlier read-rejection and main accessibility runs used executable:
`70320694da2e504d9bab0891382b1dee4b488a07a6af5870871d9049ec41b1b3`.
Bundled worker SHA-256:
`309cacb385292865d947134731e0b6c5720caaf608c0a7bd279378cc74c78d81`.

DRY_RUN records the earlier core package, real evidence/review/save/cancel
execution and artifact validation. PERF records the full-object C1-C4 metrics.
KRDS_COMPLIANCE records subsequent installed zoom, native UIAutomation and
state batches, including failed or insufficient captures. The earlier C1-C4
benchmark used worker `90aed157e13c8a3d32cba551a271edb47915f3afdd632ef80ec53768a0889013`;
the current crop/asset worker now passed a fresh full sweep and paired capture
comparison. Raw reports are named
in those records; report replacement does not retroactively change old proof.

## Remaining release checks

Apply remaining strict native UX gates to the integrated candidate. Earlier
accessibility/read/zoom records retain their original package scope. Native
deadline/export and forced long-duration host-guard exhaustion remain separate
from the current worker deadline and cooperative cancellation observations.
No new Product Freeze or whole-product re-audit is a prerequisite for feature
integration.
