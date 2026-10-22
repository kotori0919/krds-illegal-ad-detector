# Detection (Contract v0 frozen 2026-10-01)

Two-axis decision, frozen:

```text
TechniqueEvidence + IllegalAdEvidence → CandidateEvidence → DecisionEvidence → OfficialFinding
```

An official finding exists only when required evidence supports **both**
axes. Concealment alone never proves an illegal ad. `evidence_text` preserves
the original pre-normalization source text; normalized/OCR/model-derived
forms live in `normalizedText` / internal evidence only.

## 1. Pipeline order (cheap → expensive)

URL/domain → DOM extraction → Unicode analysis → computed CSS → geometry →
frame analysis → network/resource evidence → image fingerprint → gated
candidate OCR → structured decision → optional gated VLM.

OCR/VLM run on gated candidates only, never whole-page default. Official
operation is offline, no GPU, no external AI service (KODEX §28).

### Image-only additional analysis

`IMAGE_ONLY_ILLEGAL_AD` belongs to `result_extra.json`; it never adds an
official concealment technique or changes the original `result.json` contract.
The `image-only-ad-v3` decision requires OCR ad semantics, independent candidate
corroboration, and no equivalent visible DOM ad text. An unmarked image can
use its observed external HTTP(S) click destination as corroboration only
when OCR contains both a supported gambling/loan/cash category and explicit
solicitation or promotional terms (including high-stakes-only recruitment).
An opaque advertiser domain or numeric image filename need not match a keyword.
The destination is observed, not visited. External links alone, category logos,
public-information images and ordinary product offers remain insufficient.

The v3 rule also accepts a narrow observed deposit offer: percentage values,
two distinct terms among 콤프/롤링/페이백/첫충 (excluding 첫충전), at least one
of 콤프/롤링, an 입금/첫충 signal, and an observed external HTTP(S) destination.
Public reporting/education context is excluded, including quoted offer examples.
An ad marker does not make generic coupons, free trials, game currency or a
category logo sufficient. The three-axis threshold remains 3/3; the official
text policy and four concealment techniques are unchanged.

### Bounded banner OCR and animation (2026-10-21 source)

Capture selects at most 32 candidates/document and 1,000,000 encoded bytes/page,
with a separate 250,000-byte bound per source/decoded PNG. It observes bounded
button `data-banner-href`/`data-href` destinations without clicking them. Retained
assets remain capped at 40/2,000,000 bytes; up to 40 distinct images enter serial
OCR within the existing scan deadline. Raising the cap does not promise that
40 images finish. Selection and skipped work are recorded in visual coverage.

GIF sources use browser ImageDecoder with a 120-frame/three-second bound;
8x8 fingerprints remove repeated frames and edge contrast ranks up to four PNG
frames. Frame index/timestamp accompany OCR evidence. Partial decoding and
single-frame fallback are recorded. This does not cover all GIF frames, large
excluded sources, APNG, animated WebP or video. Different positive frames at one
DOM location produce one additional finding rather than inflating ad counts.

Tesseract Korean/English sparse OCR runs first. Low-confidence PNGs use pinned
PP-OCRv5 mobile detection and Korean recognition on CPU via onnxruntime-node.
Build-time assets have SHA-256/size checks and licenses; scanning downloads no
models and sends no image to an AI service. Recognition is bounded and serial.
The local implementation uses axis-aligned detector boxes; it does not claim
parity with RapidOCR's rotated OpenCV pipeline. A child process owns native
inference so a deadline can kill it without tearing down native code inside the
scanner's JS worker thread. Failed candidates can restart OCR for later images;
explicit cancellation closes the engine.

Observed offline corpus: eight archived Blacktoon screen crops improved from
zero passing banners to one. Seven remain misses. Four synthetic negatives and
one existing illustration produced zero findings. A derived white/real-banner/
white GIF improved from zero for its blank first frame to one with multi-frame
capture. These are bounded regression inputs, not live-site recall or a measured
population false-positive rate. Run `npm run benchmark:banner-recall` after build;
the Linux sandbox exception is allowed only for the owned loopback fixture.
See ADR-0017 and ADOPTION_LEDGER.md for evidence and remaining limits.

