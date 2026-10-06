# ADR-0008: Evidence extras without touching official scoring

Status: accepted.

## Context

GOAL Phases 12–17 invite graph correlation, creative fingerprints, OCR,
decision models, and VLM fallback. Each risks official precision (35 pts)
or the 30-minute budget if wired into the official path prematurely.

## Decision

- `packages/evidence` ships graph + fingerprint + 3 proven extra types
  (REUSED_AD_CREATIVE, AD_INFRASTRUCTURE_CORRELATION, ZERO_WIDTH_OBFUSCATION)
  into `result_extra.json` only, validated separately.
- OCR backend: interface frozen, implementation deferred pending a
  Korean-text CPU benchmark (KODEX §27). No unbenchmarked dependency enters
  the submission.
- VLM: `DisabledMultimodalFallback` (off by default) until a benchmark
  proves per-candidate latency fits the budget.
- Decision model: `RuleDecisionModel` corroborates ambiguity only; never the
  sole detector.

## Consequences

- Official E2E stays 15/15 deterministic; extras add steering value without
  scoring risk.
- A future OCR/VLM slice plugs into `OcrBackend`/`MultimodalFallback`
  without contract churn.

## Amendment 2026-10-06: count observed pages

Infrastructure correlation counts distinct pages that reference a domain,
including repeated loads of the exact same asset URL. Counting only unique
resource-to-domain edges missed that case, while counting two resources on one
page overstated recurrence. Graph edge deduplication and summary traversal use
indexed sets so this work stays outside the crawl hot path without quadratic
edge scans.
