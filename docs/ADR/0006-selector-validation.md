# ADR-0006: Selector builder validates, never guesses

Status: accepted.

## Context

Extraction accuracy (35 pts) requires every `location` to resolve to exactly
the intended element. A builder that returns best-effort ambiguous selectors
would silently corrupt `result.json`.

## Decision

- `buildSelectorFor` returns `string | undefined`; `undefined` means
  "no unique selector exists" and the finding must be dropped.
- `countMatches` (uniqueness) + `roundTrips` (identity) are the emission
  gates; both live beside the builder so detectors share one validation path.
- Bare shared classes (`p.dup` matching 2) are correctly rejected; the
  fallback appends `nth-of-type` rather than emitting the ambiguous prefix.
- Iframe levels resolve independently via `frameElement()`; the frozen
  `serializeFramePath` joins them. No cross-document `querySelector` hacks.

## Consequences

- Phase 5+ detectors call `buildSelectorFor` per candidate and drop
  `undefined` results before `OfficialFinding` construction.
- Result-engine validation (Phase 10) re-checks uniqueness as a release gate.