### Source text ownership

DOM extraction traverses ordinary text nodes, including elements without IDs.
Script, style, noscript, template, and head text are excluded. Each text node
belongs to its nearest semantic text block, link, control, or rendered block.
Inline fragments compose at that owner, so a link containing separate `카` and
`지노 신규가입` spans is evaluated as one phrase. A wrapper around one complete
text leaf collapses to that leaf when their source text is identical; links
and controls retain their semantic ownership. Containers without owned text
emit no candidate, and each owner emits at most one finding per technique.

Independent child blocks own their own text. When direct parent text coexists
with a child block, only the parent's owned text enters its semantic and Unicode
decision, preventing a child's phrase from generating duplicate parent findings.
Official source evidence remains the owner's exact, untrimmed `textContent`,
including whitespace; normalized or reconstructed decision text stays separate.

CSS and geometry are inspected on the owner and its text-bearing inline
descendants. A descendant concealment signal uses the composed owner phrase,
keeps the owner's finding selector, and records the responsible descendant as
`evidenceSelector` / `observed.selector` with that descendant's computed CSS and
box. Selector uniqueness and identity are validated in the actual document by
the canonical scanner selector engine. Frame locations retain the contract's
`>>>` serialization.

`onAdText` reports each semantic-passing source owner once before the official
technique gate, including visible owners with no official technique signal.
For additional zero-width analysis only, the callback's semantic check removes
U+200B–U+200D and U+FEFF from its match form. Its evidence still preserves the
exact original source, and public-information text without an offer remains
excluded. This supplies additional analysis independently of official findings;
the four official technique decisions use their existing semantic gate.

## 2. Semantic gate (axis B: illegal-ad?)

Inputs: raw text, normalized Unicode, OCR text, destination URL, ad
vocabulary, illegal-content vocabulary, structured rules, optional lightweight
model evidence. Output: `IllegalAdEvidence { rawText, normalizedText?,
matchedTerms[], destinationUrl?, detail }`.

Current policy: `text-policy-2`. Historical results keep their original
engine/policy provenance and are never rewritten to match these decisions.
Rules:

- A strong ad/illegal category, a generic term supported by concrete offer
  intent, **or** a suspicious ad destination (`destinationUrl`) is required.
  Generic `보장`, `당일`, `고액`, `보너스`, `쿠폰`, `무료체험` alone do not
  establish an ad. A free-trial review is not an offer; solicitation such as
  sign-up, application, provision or payment supplies distinct offer evidence.
  Hidden text with no supported ad semantics → no finding.
- Reporting, prevention, education, statistics and accessibility-help text can
  name illegal activities without advertising them. When that context has no
  concrete offer/solicitation and no ad destination, the gate rejects it even
  if the text is hidden or uses mixed Unicode. Quoted examples inside this
  local context do not count as offers or transformed advertisement spans.
  An unquoted offer or observed destination pattern still passes. A library
  borrowing/return/ebook service with no financial solicitation is negative.
  These are per-owner observations: another concealed promotional comment on
  the same reporting or library page remains eligible.
- A topic word in a public URL path is not sufficient destination evidence.
  The current deterministic rule requires a gambling host label or both a
  category and conversion/action route signal. Ambiguous destinations remain
  an explicit recall/precision limit to challenge with L2 cases.
- Legitimate hidden UI must not become an official finding merely because
  concealment is present. Hidden category navigation has a bounded structural
  precision rule: a `nav`/navigation landmark plus a real collapsed interactive
  `aria-controls` relationship or an identical visible href/text counterpart
  in that same navigation. Controls must be enabled and resolve to the actual
  hidden panel. The rule excludes only OFFSCREEN evidence, and concrete offer
  intent or a suspicious action destination disables the exclusion. Navigation
  markup alone, a fake/disabled controller, a wrong-target mirror or an
  invisible mirror supplies no exclusion. No domain/class/category-word
  exclusions apply.
