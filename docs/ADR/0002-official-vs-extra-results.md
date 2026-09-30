# ADR-0002: result.json is sacred; extras live in result_extra.json

Status: accepted (KODEX §5–6).

## Context

Qualification scoring (45/35/20) consumes `result.json`. Experimental
intelligence (creative correlation, redirect chains, zero-width/low-contrast
variants, delayed ads) must not corrupt official precision.

## Decision

Only `HOMOGLYPH | JAMO | TRANSPARENT | OFFSCREEN` appear in `result.json`.
All extended findings use `technique = "ETC"` + project `extra_finding` in
`result_extra.json`, validated separately. Finding identity stays
`url + location + technique`.

## Consequences

- The validator fails the build/release on any invented official technique.
- Extra detectors must prove value independently before shipping.
