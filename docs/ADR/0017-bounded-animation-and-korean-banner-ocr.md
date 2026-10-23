# ADR-0017: Bounded animation capture and offline Korean banner OCR

Status: implemented in source; partial detection improvement, Windows acceptance deferred.
Date: 2026-10-21.

## Problem and evidence

Eight archived Blacktoon screen crops yielded no additional findings. Six-image
OCR selection, eight-candidate capture and a 250 KB page budget also excluded
work. Newtoki's current HTML contains 24 banner buttons, but original media
requests reset; that site has no measured actual-banner after result. See the
dated audit and improvement records in ADOPTION_LEDGER.md.

## Decision

Extend the canonical capture/scheduler/CPU OCR path rather than add a second
scanner or external AI service. Observe button destinations without following
them, select up to 32 candidates/document, retain the existing whole-scan asset
and byte bounds, and admit up to 40 distinct OCR inputs within the deadline.
After immutable official output is committed, optional OCR can use remaining
reserve while retaining two seconds for bounded detail output. Public network,
TLS, redirect scope, cancellation and official result contracts stay enforced.

Decode bounded GIF originals, inspect at most 120 frames within three seconds,
deduplicate coarse signatures and retain up to four high-contrast PNG frames.
Record actual frame indices/times and partial/single-frame analysis. Never claim
every frame was inspected. Deduplicate additional positives by DOM location.

Keep Tesseract for clear text and add pinned PP-OCRv5 mobile Korean OCR for
low-confidence PNGs, using CPU onnxruntime-node. Build inputs have fixed hashes,
sizes, vocabulary and Apache licenses. Scans are offline with respect to AI.
Bound source bytes/pixels, detector dimensions/components/regions, recognition
width and inference time. Axis-aligned boxes are a deliberate initial limit.

Native inference must live in a child process. Independently reproduced Worker
Thread termination during native ORT execution aborted the whole Node process
(exit 134, two trials). Killing an inference child preserved its parent and a
fresh child successfully recognized the next banner (three trials). Deadline
failure resets the child; explicit cancellation closes the backend. Child IPC
contains only candidate bytes/results, and diagnostics never enter official
stdout. Parent disconnect kills the child.

The additional image-only rule v3 recognizes a narrow conjunction of exact
deposit jargon, percentages and an observed external destination. Public
reporting/education examples and generic marked coupons remain excluded. Do not
substitute guessed OCR characters or whitelist the test advertisers. Official
text-policy-2 and four concealment techniques are unchanged.

## Alternatives and limits

Tesseract scaling/segmentation experiments did not recover these eight crops.
Relaxing ambiguous ad keywords falsely accepted a legal game recharge example;
that broad rule was rejected. The current small negative corpus does not prove
a population false-positive rate. Seven real crops still miss.

EmbeddingGemma 2 is a proposed optional similarity/classification layer, not an
implemented OCR replacement. Its official model card describes multimodal
embeddings and default video sampling at one frame/second. Sampling must still
preserve brief text frames. Evaluate on a separate labelled real corpus with
ordinary advertisements before adding runtime cost or claiming recall benefit.
At that implementation checkpoint no weights were installed and no
EmbeddingGemma measurements were made. The subsequent user-requested offline
evaluation is recorded in EMBEDDINGGEMMA2_EVAL_20261021.md: the preregistered
image+OCR comparison recovered 3/8 with 0/17 false positives; a posthoc
composition with existing public-information exclusion recovered 8/8 with
0/17. Those small development-corpus observations do not establish holdout
performance. The model remains outside the default product scan path.

Revisit frame ranking, larger-source handling, rotated OCR and optional learned
similarity after obtaining original animations and a broader independent corpus.
APNG, animated WebP/video, cross-case aggregation and active external discovery
are outside this change. Windows runtime lock/installer/native inference require
new validation later; historical acceptance does not cover these dependencies.

## Verification

`benchmarks/banner-recall.mjs` hashes all eight real screenshot crops and four
synthetic negatives, exercises the canonical scan and three contract validators,
and compares blank-first-frame with a derived GIF containing real banner pixels.
It preserves actual OCR and all result files. Linux fixture sandbox exceptions
are limited to owned loopback content. Refer to ADOPTION_LEDGER.md for measured
counts and command results rather than treating this decision as acceptance.