- Mixed/ambiguous semantics defer to `DecisionEvidence { rule, score,
  threshold, passed, detail }`; the decision model resolves ambiguity only,
  never acts as sole detector.

## 3. HOMOGLYPH (`homoglyph-signal`)

Deterministic Unicode analysis. Keep raw text, normalized (NFKC) text,
codepoints, script info, confusable mapping, mixed-script evidence.

Covers a bounded, reviewed subset: fullwidth forms, ASCII case folding for
match purposes, Cyrillic/Latin lookalikes from Unicode UTS #39 15.1.0,
punctuation inside a matched term, and complete Latin `casino` leet tokens.
Numbers in dates/telephone numbers and arbitrary words are never globally
substituted. Case folding alone is not an evasion technique. The subset and
its pinned source are recorded in `text-policy.ts`; unsupported confusables
remain a recall limitation, rather than a general transliteration promise.

Restoration happens before semantic rejection. The explicit `matchText`
representation is compact and ASCII lowercase; `normalizedText` in new
Unicode signals uses this representation, rather than the previous readable
NFKC-only form. Raw evidence remains unchanged. Each term/technique span
records exact original UTF-16 offsets and transformation kinds. A directly
attached fullwidth Latin prefix is included in the promotional token
(`Ｋ카지노`); a separate Cyrillic place name or fullwidth word does not
establish a technique for `카지노` elsewhere in the sentence.

Negatives: legitimate Unicode confusables (e.g. intentional multilingual
text), brand names with mixed script but no ad semantics.

## 4. JAMO (`jamo-signal`)

Korean-specific: Hangul syllables, Choseong/Jungseong/Jongseong,
Compatibility Jamo. Handles spaced/fragmented patterns
(e.g. `ㅋㅏㅈㅣㄴㅗ` → `카지노`). Keeps raw and reconstructed text separately;
reconstruction goes in `normalizedText`, never `evidence_text`.

Negatives: legitimate educational/Jamo content (Hangul teaching pages),
ordinary Korean text that happens to contain isolated Jamo.

A JAMO signal requires vowel-bearing reconstruction that contributes to an
ad-term occurrence. Modern initial/medial/final composition follows the
Unicode Hangul composition formula, including compatibility consonants used
as finals (`ㄷㅐㅊㅜㄹ` → `대출`). A consonant before a vowel starts the next
syllable. Source spans prove which reconstructed occurrence contributes;
another plain occurrence does not suppress it. Disconnected laughter,
shorthand, unrelated decomposed names and standalone consonants/vowels remain
silent, including the historical f372 comment.

### Policy evidence and collection limits

`FindingDetail.textPolicy` stores the version, typed reason codes, owned
analysis text, term/technique/offer/quote spans and source mapping into the
unchanged official raw text. Offsets are UTF-16, including after astral
characters. Owned text can be discontiguous when an independent child block
occurs inside an owner; the explicit mapping identifies each original segment
instead of inventing one highlight across unrelated child text. The
deterministic two-axis score is a rule result, never a calibrated probability.

Pure restoration reads at most 32,768 source code units and reports a limit
reason. Live collection applies limits during traversal: 10,000 text nodes,
1,000 owners, 1,048,576 total source code units, 32,768 per owner, and 32 styled
descendants per owner. Source traversal has its own equal node/total-text
bounds. An incomplete owner is omitted because its full original evidence
cannot be represented; the collection reports the limit to scan coverage.
Omitted text is unknown, not a checked negative. Rendering observations pass
frame-owner effects through the live adapter, with unsupported composition
reported separately in `observed.renderingIssues`.

## 5. TRANSPARENT (`transparent-signal`)

Computed style + rendering context: `color:transparent`, alpha channel,
`opacity` (self + ancestors), foreground/background equivalence, rendered
visibility. Official examples covered: same fg/bg color, `opacity:0`,
`color:transparent`; plus parent opacity, alpha, inherited color.

