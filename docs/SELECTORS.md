# Selector engine (Phase 4)

Deterministic builder in `packages/scanner/src/selectors.ts`, consumed by live
DOM text detection. `createSelectorEngine` supplies the canonical functions in
both Node and browser contexts; detection serializes trusted function source
only, without interpolating page text, URLs, attributes, or selectors into code.

## Priority (KODEX §8)

1. stable unique ID (`#ad-hg-casino`);
2. stable attribute (`a[href="/promo"]` — only when unique);
3. tag + meaningful class (`p.dup` — only when unique);
4. parent-child path (`main > p.dup`);
5. nth-of-type fallback (`p.dup:nth-of-type(2)`).

`buildSelectorFor` returns `undefined` when no unique selector exists —
callers must drop the finding, never emit an ambiguous selector.
IDs and classes follow CSS identifier escaping, including leading digits;
attribute strings escape quotes, backslashes, and control characters. A duplicate
ID falls through to another unique stable attribute before ancestry is tried.
Ancestry and positional fallback continue to the document root, so repeated
chains deeper than eight elements remain addressable. Every emitted selector
must match exactly one element and round-trip to the intended element;
`roundTrips` rejects ambiguous selectors even when their first match is correct.

## Frame locations

Per-frame iframe selectors resolve via `frame.frameElement()` in the live
browser (`#frame-outer`, `#frame-inner` OBSERVED on fixtures). The contract
Location policy 1.1 uses `OWNER_SELECTOR >>> selector`, repeated for nesting.
The official URL anchors the top-level checked page. Each owner selector is
generated and uniquely checked in its parent document; document URLs remain
internal provenance. Duplicate-src siblings, redirected frames, srcdoc and
populated about:blank retain distinct occurrences. Historical accepted files
retain old locations; a new run uses the corrected policy/version.

`resolveFrameLocation(page, location)` starts with the already-open top-level
page, checks one match at every segment, follows its `contentFrame`, and
returns the unique terminal element handle. It never navigates or follows
advertiser destinations. The parser respects quoted/escaped CSS separators.
Missing, detached and ambiguous segments fail explicitly. Frame count/depth
or observation omissions appear in `PageSnapshot.collectionIssues`.

## Verification

- All direct ground-truth positive selectors round-trip
  (found + unique + same element).
- Actual generator regression test uses served Chromium pages with escaped IDs,
  classes and attribute strings, duplicate IDs, and repeated 16-level ancestry.
  It checks uniqueness and identity against each original DOM element, and
  rejects ambiguous and wrong-element round trips.
- Nested iframe: `#frame-outer` / `#frame-inner` resolved live; contract
  serialization matches `#frame-outer >>> #frame-inner >>> #ad-frame-jamo`;
  inner HTML contains the Jamo ad.

OBSERVED: `frame-identity.test.ts` resolves six served duplicate-src/nested/
relative/srcdoc/populated blank paths to their original element identities in
Chromium. This establishes the candidate policy, not organizer acceptance of
the chosen top-level URL interpretation.
