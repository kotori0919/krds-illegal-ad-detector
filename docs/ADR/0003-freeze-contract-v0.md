# ADR-0003: Freeze Contract v0 (2026-10-01)

Status: accepted.

Product-facing `scan.ts`, `host.ts`, and `evidence.ts` portions were superseded
by ADR-0010 on 2026-10-05. The official result schema, technique values,
finding identity, and selector conventions remain in force.

## Context

Phase 0 shipped a Contract v0 draft across seven modules. Phase 2+ work
(synthetic evaluator, crawler, selector engine, four detectors) needs stable
shared types; uncoordinated drift (duplicated DTOs, second selector format,
second result shape) would break scoring output.

## Decision

Freeze `packages/contracts@0.1.0` as Contract v0:

- `technique.ts`: four official values + `ETC`; no additions without
  competition evidence.
- `result.ts`: result.json / result_extra.json shapes, identity
  `url+location+technique`, validator + BOM-free serializer.
- `scan.ts`: limits (200 pages / depth 4 / 1500 s / frame-depth 4),
  request/session/event/progress vocabulary.
- `host.ts`: `HostBridge` as the sole React→native seam; browser host
  capability set all-false.
- `detection.ts`: two-axis evidence (`TechniqueEvidence + IllegalAdEvidence`),
  raw/derived separation, decision record.
- `evidence.ts`: 8 node kinds / 7 edge kinds, CSS/geometry detail.
- `selector.ts`: `FramePath` chain, `LocatedElement`, `>>>` serialization,
  absolute-src normalization.

## Consequences

- Changes require an ADR + main-agent approval (KODEX §48).
- `Finding` (alias of `OfficialFinding`) and `FramePath` (alias chain) are
  the canonical names for GOAL §7's `Finding` / `FramePath` rows.
- Detector/scanner packages (Phases 2–10) consume these types; no local
  redefinitions.