Requires content relevance: a transparent container with ad-semantic
descendant text fires on the text element, not on every `opacity:0`
animation state. Normal transparent animation states are negatives.

## 6. OFFSCREEN (`offscreen-signal`)

Geometry + computed style, not CSS-string matching. Official examples:
`font-size:0/1px`, large negative absolute positioning, `display:none`;
plus zero-size rendering, offscreen transforms, clipping, hidden-overflow
where meaningful.

Emission rule: the located element is the ad-text element itself; geometry
in `GeometryEvidence { x, y, width, height, visible }` must support the
claim. Viewport-relative judgment uses actual boxes, not class names.

The structural navigation rule in section 2 distinguishes a collapsed or
responsive category link from deliberately hidden advertising. Its visible
counterpart check reuses the same computed concealment signals; transparent
or offscreen mirrors do not qualify. Semantic offer/destination guards remain
in the canonical pipeline, and TRANSPARENT/HOMOGLYPH/JAMO evidence is unchanged
by the OFFSCREEN navigation exclusion.

## 7. Frame analysis

Live Playwright frames are inspected up to `maxFrameDepth` (default 4) and a
15-child-frame cap per page; nested frames repeat `>>>`. Relative iframe `src`
is normalized before emission. Cross-origin frames exposed by Playwright can
be inspected directly without opening a second Page. External frame URLs are
observed but never recursively crawled as site pages.

## 8. Evidence graph (observation channel)

Nodes: Page/Frame/Element/Resource/Creative/Domain/Redirect/Landing.
Edges: CONTAINS/LOADS/EMBEDS/DISPLAYS/LINKS_TO/REDIRECTS_TO/SIMILAR_TO.
Wording discipline: "correlated / related / shared / recurring advertisement
infrastructure" — never operator identity, nationality, or personal identity
from WHOIS/CDN/geo signals. Graph supports findings; similarity alone never
creates an official finding.

## 9. URL canonicalization

Trailing-slash, http/https equivalence where evaluation requires it,
fragment exclusion, query-parameter ordering normalized; query **values**
preserved (different values may be different pages). No aggressive
query-stripping merges. Sorted query pairs are serialized with URL encoding,
so a value containing `&` or `=` cannot collide with multiple query parameters.
Literal plus signs remain distinct from spaces; duplicate values and Unicode
remain represented in the normalized key. The original URL is still visited
and retained in official records.

Main-frame redirects must retain the entry host (including its port) before
access-document reads and live detection. An outside final URL is retained as
an observed redirect and a failed page with reason `external-redirect`; its
body and links are not analyzed or recursively crawled. This check also runs
after document parsing and settling to cover script/meta redirects. HTTP and
HTTPS on the same host remain allowed. External iframe inspection remains
available with its original frame URL and selector chain.

## 10. Output validation (release gate)

Before writing `result.json`: JSON parseability, UTF-8 no BOM, meta fields,
required finding fields, unique IDs, technique ∈ official enum, dedup
identity `url+location+technique`, URL well-formedness, selector uniqueness
+ round-trip where possible. Any failure blocks release. Extra file
validated separately (`technique="ETC"` + `extra_finding` string required).

Optional `textPolicy` evidence is checked by both TypeScript and the native
host before transfer or reopening. Offsets use UTF-16 code units, including
astral characters; spans cannot split a surrogate pair, and each `raw` span
must equal its slice of `analysisText`. An exact source mapping covers the
analysis text in order and matches the original `rawText` slices. Unavailable
alignment carries no mapping. Analysis text is capped at 32,768 code units,
source mappings at 10,000 segments, and each span list at 32,768 entries.
Version, reason codes and transformations use the declared enums.
`observed.renderingIssues` retains up to 32 nonempty descriptions of at most
256 code units. Optional worker timing requires valid ordered RFC3339 dates
and a finite nonnegative analysis duration; it excludes host persistence and
export. The shared `detail-policy-conformance.json` corpus exercises these
boundaries in both runtimes.

## 11. Test contract (Phases 5–9)

