# Product V2 acceptance audit

Date: 2026-10-06. Overall status: OPEN.

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

## Current installed build and evidence

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

## Remaining acceptance checks

1. Verify the selection correction in the installed Windows app: list/page
   current state, filter exclusion closure, retained context and focus. Apply
   remaining strict UX gates after the core work, per the user's priority.
2. Finish the combined original-steering/A-M completion audit against actual
   source and scoped runtime records. Earlier accessibility/read/zoom records
   retain their original package scope. Normal Windows deadline settlement
   does not prove forced long-duration host-guard exhaustion.
