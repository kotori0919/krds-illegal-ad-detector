# Architecture — current engine and Product V2 target

Status: 2026-10-05. ADR-0010 supersedes the product-facing portion of Contract v0's freeze. `packages/contracts/src` remains v0 until Phase B implementation. The four official techniques, official output schema/validator, selector identity, and React/host separation remain stable.

## Current implementation (observed in source)

React + TypeScript + Vite (`apps/web`) → `HostBridge` (`packages/contracts/src/host.ts`) → BrowserHost replay or TauriHost → Rust Tauri supervisor → Playwright worker → crawler/detection/result engine. Evidence Graph and creative fingerprint modules exist but the UI's `EvidenceView` reads only `OfficialFinding`. `ScanResult` shows session ID, raw status, selector, and raw enum. Five top-level steps are hard-coded in `steps.ts`. `ExportView` validates and saves the official JSON in its own step.

The scanner runs cheap semantic/technique checks on live pages and outputs validated official findings. It currently extracts ID-bearing text elements, so realistic non-ID content needs verification. `ScanOutput` contains result, JSON, and page count, but no persisted page-failure list or finding details. The `ScanProgress` elements-analyzed counter currently counts found candidates, not all elements. Visual screenshots/crops are not yet captured for findings. BrowserHost replays demo data; it is not a real scan. Existing Windows evidence in `DRY_RUN.md` verifies several packaged paths on a synthetic fixture, but clean-install acceptance and Product V2 UI remain open.

## V2 target data flow

```text
URL + meaningful preset
  → ScanSession / real progress + bounded activity
  → crawl snapshots + typed page/frame failures
  → cheap semantic and concealment gates
  → OfficialFinding + stored CandidateEvidence by finding ID
  → selective visual capture + Evidence Graph references
  → persisted session manifest: OfficialResult, ScanCoverage, FindingDetail index
  → HostBridge reads for Results workspace
  → existing official validator/serializer → result.json
```

The persisted result, coverage, and detail index become readable before the host reports a terminal success. React does not import Tauri APIs; the native host provides session-scoped read commands and safe asset retrieval. Browser replay returns typed fixture data with a visible demo label. The operator's three stages are UI state; worker lifecycle statuses are separate domain state. `succeeded` plus failures yields a partial-completion presentation, not a new official output type.

## Contract ownership and invariants

`result.ts` remains the contest boundary: `OfficialResult` with the four required `OfficialTechnique` values, exact `url`/`location`, original evidence text, identity `(url, location, technique)`, and `result_extra.json` separation. `scan.ts`, `host.ts`, and `evidence.ts` evolve to v0.2 as specified in `DOMAIN_MODEL.md`, `SCAN_STATE_MACHINE.md`, and `EVIDENCE_MODEL.md`. ADR-0003 remains the history of why v0 was frozen; ADR-0010 records why the internal freeze is broken.

The scanner stays within the 30-minute official timeout and retains its cheap-first order. No screenshot/OCR/VLM per element and no graph analysis in the crawl hot path. Follow-up scenario and Windows acceptance are in `TEST_STRATEGY_V2.md`.
