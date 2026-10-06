# Evidence intelligence (Phases 12–17)

`packages/evidence`: graph, creative fingerprint, extras, OCR/decision/VLM
offline CPU OCR and structured decision rules. Official scoring untouched: extras never enter
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

## Connected image OCR

`scanSite` collects observed ad-marked/external-link image response bytes while
the page is live. At most six distinct image hashes per scan enter one serial
`LocalOcrBackend`; each initialization/recognition shares the remaining scan
budget (maximum eight seconds including queue time). Images are capped at
250 KB and four million pixels. Identical hashes reuse recognition. The CPU
worker uses pinned Tesseract.js 7 WASM with local Korean/English traineddata;
no network request or GPU is required at runtime. Cancellation/deadline
terminates the worker and records unavailable/budget, never fabricated text.

Recognized text, normalized match form, matched terms and `RuleDecisionModel`
verdict are stored in session-local `imageAnalysis`. HostBridge detail reads
show these in the additional-analysis area even when no recurring-creative
finding exists. OCR is auxiliary and never replaces official source text.
Rules are deterministic corroboration; they are not a learned classifier.

OBSERVED on AMD Ryzen 7 9700X/Linux: the 800×150 Korean fixture
`fixtures/ocr/banner.png` yielded `카지노 가입 보너스 지급` at confidence 0.96.
The first offline worker test completed in 526 ms including startup; the
live-page image-to-manifest scan test completed in 1.35 s. These are narrow
fixture observations, not a representative Korean accuracy/throughput study.
Active startup cancellation also settles and closes the worker. The real
manifest was displayed in Chromium results with search/filter context and
validated save controls. Windows/candidate release checks retain their own
scope; do not infer broad OCR accuracy from this fixture.

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
