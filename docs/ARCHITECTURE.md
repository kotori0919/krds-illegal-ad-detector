# Architecture (Contract v0 draft — Phase 0)

Status: bootstrap draft. Frozen Contract v0 lands in Phase 1 (GOAL §7).

## Canonical stack

React + TypeScript + Vite (canonical UI) → Application Services →
`HostBridge` → `BrowserHost` | `TauriHost` → Tauri Rust Core → Scanner
Supervisor → Playwright Worker → Detection Pipeline (official detectors +
Evidence Graph → OCR/decision → optional VLM → Result Engine).

## Invariants (from KODEX)

- React stays platform-independent: no direct Tauri imports in views;
  all native capability flows through `HostBridge`.
- Tauri is a thin native host: lifecycle, filesystem, packaging, process
  supervision. No detection semantics in Tauri commands.
- `result.json` carries only `HOMOGLYPH | JAMO | TRANSPARENT | OFFSCREEN`;
  everything else is `ETC + extra_finding` in `result_extra.json`.
- Finding identity is `url + location + technique`; selectors must be
  unique and round-trip validated; iframe locations serialize as
  `iframe[src="ABSOLUTE_URL"] >>> selector`.
- Cheap deterministic evidence precedes expensive inference; OCR/VLM run
  on gated candidates only. Official path works offline, no GPU.

## Contracts (`packages/contracts/src`)

| Module | Contents |
|---|---|
| `technique.ts` | Official technique enum + `isOfficialTechnique` |
| `result.ts` | `OfficialMeta/Finding/Result`, `ExtraResult`, identity key, validator/serializer |
| `scan.ts` | `ScanRequest/Session/Event/Progress`, limits, defaults |
| `host.ts` | `HostCapabilities`, `HostBridge`, browser/Tauri capability sets |
| `detection.ts` | `TechniqueEvidence + IllegalAdEvidence → Candidate/Decision` |
| `evidence.ts` | Evidence graph nodes/edges, CSS/geometry, per-finding detail |
| `selector.ts` | Frame-path serialization, src normalization |

## Web (`apps/web/src`)

- `App.tsx`: phase router (start → progress → result).
- `screens/`: `ScanStart`, `ScanProgressView`, `ScanResult` (KRDS pass in Phase 11).
- `host/browser.ts`: replay/demo-only `HostBridge`; throws on export.

## Roadmap

- Phase 1: freeze Contract v0 + `docs/DETECTION.md`, `KRDS_COMPLIANCE.md`, ADRs.
- Phase 2: synthetic evaluator site + ground truth before detector tuning.
- Phase 3–10: Playwright crawler, selector engine, semantic gate, four
  detectors, result engine + validator gate.
- Phase 11+: KRDS vertical product, evidence graph, OCR, decision/VLM,
  extra results, Tauri + Windows, adversarial + perf, release closure.
