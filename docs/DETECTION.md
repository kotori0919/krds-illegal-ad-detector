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

Rules (frozen):

- At least one matched ad/illegal term **or** a suspicious ad destination
  (`destinationUrl`) is required. Hidden text with no ad semantics → no finding.
- Reporting, prevention, education, statistics and accessibility-help text can
  name illegal activities without advertising them. When that context has no
  concrete offer/solicitation and no ad destination, the gate rejects it even
  if the text is hidden or uses mixed Unicode. A concrete offer or destination
  still passes when paired with public-information wording.
- A topic word in a public URL path is not sufficient destination evidence.
  The current deterministic rule requires a gambling host label or both a
  category and conversion/action route signal. Ambiguous destinations remain
  an explicit recall/precision limit to challenge with L2 cases.
- Legitimate hidden UI (sr-only labels, responsive nav, inactive dialogs,
  collapsed controls, app state, normal `display:none` state) must not pass
  even when concealment is present — this is the precision gate (35 pts).
- Mixed/ambiguous semantics defer to `DecisionEvidence { rule, score,
  threshold, passed, detail }`; the decision model resolves ambiguity only,
  never acts as sole detector.

## 3. HOMOGLYPH (`homoglyph-signal`)

Deterministic Unicode analysis. Keep raw text, normalized (NFKC) text,
codepoints, script info, confusable mapping, mixed-script evidence.

Covers: fullwidth forms, Cyrillic/Latin lookalikes, digit/letter
substitutions, other visual confusables, mixed-script evasion.
`TechniqueEvidence.detail` records the mapping (e.g. `U+0410→U+0041`).

Negatives: legitimate Unicode confusables (e.g. intentional multilingual
text), brand names with mixed script but no ad semantics.

## 4. JAMO (`jamo-signal`)

Korean-specific: Hangul syllables, Choseong/Jungseong/Jongseong,
Compatibility Jamo. Handles spaced/fragmented patterns
(e.g. `ㅋㅏㅈㅣㄴㅗ` → `카지노`). Keeps raw and reconstructed text separately;
reconstruction goes in `normalizedText`, never `evidence_text`.

Negatives: legitimate educational/Jamo content (Hangul teaching pages),
ordinary Korean text that happens to contain isolated Jamo.

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
query-stripping merges.

## 10. Output validation (release gate)

Before writing `result.json`: JSON parseability, UTF-8 no BOM, meta fields,
required finding fields, unique IDs, technique ∈ official enum, dedup
identity `url+location+technique`, URL well-formedness, selector uniqueness
+ round-trip where possible. Any failure blocks release. Extra file
validated separately (`technique="ETC"` + `extra_finding` string required).

## 11. Test contract (Phases 5–9)

Each detector ships positive + negative fixtures (Phase 2 site first):
positives per technique, combined-technique elements (→ two findings),
same-technique multi-string elements (→ one finding); negatives per §2/§5/§6
plus sr-only/nav/modal/collapsed/app-state cases. Metrics: TP/FP/FN,
precision, recall, elapsed time.
