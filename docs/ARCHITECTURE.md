# Architecture (Contract v0 frozen 2026-10-01)

Status: frozen. Change requires an ADR + main-agent approval (KODEX §48);
sub-agents must not redefine shared contracts or duplicate DTOs.

## Canonical stack

React + TypeScript + Vite (canonical UI) → Application Services →
`HostBridge` → `BrowserHost` | `TauriHost` → Tauri Rust Core → Scanner
Supervisor → Playwright Worker → Detection Pipeline (official detectors +
Evidence Graph → OCR/decision → optional VLM → Result Engine).

Module map (planned; only `apps/web` + `packages/contracts` exist at freeze):

```text
apps/web                 canonical React UI (platform-independent)
packages/contracts       frozen shared types + result validator/serializer
packages/scanner         (Phase 3) crawl queue, frames, network observation
packages/detection       (Phase 5-9) semantic gate + 4 official detectors
packages/evidence        (Phase 12) graph, creative fingerprint
packages/models          (Phase 14-16) gated OCR / decision / VLM adapters
src-tauri                (Phase 18) thin host: lifecycle, fs, supervision
fixtures/synthetic       (Phase 2) deterministic evaluator site + ground truth
```

## Frozen contracts (`packages/contracts/src`, v0.1.0)

| Module | Exports | Frozen meaning |
|---|---|---|
| `technique.ts` | `OfficialTechnique` (`HOMOGLYPH\|JAMO\|TRANSPARENT\|OFFSCREEN`), `isOfficialTechnique`, `EXTRA_TECHNIQUE="ETC"` | No new official values without competition evidence + ADR |
| `result.ts` | `OfficialMeta/Finding/Result`, `ExtraFinding/Result`, `findingIdentityKey`, `validateOfficialResult(Text)`, `serializeOfficialResult`, `validateExtraResult`, `TOOL_VERSION="0.1.0"` | result.json shape locked: UTF-8 no BOM, flat findings, identity `url+location+technique` |
| `scan.ts` | `ScanLimits` + `DEFAULT_SCAN_LIMITS` (200 pages / depth 4 / 1500 s / frame-depth 4), `ScanRequest/Session/Event/Progress`, `initialProgress` | UI↔host↔worker vocabulary; timeout budget stays under official 1800 s |
| `host.ts` | `HostCapabilities`, `BROWSER/TAURI_HOST_CAPABILITIES`, `HostBridge`, `ExportPaths` | React touches native only via bridge; browser host never fakes scanning |
| `detection.ts` | `TechniqueEvidence + IllegalAdEvidence → CandidateEvidence`, `DecisionEvidence` | Both axes required for an official finding; raw vs derived text separated |
| `evidence.ts` | `EvidenceNode/Edge` (8 kinds / 7 relations), `GeometryEvidence`, `CssEvidence`, `Evidence` | Observed / derived / inference layers stay separate in UI |
| `selector.ts` | `FramePathSegment`, `LocatedElement`, `FRAME_SEPARATOR`, `serializeFramePath`, `normalizeFrameSrc` | `iframe[src="ABS"] >>> sel` convention; selectors must round-trip |

## Invariants (from KODEX)

- React stays platform-independent: no direct Tauri imports in views.
- Tauri is a thin native host: lifecycle, filesystem, packaging, process
  supervision. No detection semantics in Tauri commands.
- `result.json` carries only the four official techniques; extras are
  `ETC + extra_finding` in `result_extra.json`.
- Finding identity is `url + location + technique`; selectors unique and
  round-trip validated; iframe locations serialize per convention.
- Cheap deterministic evidence precedes expensive inference; OCR/VLM run
  on gated candidates only. Official path works offline, no GPU.

## Data-flow contract (frozen sequence)

`ScanRequest → ScanSession → ScanEvent[] → CandidateEvidence[] →
OfficialFinding[] → OfficialResult → validate → serialize → export`.
`EvidenceNode/Edge` accumulate alongside; `ExtraFinding[]` accumulate on a
separate channel and never enter `OfficialResult`.

## Roadmap

- Phase 2: synthetic evaluator site + ground truth before detector tuning.
- Phase 3–10: Playwright crawler, selector engine, semantic gate, four
  detectors, result engine + validator gate.
- Phase 11+: KRDS vertical product, evidence graph, OCR, decision/VLM,
  extra results, Tauri + Windows, adversarial + perf, release closure.
