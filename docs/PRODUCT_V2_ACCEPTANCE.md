# Product V2 acceptance audit

Date: 2026-10-06. Overall status: OPEN.

This audit preserves the expanded A-M scope. Core acceptance precedes strict
UX checks per the user's ordering. A passing slice does not close the release.
Earlier build observations retain their original environment and scope.

| Requirement | Concrete acceptance evidence | Current assessment |
| --- | --- | --- |
| A: bounded concurrency | CPU policy 2/3/4; reject >4; real overlapping page callbacks at C1-C4 | OBSERVED in worker-pool tests and Windows benchmark; see TEST_STRATEGY_V2 and PERF. |
| B: single pass | Each admitted URL requested once at C1/C4, including capped admission; live detection in that page | OBSERVED in single-pass served request-log tests. |
| C: live frames | Cross-origin and nested frames requested once per live instance; absolute full `>>>` chain; depth bound | OBSERVED in cross-origin-frame tests and the Windows shared-frame finding. |
| D: deterministic identity | Compare complete official objects, full URL/frame chain, order and IDs after canonical aggregation | OBSERVED in the repeated full-object Windows 200-page C1-C4 run. |
| E: correctness benchmark | Wall time, throughput, memory, CPU, coverage, TP/FP/FN, complete official set and validators at C1-C4 | MEASURED: 200 checked, one intended failure, TP21/FP0/FN0 at all four levels; PERF records exact metrics and limits. |
| F: one deadline | Shared monotonic worker deadline, admission/finalization reserve, bounded operations and optional capture; host process guard | OBSERVED short-budget scanner tests and installed Windows 60-second partial scan/export: 54.127s wall, 62 checked, 5 findings, timedOut=true, validated export identical to persisted result. Configured1500/internal cap1650/ceiling1800 implementation recorded in ADR-0011. Forced long-duration host guard exhaustion was NOT_RUN; this observation exercises normal deadline settlement. |
| G: Adaptive style | Explicit track and official normative references, documented deviations | INFERRED from ADR-0012 and KRDS_COMPLIANCE implementation mapping; this alone does not close visual/interaction gates. |
| H: token hierarchy | Primitive to semantic to component, custom role/purpose/consumers/deviation record | INFERRED from styles.css and KRDS_COMPLIANCE token tables; computed style/reflow observations are separately recorded. |
| I: pattern mapping | Every named interaction maps to the official component/basic/service pattern | Documented in KRDS_COMPLIANCE; per-interaction verification remains scoped in that table. |
| J: results behavior | Count, categories, one search, immediate filter count, no-match recovery and retained context | OBSERVED in actual installed 21-finding review plus native no-match/reset and zero-result runs. |
| K: state coverage | Initial/loading/running/partial/success/empty/no-match/error/unavailable/disabled/cancel/confirmation/save success/failure | OBSERVED across native runs and React/browser state checks; native narrow zoom batches cover extra, no-match, save error/retry and empty. Native result-read rejection and all transient disabled states are not established by these batches. |
| L: strict UX release gate | Keyboard-only workflow, focus/return, 360 reflow/200% zoom, non-color state, dialogs, live status, Korean copy and target sizes | OPEN: native narrow zoom, confirmation focus cycle and actual Korean UIAutomation live events passed. The complete native keyboard-only workflow subsequently passed; remaining scoped accessibility and state checks still require evidence. No spoken-output claim from this audio-less VM. |
| M: combined definition of done | Product workflow/evidence/review/export plus scanner deadline/single-pass/concurrency/determinism/realistic Windows acceptance | OPEN while any applicable release gate lacks evidence; do not infer completion from core benchmark success. |

## Current installed build and evidence

Installed executable SHA-256:
`70320694da2e504d9bab0891382b1dee4b488a07a6af5870871d9049ec41b1b3`.
Bundled worker SHA-256:
`90aed157e13c8a3d32cba551a271edb47915f3afdd632ef80ec53768a0889013`.

DRY_RUN records the earlier core package, real evidence/review/save/cancel
execution and artifact validation. PERF records the full-object C1-C4 metrics.
KRDS_COMPLIANCE records subsequent installed zoom, native UIAutomation and
state batches, including failed or insufficient captures. The worker remained
unchanged through the UI-only release slices. Raw temporary reports are named
in those records; report replacement does not retroactively change old proof.

## Next acceptance checks

1. OBSERVED: installed keyboard-only scope, scan, filter/search, finding
   review/return, page navigation, confirmation and restart passed. See
   KRDS_COMPLIANCE for input method, report and distinction from file writing.
2. Resolve the scoped native read-failure/disabled-state and accessible-stage
   evidence gaps without fabricating host responses.
3. Reconcile remaining release rows with their actual evidence. The normal
   Windows deadline/partial export path passed; do not describe that execution
   as forced host-guard exhaustion.
