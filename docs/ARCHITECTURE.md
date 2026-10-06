# Architecture — current engine and Product V2 target

Status: partial Product V2 implementation, 2026-10-06. ADR-0010 supersedes
the product-facing portion of Contract v0's freeze. Contract v0.2 detail and
coverage types are implemented. The four official techniques, official output
schema/validator, selector identity, and React/host separation remain stable.

## Current implementation (observed in source)

React + TypeScript + Vite (`apps/web`) → `HostBridge` (`packages/contracts/src/host.ts`) → BrowserHost replay or TauriHost → Rust Tauri supervisor → Playwright worker → crawler/detection/result engine. React has three operator stages and a results workspace with official finding/page views, coverage, contextual inspector, and export dialog. The inspector reads session detail, computed CSS/geometry, and real bounded JPEG evidence. The Linux native session smoke has exercised worker progress, result/detail persistence, and readback. A portable Windows V2 run showed real JPEG evidence and completed a native save dialog on the six-page fixture; NSIS packaging and the full operator release walk remain unverified.

The scanner shares one monotonic deadline across a single live-page crawl and
detection pass, uses bounded concurrency 1–4, inspects available live frames,
and assigns official IDs after deterministic aggregation. Realistic Linux L2
scans preserve the same five official findings and one failed page at every
worker count. The worker writes validated official and detail JSON. Optional
visual capture is bounded to six pages and 2 MB of embedded JPEG data. The
bundled Node process and React UI each consumed those outputs in separate
Linux integration smokes.

The worker now emits a separate validated `result_extra.json`. The Tauri host
checks its metadata against the official result and stores all result parts in
one session transition. Results exposes a separate 추가 분석 list and empty
state. Graph correlations use observed links, frames and external resources;
creative fingerprints use bounded image response bytes and a live-page 8×8
pixel sample after official detection. A five-page ad fixture exercises
image redirect chains on separate content, asset and landing loopback origins.
Creative selection joins an observed final response to its selected DOM image
through at most 20 existing Playwright redirect links; no additional request
or navigation is made. The fixture also exercises
duplicate, resized, WebP and slightly changed images and repeated destinations
at concurrency 1–4. This is a bounded multi-domain ad-infrastructure L2 slice;
public ad-network scenarios and full packaged Windows product acceptance remain
open. A separate ten-page public-information fixture checks zero official and
extra findings at concurrency 1–4 across common legitimate interaction patterns.

## V2 target data flow

```text
URL + meaningful preset → monotonic ScanDeadline
  → sorted breadth-depth frontier + bounded page-worker pool (1–4)
  → one navigation per admitted live page
    → discover links + live DOM/CSS/geometry + direct live Frame inspection
    → cheap semantic and concealment gates
    → selective evidence capture within remaining budget
  → deterministic candidate dedup/sort → stable OfficialFinding IDs
  → typed page/frame failures + Evidence Graph references
  → persisted session manifest: OfficialResult, ScanCoverage, FindingDetail index
  → separate validated extra analysis from observed infrastructure/creatives
  → HostBridge reads for Results workspace
  → existing official validator/serializer → result.json
```

The persisted result, coverage, and detail index become readable before the host reports a terminal success. React does not import Tauri APIs; the native host provides session-scoped read commands and safe asset retrieval. Browser replay returns typed fixture data with a visible demo label. The operator's three stages are UI state; worker lifecycle statuses are separate domain state. `succeeded` plus failures yields a partial-completion presentation, not a new official output type.

## Contract ownership and invariants

`result.ts` remains the contest boundary: `OfficialResult` with the four required `OfficialTechnique` values, exact `url`/`location`, original evidence text, identity `(url, location, technique)`, and `result_extra.json` separation. `scan.ts`, `host.ts`, and `evidence.ts` evolve to v0.2 as specified in `DOMAIN_MODEL.md`, `SCAN_STATE_MACHINE.md`, and `EVIDENCE_MODEL.md`. ADR-0003 remains the history of why v0 was frozen; ADR-0010 records why the internal freeze is broken.

The scanner stays within the 30-minute official timeout and retains its cheap-first order. One monotonic deadline spans the whole run; the normal configured budget is 1500 s and an internal 1650 s hard stop protects the official 1800 s ceiling. Initial concurrency is 2 on the 4-vCPU/8-GB/no-GPU Windows target and never exceeds 4; this requires benchmarking, not assumption. No screenshot/OCR/VLM per element and no graph analysis in the crawl hot path. ADR-0011 owns the scheduler/determinism decision; ADR-0012 owns KRDS Adaptive pattern/token conformance. Follow-up scenario and Windows acceptance are in `TEST_STRATEGY_V2.md`.
