# Selector engine (Phase 4)

Deterministic builder in `packages/scanner/src/selectors.ts`, consumed by
the crawler and (Phase 5+) the detectors.

## Priority (KODEX §8)

1. stable unique ID (`#ad-hg-casino`);
2. stable attribute (`a[href="/promo"]` — only when unique);
3. tag + meaningful class (`p.dup` — only when unique);
4. parent-child path (`main > p.dup`);
5. nth-of-type fallback (`p.dup:nth-of-type(2)`).

`buildSelectorFor` returns `undefined` when no unique selector exists —
callers must drop the finding, never emit an ambiguous selector.

## Frame locations

Per-frame iframe selectors resolve via `frame.frameElement()` in the live
browser (`#frame-outer`, `#frame-inner` OBSERVED on fixtures). The contract
`serializeFramePath` joins them: `iframe[src="ABS"] >>> selector`, repeated
for nesting. Crawler `FrameSnapshot.selectorChain` carries the per-level
selectors; `LocatedSnapshot` carries the final contract location.

## OBSERVED (this machine)

- All direct ground-truth positive selectors round-trip
  (found + unique + same element).
- Priority test: `#unique-ad` unique; bare `p.dup` correctly ambiguous
  (2 matches, must not emit); `nth-of-type` disambiguation unique.
- Nested iframe: `#frame-outer` / `#frame-inner` resolved live; contract
  serialization matches `iframe[src="ABS"] >>> … >>> #ad-frame-jamo`;
  inner HTML contains the Jamo ad.
- Suite: selector tests 3/3; full suite green; typecheck/lint clean.
