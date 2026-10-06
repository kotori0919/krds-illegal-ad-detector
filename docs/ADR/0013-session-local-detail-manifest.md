# ADR-0013: Bounded session-local detail manifest (2026-10-06)

Status: initial implementation; Linux worker path observed, Windows host and memory acceptance pending.

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
the official and detail results for a succeeded session. The React inspector
requests that bundle through `HostBridge`; the browser replay explicitly has
no real detail bundle.

## Tradeoff and acceptance

An in-memory data URL avoids a routable file endpoint, arbitrary paths, and
orphaned evidence files. Repeating the same image for several findings can
increase manifest size, so the host caps the full manifest at 8 MB. If the
4-vCPU/8-GB Windows benchmark shows unacceptable memory or transfer cost,
replace this representation with session-owned opaque asset IDs and validated
local files without changing `result.json`.

The L2 scanner test and Node worker CLI observed a real JPEG, CSS/geometry,
detail-to-official ID join, and failed-page coverage. The packaged Tauri
retrieval, 200% zoom rendering, crop/overlay alignment, cancellation cleanup,
and Windows memory/performance acceptance remain open. None of those are
inferred from a successful TypeScript suite.

The 2026-10-06 built-web smoke feeds the real municipal-site scan output into
the React workspace through a labelled IPC replay. All five JPEGs decoded in
the finding inspector and matched their detail records; coverage and export
preview matched the same scan. This verifies the data-to-inspector join without
claiming native Tauri retrieval or Windows rendering.
