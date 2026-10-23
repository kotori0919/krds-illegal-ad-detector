# Evidence intelligence (Phases 12–17)

`packages/evidence`: graph, creative fingerprint, extras, OCR/decision/VLM
offline CPU OCR and structured decision rules. Official scoring untouched: extras never enter
`OfficialResult`; similarity alone never creates an official finding.

## Modules

- `graph.ts` — `buildEvidenceGraph` (Page/Frame/Element/Resource/Creative/
  Domain/Redirect/Landing nodes; CONTAINS/LOADS/EMBEDS/DISPLAYS/LINKS_TO/
  REDIRECTS_TO/SIMILAR_TO edges) from crawl snapshots plus exact advertisement
  witnesses; externals observed, never crawled. Ordinary CDN, analytics,
  font and framework observations remain separate from advertisement-related
  edges. `summarizeInfrastructure(graph, entryHosts)` returns related domains,
  distinct observed page URLs and evidence kinds, including one-page relations.
  `summarizeCorrelatedInfrastructure` emits repetition findings only for exact
  advertisement witnesses on at least two distinct pages. Neither summary
  attributes ownership or operator identity.
- `fingerprint.ts` — SHA-256 exact hash + dependency-free 8×8 block-mean
  perceptual hash (16 hex chars) + `hashDistance` + `groupSimilarCreatives`
  (threshold-gated family grouping).
- `extra.ts` — `buildExtraResult`: REUSED_AD_CREATIVE (family ≥ 2),
  AD_INFRASTRUCTURE_CORRELATION (advertisement-correlated domain on ≥ 2 pages),
  IMAGE_ONLY_ILLEGAL_AD (OCR and illegal-ad semantics plus corroboration,
  excluding equivalent visible DOM advertisement text),
  ZERO_WIDTH_OBFUSCATION (U+200B–U+200D/U+FEFF in ad text). `technique="ETC"`
  + `extra_finding`, separately validated.
- `adapters.ts` — `OcrBackend` (candidate crops only, CPU contract),
  `RuleDecisionModel` (corroboration threshold, ambiguity-only),
  `DisabledMultimodalFallback` (VLM off by default until benchmarked).

## Bounded graph reads

The optional session-local `evidenceGraph` and `infrastructure` records persist
observations separately from official output. Metadata summaries contain no
image bytes. Relationship exploration uses `sliceEvidenceGraph(graph, query)`
only when requested. Defaults are 100 nodes, 200 edges and depth 2; hard limits
are 250 nodes, 500 edges and depth 2. Invalid, fractional or excessive limits
are rejected. Zero edges and depth zero are valid; at least one node is required.

Focus accepts a node ID or a finding ID, page URL, creative SHA, or domain host
with the corresponding `finding`, `page`, `creative`, or `domain` kind. An
unknown focus returns an empty slice. Traversal follows incoming and outgoing
relations around the focus; without a focus only advertisement-related
nodes/edges are selected. Slice order is deterministic, every returned edge
has both endpoints in the slice, and `truncated` reports node/edge budget
truncation. Older records without a graph retain empty relationship reads.

Infrastructure counts use the exact element-to-resource or destination
relation. A shared creative does not transfer its other resource domains to
pages where those resources were never witnessed.

## Connected image OCR

`scanSite` collects ad-marked/external-link visual candidates while the page
is live: IMG, computed CSS background, SVG and canvas. Captured declared
original raster bytes are reused; otherwise only selected bounded elements
are rasterized after immutable official captures. At most six distinct image
hashes per scan enter one serial
`LocalOcrBackend`; each initialization/recognition shares the remaining scan
budget (maximum eight seconds including queue time). Images are capped at
250 KB and four million pixels. Identical hashes reuse recognition. The CPU
worker uses pinned Tesseract.js 7 WASM with local Korean/English traineddata;
no network request or GPU is required at runtime. Cancellation/deadline
terminates the worker and records unavailable/budget, never fabricated text.

Recognized text, normalized match form, matched terms and the deterministic
image-only verdict are stored in session-local `imageAnalysis`. A positive
ExtraFinding joins the exact frame URL, selector and OCR text. Independent
ad marker, suspicious destination or repeated advertisement creative evidence
must corroborate semantics; equivalent visible DOM text suppresses image-only
classification. Lazy metadata and selected opaque asset reads show these in
the additional-analysis area, with technical scores/backend/rule in disclosure.
OCR never replaces official source text. Optional classifier/graph failures
are disclosed by `analysisIssues` and do not discard valid official findings.

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
with rationale). No difficult-case accuracy benefit, usable CPU latency or
acceptable package cost has been demonstrated. The deterministic visual path
now supplies image-only evidence, but its fixture results do not establish
whether a learned model would improve classification.

## OBSERVED (this machine)

- Scoped graph/extra regressions pass: observed-only CDN exclusion, exact
  advertisement witnesses and page attribution, bounded deterministic slices,
  image-only extra deduplication, graph vocabulary, creative hashing/grouping,
  zero-width text, corroboration and disabled VLM behavior.
- A reproduced 32-bit resource ID collision no longer merges unrelated URLs:
  exact-key buckets retain both resources and deterministic reversed-input
  slices, without transferring unrelated page attribution.
- Entry-host domains excluded from correlation (own site is not "recurring
  infrastructure").
- Scoped graph/extra lint is clean; extras validate via `validateExtraResult`.