Each detector ships positive + negative fixtures (Phase 2 site first):
positives per technique, combined-technique elements (→ two findings),
same-technique multi-string elements (→ one finding); negatives per §2/§5/§6
plus sr-only/nav/modal/collapsed/app-state cases. Metrics: TP/FP/FN,
precision, recall, elapsed time.

## 12. Offline text similarity for image review

After official JSON is committed and bounded OCR finishes, ordinary scans run
an optional local EmbeddingGemma 2 text-only comparison on remaining eligible
external-linked images. Existing literal positive decisions are retained.
Public reporting/education and voice-phishing prevention campaigns stay
excluded; symbol/numeric-only OCR cannot establish a text-semantic offer.
Equivalent visible DOM text is not duplicated as an image-only finding.

The helper uses a pinned FP32 ONNX text backbone and fixed bilingual positive/
negative references, with classification prefix and cosine margin0. It adds
`image-only-ad-v4-text-review` extra review candidates, never official
concealment techniques. Raw OCR and literal matches are unchanged. Similarity
is not a calibrated probability or legal finding. Detail/UI/workbook record
model revision, similarities, margin, time and unavailable states.

The OCR child owns the lazy model, shares cancellation/deadline isolation,
and fetches no model or remote inference during scans. Inputs are bounded to
4096 UTF-16 units/256 tokens; reserved modality syntax is rejected. Missing
assets or inference failures preserve the baseline. Build assets are SHA-256
pinned (~1.12GB), streamed into the cache and hardlinked into local staging.
Windows validation remains deferred. Numerical parity, new real images,
posthoc guard corrections and timing are recorded in
[the integration evaluation](TEXT_EMBEDDING_INTEGRATION_20261021.md).

Policy `text-ad-embedding-v2` added three ordinary education
references (language/exam classes, textbooks and tuition refunds) to the previous
sixteen. Positive descriptions, encoding and margin0 are unchanged. There is no
education keyword exemption or advertiser allowlist. Both saved v1 and new v2
evidence remain valid; reopening a case never relabels its saved scores. Known
education errors are development data, with new-source evaluation reported in
[the refinement comparison](OCR_SEMANTIC_REFINEMENT_20261021.md). The three small
MT banner misses remain unresolved; diagnostic glyph recovery is not final recall.

Semantic-only Tesseract positives on externally linked PNG images are verified
with the existing Korean PP-OCRv5 recognizer, even when mean Tesseract confidence
is high. A completed informative verification replaces the selected transcript
and uses its own semantic/public-information decision; OCR or helper failure
keeps the prior positive. Literal-rule positives skip this optional verification.

Other unresolved externally linked small PNG banners (height<=96, aspect>=3)
may receive a second OCR pass with detector enlargement capped at4x. A shorter
and lower-confidence reading from this same PP recognizer cannot become a
positive solely through the text helper; a literal offer remains eligible.
The same public-information veto and text decision apply to each independent
transcript. Selected text is not a concatenation or manual
correction. Optional `ocrAlternatives` stores at most one other available result
(up to4096 UTF-16 units) or an explicit failure/budget state. Extra OCR work is
after all primary OCR and within request/global deadlines. A late abort is
reflected in final coverage/status while the already committed JSON is retained.

GIF identity/salience uses128x32 detail sampling with four temporal index bins;
the creative similarity hash stays8x8. Distinct decoded content omitted from
selection also marks partial coverage. Caps remain120 inspected frames, about3s,
and4 retained frames. Actual served-GIF recall has not been established; see
[the OCR/GIF comparison](OCR_GIF_IMPROVEMENT_20261021.md), including remaining
misses and independently observed normal-ad false positives.

The exam-fee/Samsung reduction corrections and rejected EasyOCR/TrOCR comparison
are recorded in [the engine comparison](OCR_ENGINE_COMPARISON_20261021.md).
Alternative-engine gibberish that crosses the helper margin is not evidence
that a missing advertisement was recovered. Windows remains unverified.


## 13. Bounded image-assisted review

