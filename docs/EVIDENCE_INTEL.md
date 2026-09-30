# Evidence intelligence (Phases 12–17)

`packages/evidence`: graph, creative fingerprint, extras, OCR/decision/VLM
adapter contracts. Official scoring untouched: extras never enter
`OfficialResult`; similarity alone never creates an official finding.

## Modules

- `graph.ts` — `buildEvidenceGraph` (Page/Frame/Element/Resource/Creative/
  Domain/Redirect/Landing nodes; CONTAINS/LOADS/EMBEDS/DISPLAYS/LINKS_TO/
  REDIRECTS_TO/SIMILAR_TO edges) from crawl snapshots; externals observed,
  never crawled. `summarizeCorrelatedInfrastructure(graph, entryHosts)`
  reports external domains referenced ≥ 2 times with disciplined wording
  ("recurring advertisement infrastructure" — no operator identity).
- `fingerprint.ts` — SHA-256 exact hash + dependency-free 8×8 block-mean
  perceptual hash (16 hex chars) + `hashDistance` + `groupSimilarCreatives`
  (threshold-gated family grouping).
- `extra.ts` — `buildExtraResult`: REUSED_AD_CREATIVE (family ≥ 2),
  AD_INFRASTRUCTURE_CORRELATION (external domain refs ≥ 2),
  ZERO_WIDTH_OBFUSCATION (U+200B–U+200D/U+FEFF in ad text). `technique="ETC"`
  + `extra_finding`, separately validated.
- `adapters.ts` — `OcrBackend` (candidate crops only, CPU contract),
  `RuleDecisionModel` (corroboration threshold, ambiguity-only),
  `DisabledMultimodalFallback` (VLM off by default until benchmarked).

## OCR decision (Phase 14 verdict)

No OCR backend bundled: none of the lightweight CPU Korean-text options is
proven inside this repo yet, and KODEX §27 requires a Korean/CPU benchmark
before adoption. The `OcrBackend` interface freezes the integration seam
(crop → text → semantic evidence) so a benchmarked backend plugs in without
reshaping callers. Shipping an unbenchmarked backend would risk the 30-minute
budget for unproven recall — deferred, not dropped.

## VLM decision (Phase 16 verdict)

Multimodal fallback stays disabled by default (`enabled: false`, refuses
with rationale). Same rationale: unbenchmarked per-candidate latency
threatens the timeout; deterministic evidence already scores 17/17.

## OBSERVED (this machine)

- 8 evidence tests pass: graph vocabulary, disciplined wording, exact +
  perceptual hashing, family grouping, 3-type extra file, rule model
  gating, VLM disabled.
- Entry-host domains excluded from correlation (own site is not "recurring
  infrastructure").
- `typecheck`/`lint` clean; extras validate via `validateExtraResult`.