Sources: [EmbeddingGemma 2 model card](https://huggingface.co/google/embeddinggemma-2),
[RapidOCR pinned upstream](https://github.com/RapidAI/RapidOCR/tree/v3.10.0).


## Follow-up: text helper in canonical scan (2026-10-21)

Supersedes the earlier experiment-only state above. The user authorized the
text-only helper in ordinary inspections. `scanSite` now commits official JSON,
completes bounded OCR, and compares remaining eligible external-linked OCR
against fixed bilingual references with CPU FP32 EmbeddingGemma 2. The pinned
ONNX text conversion has parity with the prior Python checkpoint; image/audio/
video encoders and Python are not product dependencies. Margin0 is a review
candidate threshold, not a confidence probability or legal determination.

`LocalOcrBackend.analyzeText` shares the serial, killable OCR child. Model assets
are pinned SHA-256 build inputs; inspections fetch no models and send no OCR to
an inference service. Lazy model errors are cached as unavailable; deadline and
abort terminate the process and preserve the precommitted official output.
Inputs exceeding4096 characters/256 tokens or containing reserved modality
syntax are unavailable, without changing OCR. All OCR is attempted before the
optional helper to avoid consuming remaining OCR budget on model startup.

The existing public-information exclusion remains a veto. A first unseen-data
comparison exposed two false review candidates: symbol-only OCR and a real
voice-phishing warning. Eligibility now requires a Unicode letter; explicit
voice-phishing prevention campaigns join the public-information veto. This is
a disclosed posthoc correction. Original evaluated inputs become regression
inputs, and separately frozen text-heavy normal sales ads remain a distinct
check. Prompts/model/margin and advertiser allowlists were not fitted to labels.

Only `image-only-ad-v4-text-review` adds helper-derived extra candidates; raw
OCR and literal matchedTerms remain intact, possibly with no literal matches.
Optional detail metadata records similarities, margin, model revision, elapsed
and unavailable reasons. TS and Rust validate the joined external destination,
OCR, helper, categorical decision and absence of equivalent visible DOM.
The UI and workbook call these review candidates. Official four concealment
techniques/result.json, cross-case scope and ordinary direct networking remain
unchanged. Windows lock generation, packaging and native inference are deferred.
The roughly1.12GB text assets and CPU budget need Windows measurement later;
quantization is a separate numerical change requiring renewed parity/quality
measurement. See TEXT_EMBEDDING_INTEGRATION_20261021.md for observed results.

## Follow-up: complementary small-raster OCR and temporal GIF coverage

The user requested root-cause correction for the remaining five MT crops and
controlled comparison with new real banners and normal ads. Trace evidence
showed fragmented/missing text regions when147x40 was enlarged to2432x672.
Replacing the primary with a4x detector, grayscale contrast or band recognition
caused regressions on development inputs. Those replacements were rejected.

Keep primary OCR and its existing positive decisions. After primary work,
only unresolved external-linked PNGs with height<=96 and aspect>=3 receive a
second independently bounded recognition with the same sessions/weights and
maximum detector enlargement4x. Apply the same public-information veto and
fixed semantic/helper decision to each actual transcription; never concatenate
or repair characters. Store selected OCR and at most one unused bounded result
in `ocrAlternatives`. UI/report explain that the displayed helper score belongs
to the selected text. Failure/oversize/deadline preserves the first result.
Public instructions, official output and transport scope remain unchanged.
Recompute cancellation after the last child close, including post-crawl aborts.

Two owned GIF controls distinguished selection loss from OCR loss: an8x8
signature erased readable brief gray text, and global contrast top-four retained
decorations instead of late text. Use128x32 signature/salience and one best per
four index bins across the inspected range. Keep existing creative hash, caps
and CPU/byte budgets. Mark partial when distinct content was decoded but not
retained. This still misses text competing with decoration in the same bin;
no full animation recall guarantee is supported.

Three paired canonical comparisons recovered MT5->7/10, Blacktoon16->18/18,
new images6->9/9. New9 share three screenshot clusters, including5 from the
previous MT source. Existing normal14 remainedFP0; fresh normal10 remainedFP2,
both pre-existing text-helper education-ad errors. No threshold/prompts were
fitted to this new corpus. Three MT misses remain. No served animated illegal
or normal original GIF could be obtained; portfolio media and derived positive/
normal timing controls are reported separately. See
OCR_GIF_IMPROVEMENT_20261021.md for raw provenance, ranges and validation.

## Follow-up: education contrast and rejected low-resolution corrections

The subsequent request targets three remaining MT misses and two real education
ad false positives. The latter already contain exam/course context in observed
OCR, but the fixed comparison bank contains retail/game/public/library examples
and no course/refund/textbook class. Keep model, positive8, originalnegative8,
classification prefix, FP32 and zero margin; add three normal education
references as `text-ad-embedding-v2`. Accept stored v1 and new v2 evidence in
both TS and Rust. Do not add keyword/advertiser exclusions or cancel direct
literal positives. The previous two false positives are development/regression
inputs; freeze new real sources before inference. Numerical/reference changes
are not a calibrated probability or legal classification.

Rejected: one broad Korean tuition-refund description suppresses six known
positive OCR transcripts. A first-recharge positive description reintroduces a
TOEIC false positive. Neither is adopted. The selected three negative references
preserve all known positive primary/alternative helper decisions in development.

Causal OCR probes recover Woojoo's actual first-recharge glyph by shrinking
recognition-crop vertical padding (same detector component and weights). This
alone still fails the fixed semantic comparison. Applying the crop change to
17 known ads destroys relevant offer/category wording elsewhere, so retain the
canonical OCR geometry and its bounds. WINNER's logo remains undetected and
MACHUJA's low-resolution offer remains corrupted. Do not force CTC alternatives,
repair text manually, whitelist brands, lower thresholds or call diagnostic glyph
recovery a recalled advertisement. Revisit with original higher-resolution
assets or independently validated recognition changes and full positive/normal
regressions. The evidence does not prove that recovery is impossible for every
OCR system.

See OCR_SEMANTIC_REFINEMENT_20261021.md and its artifact directory for exact
ablation inputs, crop/CTC traces, frozen new-source limitations and final paired
measurements. Existing GIF selection and public-information exclusions remain
unchanged. Windows validation remains explicitly deferred.


## Follow-up: verify missing context and reject degraded OCR promotion

The exam-fee advertisement has Tesseract mean confidence0.76 despite omitting
토익. The already installed PP-OCRv5 correctly restores that word and the fixed
v2 helper rejects the normal ad. After all primary OCR, verify semantic-only
Tesseract PNG positives with that existing recognizer. Do not compare confidence
numbers across OCR models. Literal-rule positives remain unchanged. Informative
successful verification selects one actual transcript with its own decision;
retain the unused transcript. Failed OCR, empty/non-letter verification or an
unavailable helper preserves the original positive. Public-information and
visible-DOM exclusions still use the existing predicates.

Samsung's reduced phone advertisement instead has PP default confidence0.771
and negative margin, then shorter 4x text at0.631 with a positive margin.
Do not promote an embedding-only positive when the same recognizer's alternative
is both lower-confidence and shorter in Unicode letters. Neither signal alone
vetoes an alternative, and actual literal advertising proof remains eligible.
This relative support check uses no advertiser allowlist or new global threshold.
It does not assert that confidence measures OCR correctness.

EasyOCR Korean G1/G2 and Korean TrOCR were tested as genuinely distinct engines.
EasyOCR did not restore usable semantics for the three remaining147x40 misses.
Automatic-region TrOCR plus the unchanged helper produces3/10 false positives
on known normal inputs (six are old retail reductions), while its three positive
scores include unsupported gibberish. Do not ship/export that transformer solely
to increase labelled recall. Whole-image blank hallucinations and line-confidence
miscalibration require a better grounding/abstention policy before reconsidering.
PP-OCRv6 medium's inspected vocabulary contains no Hangul syllables; its weights
were not downloaded. No new model, Python production runtime or dependency was
added. Original-resolution sources and independently validated recognition remain
open follow-up work; three known misses are not declared solved.

See OCR_ENGINE_COMPARISON_20261021.md and the frozen/amended protocol, exact
raw transcripts, source hashes and paired receipts for quality and timing.


## Follow-up: separate pixel-assisted review for unresolved small banners

Keep the observed category when verification loses its sole category without
introducing a public/DOM exclusion. Additional OCR probes did not ground the
three remaining small-banner transcripts; do not replace them with guessed text.

Add `image-only-ad-v5-image-review` after primary OCR and text analysis for
unresolved external-linked PNG height<=96/aspect>=3. Reuse the pinned FP32
backbone andmatching vision encoder. Require realmargin>=0 andseed1701 shuffled
pixelmargin<0. Preserve raw selected/unused OCR andSHA-bound image evidence.
Any public/visible-DOM exclusion in either actual reading vetoes this path.
At least one actual OCR reading must contain numeric context: unsupported
brand-only readings cannot be promoted through the image path after text abstains.
This is image-assisted human review, not transcription or legal proof.

The first fresh normal examples exposed coupon corruption anditem-code confusion;
subsequent tiny normal controls exposed an enrollment brand. Textv3 retains8positive
references andmargin0, adding one ordinary cosmetic-item-code reference (20total).
Prize-only without actual category/deposit context andunsupported singleword
readings abstain. Generic signup substrings inside corruptedcoupon words are
insufficient. Imagev2 adds2Korean education/item normalreferences only for image
comparison. Singleword text abstention alone still rerouted the logo into image
review; numeric context admission is necessary. No advertiser exceptions or
concatenated/transcribed words were introduced. Prior v1/v2 saved scores remain valid.

Reject broad image enablement, image-only input replacement, andnormal reference
changes that lose established positives. Earlier token/resize/alpha contract-invalid
experiments remain excluded. Final3misses are recovered while measured normal
precision is retained, butnew6positive remains4/6 andderivedGIF2/3. New-source
examples used for corrections are development data; finaluntouchednormal2is tiny
anddidnotinvokevision. This does not establish fieldFPR or all-banner recall.

Twoimageforwards have16s perpair; text/OCR8s andglobaldeadline stay unchanged.
Additional immutable modeldata is671MB. Final MT10whole-scan N5median7.506->23.051s;
newpositive6takes5.501->16.176s withoutadditionalrecall. Accept this cost only for
bounded human-review behavior, not as a speedup orWindows readiness claim.
Authorized NAS stores development models/receipts; source remains canonical.
See OCR_GROUNDING_20261021.md andits frozen inputs,76receipts andaudit.

## Follow-up: representative image references and brief-frame diversity

The two remaining native136px banners contained4–8px Korean glyphs. Identical
PPv4/v5 regions and fixed interpolation/contrast probes did not recover a
reliable transcript. Keep both actual OCR readings, and compare image-only
queries with frozen actual-image exemplars from the same pinned checkpoint.
The v3 reference asset has15 positive images from two old source cohorts,
11 normal variants, and26 fixed pixel-shuffle negatives. The current two targets
and the previous three image-review targets are excluded from the reference
set. This is supervised exemplar selection from development data, not new
independent test evidence or model-weight fine-tuning.

Keep cosine margin0, decision3/3, original-positive AND shuffled-negative,
SHA binding, public-information veto, observed external destination, serial
killable child, and existing model/whole-scan bounds. The v3 model input excludes
OCR conditioning; actual OCR still governs admission and stays available to
reviewers. TS/Rust accept historical v1/v2 records as well as v3. UI/workbook
identify image review and policy without presenting similarity as transcription.
No new runtime/model dependency or remote inference is introduced.

Canonical validation exposed additional normal failures during development.
Explicit readable course-sale or mobile-device purchase/coupon context must
not be overridden by image style unless actual gambling/deposit context is
present. A generic headline without observed number/ad expression/offer/jargon
abstains from text review; an isolated integer is insufficient image admission.
Numeric offer structure must occur within one actual transcript, not a union
of alternatives. A helper's abstention is distinct from a public/ordinary/DOM
exclusion: a weaker verification reading cannot erase an earlier observed
category merely because it lacks eligibility for another model call.

The GIF omission originated before OCR: a stripe frame won the same temporal
bucket by edge sum. Replace temporal winners with a bounded streaming diversity
reservoir. Each newly observed frame competes in a pool of at most5, retaining
4 by minimum spatial-luma distance, then total distance, then edge detail.
This is a greedy bounded selection, not a guarantee of global optimum or all
animation content. Uniform flashes cannot displace useful frames. Encode only
accepted new candidates and retain prior frames if encoding fails. Keep120
inspections/3seconds/4 retained frames and honest partial coverage. Original
indices/timestamps and creative SHA remain recorded.

Development reference/normal failures, category-loss regression, and rejected
candidates remain in artifacts/ocr-lowres-gif-20261021/diagnosis and candidate
receipts. The initial new11 actual images became development/regression after
normal-derived failures; additional3 actual normal campaigns were not fitted.
Source-backed originals, reductions, headings and derived GIF phase controls
have separate denominators. New illegal-advertiser-original GIFs and current
blocked-site discovery remain unverified; Windows/packaging/active exploration
stay deferred. See OCR_LOWRES_GIF_20261021.md for final measured acceptance and
revisit this policy on independent new-source failures rather than loosening
thresholds or adding advertiser exceptions.


### 2026-10-22 Fixed text reference preparation

Precompute the same20text references with the canonical FP32 CPU encoder and unchanged
four-prompt batches. Bind their exact ordered prompts, policy and model manifest hashes,
vector payload hash, normalized768-dimensional values at build and runtime. A stale or
corrupt file fails the optional helper without suppressing OCR/official output. Regeneration
is explicit through `npm run prepare:embedding-references`, never a scan-time download or
fallback inference. Query inference, thresholds, text/image policy versions and cancellation
boundaries are unchanged. All190regression-input verdicts and1044observed score components
match baseline(max absolute delta0); numerical tolerance fixed at1e-5. See
[measurement report](../EMBEDDING_PRECOMPUTE_20261022.md) for paired N5 latency/memory,
shared-host noise and retained derived-control miss. Quantization and Windows remain deferred.

### 2026-10-22 Selective vision weight quantization

Keep the FP32 text backbone and adopt the same checkpoint's8-bit weight-only vision graph
(MatMulNBits bits8/block32; float32 graph inputs/outputs). Full text+vision INT8 changed a
near-zero BC.GAME text margin from+0.000615 to−0.000077, switching the selected actual OCR
and adding5.49s image fallback. It was rejected despite preserving the final positive count.
Do not compensate by lowering the threshold or adding an advertiser exception.

Recompute only the same fixed vectors with model-matched encoders. Text20vectors are
component-identical; image52reference cosine minimum0.995148. Bind image content/model
hashes at preparation/build/first use, preserve all caps and exclusions, and record
`embeddinggemma-2-image-text-f32-vision-int8` for v3 evidence. Historical FP32 records remain
readable; quantized IDs cannot claim historical v1/v2 policies.

All190regression verdicts/OCR/frames remained unchanged, actual60/60+normalFP0/74;
derived17/18+FP0/38 preserve the existing extreme-reduction miss. Paired alternatingN5
low-resolution6 whole-scan medians15.901→15.933s show no speed improvement; OCR child
VmHWM2181.1→1778.5MiB reduces memory. Six pinned model/tokenizer files shrink26.6%.
One captured PNG container differed; reproducing its exact SHA proved identical decoded
RGBA and both actual/shuffled model input tensors. Raw receipts were not rewritten.
See [quantization report](../EMBEDDING_QUANTIZATION_20261022.md) for gates, dispersion,
rejected candidate, capture proof and generalization limits. Revisit text quantization on
new kernels/layer choices only with the same strict decision-path checks and independent
new-source evidence. Windows remains deferred to the user's next-day validation.


### 2026-10-22 Bounded vision CPU concurrency

The adopted FP32-text/8-bit-weight vision baseline spent9.754s of16.058s on
four vision forwards, using19.515worker CPU seconds; preprocessing was0.090s.
Preserve all2520x768 input values and actual/shuffle controls and change only
the runtime vision intra-op pool. Two controlled N5 series compared2/4/6/8
and8/12/16 threads. Eight was fastest on this16-logical-CPU host;12/16 were
slower in every paired comparison. Cap at min(8, node:os availableParallelism),
keep inter-op1, text2/1, build-only reference generation2/1 and all OCR pools.
Do not expose another ordinary-user setting or use the global ORT auto pool.

Canonical pairedN5 low-resolution6-banner completion median15.935→10.388s,
with every pair5.496–5.670s shorter. Vision diagnostic4forwards9.754→4.168s;
CPU19.515→33.303s is the explicit resource tradeoff. WorkerHWM1778.4→1776.8MiB
is comparable, not a memory saving claim. All190regression inputs, selected
and unused OCR, frames/times/provenance/decision paths and1044score component
comparisons match baseline exactly. Keep the existing derived BUTTER miss,
ANIMATION_PARTIAL scope and all exclusions/thresholds/budgets/references/assets.
The warmed image worker is also tested through deadline→normal-ad recovery
and cancellation→closed state. No model ID, policy, dtype or data calibration changes.

This is best among tested configurations on this host, not a universal optimum.
Revisit on different hardware, competing model workloads or Windows measurement;
low-core latency, cold installation and Windows are unverified. See
[latency report](../IMAGE_LATENCY_OPTIMIZATION_20261022.md) and raw protocols/receipts
for excluded setup round4, retained interruption/partial receipt and N5 dispersion.


### 2026-10-22 Preserve OCR while removing duplicate CPU work

Fuse value validation into detector mask/CTC consumption without removing any
non-winning/blank probability checks, NaN/Inf/range guards, CTC ties/repeats,
confidence cutoff or accumulation order. Reuse exact Float64 horizontal resize
coordinates across rows and dispose every inference input/output in finally.
Preserve all model bytes, scales, frames, admission predicates and serial worker
limits.308whole/offset-crop input tensors and73canonical recognition inputs match
byte/hash/order; all190regression verdicts/transcripts/confidences/frame provenance
and1200observed embedding score components match baseline exactly.

Controlled cap8 canonical N5 low-resolution6scan10.359→10.099s, GNUtime
process-tree CPU42.60→42.24s, workerHWM1774.4→1728.1MiB. CPU gain is modest;
vision still dominates. A separate12-request OCR arena probe saved0.39CPU seconds
but added214MiB; recognizer-only did not demonstrate CPU/latency benefit and
added52MiB. Reject both and keep arenas OFF rather than add a cache for the
73inputs with no repeated content. No new backend or dependency.

See [CPU report](../OCR_CPU_OPTIMIZATION_20261022.md) for N5 spread, exact CPU
measurement scope, original/derived denominators, retained BUTTER control miss,
and a non-reproduced coverage observation count transient. Do not change capture
or GIF limits to obtain a better speed/CPU result. Windows stays deferred.

### 2026-10-22 vision CPU와 지연의 절충

비전 input의 실제 패치·리사이즈·셔플은 유지하고 trailing zero/-1 padding만 제외한다.
동적 패치 축에 softTokens*9 valid prefix를 전달하며 기존 offline 참조 생성/고정 벡터는 유지한다.
선택N5의 cap8compact/cap6compact/cap5compact에서 CPU40.40/35.48/32.92s,
wall9.955/10.480/10.962s였다. CPU 우선 요구와 대기 비용을 함께 반영해 runtime cap6 채택.
Native 스핀/블록/auto 후보는 측정한 CPU/지연에서 우월성을 입증하지 못해 추가하지 않는다.
이전 Node extra 미지원 가정은 1.30.0 native source/binary 검증으로 정정한다.
최종 새98scan/190입력에서는 저해상도6배너CPU−16.65%,wall+3.18%; 원문/프레임/판정/점수 보존.
Windows/다른CPU에서 이 대기비용이 수용되지 않거나 지연우선 요구가 생기면 cap8compact를
같은 raw입력·N5·CPU/메모리 기준으로 재검토한다. 임계값/해상도/GIF수를 낮추는 대신은 아니다.
[실행 증거와 제한](../VISION_CPU_OPTIMIZATION_20261022.md).
