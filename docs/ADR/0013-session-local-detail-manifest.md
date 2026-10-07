# ADR-0013: Bounded session-local detail manifest (2026-10-06)

Status: bounded element-region captures, analysis position and creative assets observed in Linux scanner/UI and actual installed Windows host execution. Current-worker Windows memory/performance scenario acceptance passed; full V2 strict UX remains open.

## Context

The official `result.json` schema cannot carry computed CSS, geometry,
semantic reasoning, coverage failures, or screenshots. Product V2 requires a
real inspector and an export whose bytes remain contract-conformant. The
first V2 scanner pass already has the live Playwright Page and Frame; a later
navigation to reconstruct evidence would violate ADR-0011.

## Decision

During each live-page task, record the computed CSS/box and gate evidence for
confirmed candidates. After official detection, capture one ordinary viewport
JPEG for a page with findings if the shared deadline and byte cap allow it.
Limit captures to six pages, 500 KB each, and 2 MB aggregate embedded JPEG
source bytes, counting a repeated page image once per finding;
otherwise record a typed unavailable reason. A viewport image is labelled as
context, especially for hidden/offscreen text. Do not claim a crop or overlay
that was not captured.

After stable official IDs are assigned, join each selected candidate to its
`OfficialFinding` by `(url, location, technique, raw text)` and write Contract
v0.2 `ScanDetailBundle` to a separate worker file. Keep the official output
unchanged. The Tauri host validates version, count, ID join, exact exported
fields, coverage bounds, and a bounded JPEG data URL before atomically storing
the official and detail results for a succeeded session. The persisted bundle
is a worker/host boundary; React requests selected metadata and opaque assets
through the session-scoped HostBridge methods described below. Browser replay
uses an explicitly labelled projection of supplied evidence.

## Tradeoff and acceptance

An in-memory data URL avoids a routable file endpoint, arbitrary paths, and
orphaned evidence files. Repeating the same image for several findings can
increase manifest size, so the host caps the full manifest at 8 MB. The host
indexes persisted bytes once and deduplicates session-owned opaque asset IDs
without changing `result.json`; no filesystem path is exposed to React.

## Amendment: lazy operator evidence (2026-10-07)

Results opening retrieves official findings, coverage/page outcomes and a
small evidence summary. `getFindingDetail` returns one finding's CSS, geometry,
normalization and asset IDs. `getImageAnalysis` pages metadata (default12,
maximum24) and supports page/extra-finding filters. `getEvidenceAsset` returns
only the requested session-owned image; failed/missing reads remain retryable,
and successful native reads are cached for repeated review.
`getEvidenceGraphSlice` is click-only, with default100nodes/200edges, hard
250/500 and depth2. Legacy records without a graph or new assets retain their
available evidence and disclose missing analysis. No old full-bundle IPC remains.

The initial L2 scanner test and Node worker CLI observed a real JPEG,
CSS/geometry, detail-to-official ID join and failed-page coverage. Later
installed native retrieval, measured placement, cancellation cleanup and
Windows memory/performance observations are recorded below and in DRY_RUN/PERF.
The new controls' native narrow/zoom gate subsequently passed (KRDS_COMPLIANCE).
None of these native
claims is inferred from a successful TypeScript suite.

The 2026-10-06 built-web smoke feeds the real municipal-site scan output into
the React workspace through a labelled IPC replay. All five JPEGs decoded in
the finding inspector and matched their detail records; coverage and export
preview matched the same scan. This verifies the data-to-inspector join without
claiming native Tauri retrieval or Windows rendering.

## Amendment: element regions and analysis position (2026-10-06)

Available viewport evidence now also carries a target state with explicit
main-viewport coordinates and a separate element-region capture state.
The shared scan budget permits at most six unique element captures and counts
their serialized copies within the existing2MB cap. Candidate text and bounds
must remain stable across page capture; crops are clipped to the main viewport
and containing live frame bounds, never recovered by a second navigation or
scroll. Offscreen, changed/detached and exhausted cases remain explicit.
Both JavaScript and the native host validate the new geometry, coordinate
space, device scale, crop bounds and bounded JPEG schemes before display.
The inspector adds a separately labelled, toggleable SVG analysis outline;
the original rendered pixels remain intact. Source/local smoke proof does
not substitute for the new worker's C1-C4 benchmark. Subsequent installed
Windows execution passed native host validation: 17 findings reviewed, seven
displayed crop references and nine measured position displays. Crop references
can share an element capture; they do not imply seven unique capture attempts.
All four displayed placement coordinates matched persisted numeric fields.
The official export was 4,660 bytes and passed validation. See DRY_RUN for the
exact installed package and report scope.

## Amendment: observed creative assets (2026-10-06)

The manifest includes a required `creativeImages` array. Each entry joins an
emitted reused-creative extra finding by ID and exact response URL and carries
the original fingerprinted raster bytes, MIME, dimensions, SHA-256 and time.
All callers and fixtures move to this shape; no legacy manifest path remains.
Reuse the already bounded response body instead of revisiting the image URL.
Keep only emitted group representatives at aggregation, under the existing
eight-page/250-KB-per-page image processing bound. Native validation also checks
the extra finding join before storing the session atomically. Official
`result.json` and `result_extra.json` remain unchanged and exclude image bytes.
Linux real-scanner/React and actual installed Windows execution passed
original-byte and decode checks. Windows displayed the64-by-64 observed asset,
kept official0/extra2 separation and saved a validated246-byte official file.
Current-worker Windows C1-C4 and paired capture-unavailable performance
acceptance passed. Complete official/failure objects remain identical with
zero image bytes in the injected-unavailable run. See PERF for actual byte,
memory and time measurements and limits; this is no universal performance claim.
