# ADR-0010: Product Architecture V2 (2026-10-05)

Status: implemented operator workflow and real evidence/review/export observed in the installed Windows app; scanner concurrency/performance acceptance observed. Combined release remains open for the scoped strict UX gates in PRODUCT_V2_ACCEPTANCE.md. Supersedes ADR-0003 only where Contract v0 froze product-facing scan, host, and evidence types. Official output, technique values, finding identity, selector serialization, and platform separation remain in force.

Scope expanded 2026-10-05: Product V2 acceptance also requires the single-pass,
bounded concurrent scanner and stronger KRDS pattern/token conformance in
ADR-0011 and ADR-0012. This ADR's three-stage IA is necessary but insufficient
for V2 completion.

## Context

The current React app has five top-level steps (`start`, `progress`, `result`, `evidence`, `export`). `ScanResult` makes the CSS selector a primary column, `EvidenceView` re-reads only `OfficialFinding`, and `ExportView` puts raw JSON on the main path. `HostBridge` can return results but no coverage, per-finding detail, or visual evidence. The scanner currently extracts text from ID-bearing elements and can abort analysis on a page exception. A deterministic fixture and a packaged Windows scan have exercised important engine paths; neither establishes day-to-day usability on noisy public sites.

Contract v0 was frozen early to stabilize concurrent engine work, not to declare the five-screen information architecture final. Keeping that UI solely because its tests pass would force operators to repeatedly leave the result list and read developer vocabulary. `result.json` is the external contest contract; internal DTOs can evolve without changing it.

## Decision

1. The primary operator is a NIA/public-sector website operations employee. The app presents three task stages: 점검 설정 → 사이트 점검 → 결과 검토. Finding inspection, extra analysis, failed-page review, and export are actions within results.
2. Results are one workspace: summary, official/extra/coverage areas, technique filter and search, finding/page views, contextual inspector, and validated `result.json` save. Narrow screens use a full-screen detail view with preserved list state.
3. Contract v0.2 adds internal `FindingDetail`, `ScanCoverage`/`ScanIssue`, `VisualEvidence`, and bounded graph retrieval. The host serves persisted data by session and finding ID. The browser host labels its data as replay; the packaged host must serve real scan artifacts. Internal detail is never copied wholesale into official output.
4. A scan with successful pages and page failures finishes with a persisted official result plus coverage; the operator sees a partial-completion warning. A failure before any usable page is a failed scan. Cancellation is distinct and must say what data is retained. Exact transitions are in `SCAN_STATE_MACHINE.md`.
5. Capture visual evidence only after a candidate passes both official evidence gates, after deduplication where feasible, and within a bounded time/size budget. Display actual capture provenance and a clear unavailable reason. No fabricated image or default screenshot of every element.
6. Keep one React implementation through `HostBridge`, a thin Tauri host, the cheap-first scanner, the four official techniques, the selector engine, and the official serializer. No new official enum or schema field is implied by this ADR.

## Consequences and migration

- `App.tsx`/`steps.ts` will replace the five-step phase model; evidence and export screens become result subflows and their old routes/tests are removed at cutover.
- The scanner/worker must persist a session manifest containing result, coverage, detail index, and evidence assets before the host reports completion. Tauri commands read only artifacts for the requested session. Browser replay returns matching typed fixtures and explicitly indicates replay mode.
- Existing `result.json` validation remains the export gate. Partial coverage is shown next to the save action and recorded in internal metadata; it does not silently alter the official schema.
- Existing synthetic tests remain L1. Realistic site scenarios, full URL-to-detail runs, and packaged Windows operator tests determine product acceptance.
- `docs/ARCHITECTURE.md` describes the current state and the v0.2 target separately. Product documents are a freeze of decisions, not a claim that implementation or Windows acceptance is complete.