Unresolved external-linked small PNGs (height<=96, aspect>=3) can receive
separate pinned image+actualOCR comparison after primary OCR andtext analysis.
`image-only-ad-v5-image-review` requires realmargin>=0 andfixedseed1701 shuffled
pixelmargin<0. The image policyv2uses20base references plus2image-normal types.
At least one available selected/unused actual OCR must contain numeric context.
This never concatenates transcripts or invents words, anddoesnot make numbers
sufficient evidence alone. Any public/visible-DOM exclusion in either reading
vetoes this additional path. Existing positives andofficial JSON stay intact.

Textv3adds one cosmetic-item-code normalreference (20total) without changing
positive descriptions ormargin0. Prize-only language without actual category/
deposit context andunsupported singleword readings do not establish an ad from
similarity alone. In particular a corrupted coupon's signup substring is not
sufficient. Oldv1/v2 saved evidence is still accepted andnot relabelled.

The killable OCR worker shares the text backbone andlazily opens the matching
671MB vision encoder. The real/controlpair has16s within the existing global
deadline; unavailable is explicit. Images are SHA-bound to stored assets and
TS/Rust validate numerical evidence. UI/reports label these as `이미지 기반 검토 필요`,
retaining raw OCR andscores ratherthan claiming transcription/legal proof.

Final measured old49positive is retained, MT7->10/10, source-backednormal65FP2->0.
The new6positive still4/6 andderivedGIF2/3; Windows remains unverified. Generic
image scoring has normal false positives outside this bounded policy. See
[the grounding comparison](OCR_GROUNDING_20261021.md) for provenance, posthoc
corrections, limited untouched normal controls, numerical parity andN5timecost.

## 14. 저해상도 이미지 예시 비교와 GIF 프레임 다양성

이미지 `image-ad-embedding-v3`는 동일한 고정 FP32 모델에서 이미지 질의를 실제 광고 예시
임베딩과 비교한다. 양성15·정상11·픽셀 섞기 음성26의 번들 참조를 사용하며, 검사 때 모델이나
참조를 내려받거나 사용자의 저장 사례를 학습하지 않는다. 선택 OCR은 이 이미지 임베딩에
입력하지 않고 실제 원문/대안으로 보존한다. 출력은 `image-only-ad-v5-image-review` 검토 후보다.

호출 순서는 공식 JSON 확정, 기본 OCR, 문자 비교/대안 OCR, 미해결 작은 PNG의 이미지 비교다.
공공안내·동일 DOM 제외를 유지한다. 실제 수강/응시료 할인이나 휴대폰 구매·쿠폰 문맥은 단순한
형태 유사도로 뒤집지 않으며 실제 카지노/입금/충전 문맥이 있으면 일반 거래 제외를 적용하지 않는다.
문자는 숫자·실제 광고 표현·offerIntent·전문 표현이 모두 없으면 보류한다. 이미지 보조는 한 원문에
%/금액 단위/복수 숫자 그룹이 있어야 한다. 고립된 숫자 하나, 일반 제목, 원문끼리의 합성으로
광고 근거를 만들지 않는다. 약한 대안 OCR의 보류가 기존 실제 범주까지 지우지 않도록 추론 자격과
공공/정상/DOM 제외를 분리한다.

GIF는 시간 구간별 경계선 최대값 대신128×32 밝기 배치가 서로 다른 프레임을 남긴다.
최대5개 경쟁 후보에서4개를 남기는 bounded greedy 선택이며120검사/3초/4보관 한도는 같다.
새 후보가 선택될 때만 PNG를 만들고 실패 시 기존 선택을 유지한다. 제한 때문에 버린 내용은
계속 부분 확인으로 표시한다. 실제 광고주 원본 GIF 전반의 발견률은 별도 검증 대상이다.

[이번 비교와 원시 증거](OCR_LOWRES_GIF_20261021.md),
[결정·대안·재검토 조건](ADR/0017-bounded-animation-and-korean-banner-ocr.md)을 따른다.
Windows 검증은 계속 보류한다.
