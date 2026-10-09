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
The `image-only-ad-v2` decision requires OCR ad semantics, independent candidate
corroboration, and no equivalent visible DOM ad text. An unmarked image can
use its observed external HTTP(S) click destination as corroboration only
when OCR contains both a supported gambling/loan/cash category and explicit
solicitation or promotional terms (including high-stakes-only recruitment).
An opaque advertiser domain or numeric image filename need not match a keyword.
The destination is observed, not visited. External links alone, category logos,
public-information images and ordinary product offers remain insufficient.

This corrects an observed Windows false negative: OCR read a casino
high-stakes recruitment banner, but the previous decision ignored the external
click target and rejected it at score 2/3. The threshold remains 3/3. Capture,
OCR, deadline and network bounds remain active; this change does not imply
recognition of every banner or an exhaustive legal classification of a site.

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
