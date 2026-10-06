# Domain model V2

Status: implemented internal Contract v0.2, 2026-10-06. The canonical shapes are in packages/contracts/src/detail.ts, scan.ts and host.ts; official output remains unchanged. The completion audit corrected successful-page coverage separately from attempted-page progress.

## Boundaries

`OfficialResult` and `OfficialFinding` in `packages/contracts/src/result.ts` are the immutable contest serialization boundary: four technique values, raw `evidence_text`, exact `url` and `location`, unique `id`, and identity `(url, location, technique)`. `ExtraResult` is a separate output. Neither includes screenshot bytes, coverage, or explanatory UI text. Internal V2 records are session-scoped and must not be serialized into `result.json`.

| Entity | Identity and owner | Required meaning |
| --- | --- | --- |
| `ScanSession` | host-generated `sessionId` | Entry URL, started/finished timestamps, lifecycle state; not primary UI text. |
| `ScanProgress` | latest event for session | Measured counts and stage only; current page and meaningful activity may be a bounded event stream. |
| `ScanDeadline` | one per scan, worker-owned | Monotonic start/effective expiry and reserve; shared by all page workers, frames, evidence and finalization. Never reset per phase. |
| `PageWork` | normalized URL + depth | Stable frontier admission and one live-page execution; at most the selected worker count in flight. |
| `ScanCoverage` | one per session | Successfully processed pages, failed-page URL/status/reason and deadline expiry. Failed pages are excluded from checkedPages. Progress visitedPages counts all completed attempts; elapsed time is separate. |
| Failed-page record | session + attempted page URL | URL, HTTP status or status0 for navigation/analysis failure, and a reason. The UI translates these to Korean; this record does not promise per-frame failure coverage. |
| `OfficialFinding` | `(url, location, technique)` + exported ID | Contest finding summary and export source of truth. |
| `FindingDetail` | `(sessionId, findingId)` | Raw/normalized text, matched terms, destination when recorded, measured CSS/geometry and bounded actual visual evidence. Detail joins the same official ID. |
| `EvidenceGraph` | worker scan | Observed resource/domain/creative relations used to derive separate ExtraResult summaries. HostBridge exposes those summaries; it does not expose a redundant raw graph API. |

## Implemented typed records

`FindingDetail` joins by `findingId` and preserves the official URL, location,
technique and raw text. It stores `normalizedText`, `matchedTerms`,
`techniqueReason`, optional `destinationUrl`, measured `observed.box/css`,
and a `visual` available/unavailable union. Available evidence carries actual
JPEG bytes, capture time, viewport/scroll/device scale, target coordinates and
an actual element crop or a typed absence reason. `CreativeImage` separately
joins an extra finding's ID/source URL with observed PNG/JPEG/WebP bytes and
original dimensions. `ScanDetailBundle.version2` requires both record arrays
and one `ScanCoverage`.

`ScanCoverage` contains `checkedPages`, `failedPages` and `timedOut`.
Successful checked pages and failed pages are disjoint. Attempted-page
progress is `visitedPages`; it includes both outcomes. No skipped-by-limit
count, frame-failure enumeration or generic semantic-explanation object is
fabricated when the scanner did not record it. Official metadata supplies
start/end time; progress supplies monotonic elapsed time.

The bounded JSON manifest is host-validated and loaded through session reads.
It contains no page-controlled filesystem paths. BrowserHost is labelled
replay; TauriHost reads actual persisted worker output. Missing records and
rejected reads are distinct UI states. See EVIDENCE_MODEL for the8MB host,
2MB JPEG and bounded creative-image representation.

## Concurrent scan ownership

One coordinator owns `ScanDeadline`, frontier admission, limits, aggregate counters and result construction. Each page worker owns one live Playwright `Page` from the shared context and returns page-local discoveries, candidates, issues, and optional evidence references. Workers do not assign finding IDs or mutate official output. The coordinator merges discoveries only at a depth frontier barrier, normalizes/deduplicates/sorts next-depth URLs, and applies `maxPages` in stable order. This makes the admitted page set independent of worker completion order near scope limits. Per-page failure identity is `(normalized URL, phase, reason)`; `checkedPages` increments only after that page's analysis completes. Live frame detection retains its full containing-page/selector chain. An unavailable frame position is explicit in visual evidence; successful-frame enumeration is not a top-level checked-page count.

V2 session lifecycle uses `queued | running | finalizing | succeeded | cancelled | failed`; `running` includes overlapping discovery and analysis on live pages. `ScanProgress` may expose current activities for the operator, but it must not model crawl and analysis as sequential global phases. All current callers use this lifecycle; legacy sequential states remain in Git history only.

Canonical result aggregation deduplicates by official `(url, location, technique)`, resolves duplicate evidence with a documented stable tie-break, sorts by normalized page URL + serialized frame path + location + technique, then assigns IDs. `FindingDetail` joins the post-sort ID. The semantic finding set and coverage set must match across concurrency 1–4 for the same scenario; timestamps/elapsed seconds may differ. The worker protocol carries the configured budget and selected concurrency, while the internal hard guard and finalization reserve remain worker/host concerns. The standard 4-vCPU machine begins at 2 workers, with a hard maximum of 4.

## Invariants and migration checks

- `FindingDetail.findingId` joins exactly one `OfficialFinding.id`; no orphan or duplicate detail. One element with two official techniques has two finding IDs and technique-specific reasons, possibly sharing one captured asset.
- Page grouping uses `OfficialFinding.url` as the affected public page key. Frame path is technical location. Distinct canonical URLs are not collapsed by display path.
- Coverage counts are computed from actual navigation/analysis outcomes; a page does not count as checked until its analysis finishes. A failed page may still have a crawl snapshot, but it is not silently treated as checked.
- Result and detail manifest must be persisted atomically enough that `succeeded` is never observable before the host can retrieve them. Event counts may lead the persisted result during running; the UI labels those counts provisional.
- Export always revalidates `OfficialResult`; coverage and detail never change the official JSON shape. Current native validation requires version2; absent details show an unavailable state without fabricated evidence.
- Active pages, live frames, screenshot work, and browser processes are bounded by one deadline and worker-pool capacity. Optional evidence may be unavailable due to budget without changing an official finding.
