# ADR-0004: Static-first synthetic evaluator, browser execution later

Status: accepted.

## Context

Detector tuning needs ground truth before the Playwright crawler exists
(Phase 3). A static harness risks overfitting to string matching; a full
browser harness blocks Phase 2 on crawler work.

## Decision

Phase 2 ships deterministic HTML fixtures + machine-readable ground truth +
a static two-axis baseline (vocabulary gate + technique signals) with
explicit non-claims (no cascade/layout/script, fixture-modelled dynamics).
Phase 3 replaces the static model with real Playwright execution while
keeping the same ground truth + metric interface (`TP/FP/FN/precision/
recall/elapsed`).

## Consequences

- Fixture contract frozen: 22 cases, 15 pairs; edits require ground-truth
  + test + doc updates together.
- Baseline 15/0/0 proves fixture self-consistency, not detector quality.
- Jamo fixtures cover both Compatibility (U+3131–U+3163) and Conjoining
  (U+1100–U+11FF) blocks; real detectors must handle both.
