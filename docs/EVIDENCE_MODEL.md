# Evidence model V2

Status: Contract v0.2 visual-evidence extension in progress, 2026-10-06. The scanner now
returns `OfficialFinding` plus a separately validated `ScanDetailBundle`.
The Node worker writes the bundle separately from `result.json`; the Tauri
host code reads and joins it atomically to the official result. The worker
path and inspector were executed locally. Earlier viewport-only Windows
acceptance is in DRY_RUN. The new crop/position fields passed actual installed
Windows host retrieval, rendering and export. Current-worker Windows concurrency
measurements passed the same200-page C1-C4 and paired capture-unavailable
scenarios. Image-creative asset presentation has now
passed actual installed Windows retrieval, original-byte/decode checks and
rendering, separately from official export.

## What the inspector can assert

1. **무엇을 발견했나요?** `OfficialFinding.technique`, unmodified `evidence_text`, and `url` are observed/exported facts.
2. **왜 문제인가요?** A Korean explanation combines stored illegal-ad semantic signals and technique evidence. For 투명 텍스트, explain the captured computed style/ancestor visibility; for 화면 밖 은닉, explain measured element versus viewport. For 닮은꼴 글자 위장 and 자모 분해, display `rawText → interpretedText`. Highlight changed segments only when a reliable aligned mapping exists; otherwise show two labelled strings without artificial highlighting.
3. **기술 정보** expands selector, frame path, computed CSS, geometry, normalized text, OCR, resource URLs, model verdict, and graph relation. Each is labelled observed, derived, or inferred. A model score is never the primary reason and never represented as a direct observation.

The inspector uses stored matched terms, normalized text, technique reason,
computed CSS, geometry, and actual viewport capture when available. The
Korean lead sentence still names the technique generically; the stored detail
supports it. Keep an explicit unavailable reason when optional capture fails.

## Visual artifact contract

```ts
type Rect = { x: number; y: number; width: number; height: number };
interface VisualEvidence {
  state: "available" | "unavailable";
  reason?: "budget" | "capture-error";
  capturedAt?: string;
  mimeType?: "image/jpeg";
  dataUrl?: string; // bounded JPEG in the session-local detail manifest
  viewport?: { width: number; height: number; scrollX: number; scrollY: number; deviceScaleFactor: number };
  target?: { state: "available"; coordinateSpace: "main-viewport"; box: Rect }
    | { state: "unavailable"; reason: "target-unavailable" };
  element?: { state: "available"; capturedAt: string; mimeType: "image/jpeg"; dataUrl: string; box: Rect }
    | { state: "unavailable"; reason: "budget" | "capture-error" | "outside-viewport" | "target-unavailable" };
}
```

The initial implementation embeds bounded JPEG data URLs in the **separate**
session-local detail manifest. It captures at most six pages, at most 500 KB
per image and 2 MB of embedded JPEG bytes before base64 expansion, counting
each finding's copy of a page image. The host rejects manifests above
8 MB and validates every ID, URL, location, technique, raw text, image scheme,
and coverage count against the official result. The official `result.json`
never contains image bytes. This avoids arbitrary filesystem asset paths but
keeps the manifest in process memory; asset IDs and streaming may replace it
if the Windows memory benchmark shows a need. The base64 representation is
measured on the current Windows worker, including a paired same200-page capture
comparison. See PERF for byte counts, memory, failure behavior and scope.

## Capture sequence and budget

V2 analyzes each page during its single navigation. The pipeline records
computed style and geometry for candidates that pass both gates. After live
page and frame detection, the scanner captures at most one viewport JPEG for
that page, subject to the byte/page caps and shared `ScanDeadline`; candidates
on the same page share it. Capture exhaustion is `reason="budget"`; a
Playwright failure is `reason="capture-error"`. Neither blocks the official
finding. Available viewport captures now require target and element-capture
states in both JavaScript and native validation. Up to six unique element
regions per scan are captured from the existing live Page, within the same
2 MB serialized-copy budget; shared elements reuse their capture across
techniques. The crop is the rendered page region at the element's measured
location, clipped to the main viewport and containing frame bounds. It does
not scroll, rewrite opacity or reveal pixels that were not rendered.

Locator text must still match the detected raw text. Main-viewport bounds are
read before and after the page capture; a changed viewport/scroll or target
does not receive a precise placement claim. Crop bounds are checked again
after capture. Live child-frame locator boxes use Playwright's main-frame
coordinates; the original official frame chain and frame-local analysis box
are retained separately. An element outside its visible containing viewport
gets an explicit outside-viewport state instead of an invented crop.

The inspector keeps the rendered page JPEG intact. A keyboard-operated
"분석 위치 표시" control adds a separately labelled SVG outline in its recorded
main-viewport coordinate space, with detected text outside the image. The
element-region JPEG is separately labelled. No fabricated screenshot or
edited page pixels are used.

## Image-based extra findings

The session manifest now includes required `creativeImages`, separate from
official and extra result exports. Each image joins exactly one
`REUSED_AD_CREATIVE` finding by ID and the observed response URL. Its SHA-256,
decoded dimensions, MIME type and capture timestamp identify the same body used
for the perceptual fingerprint. Only PNG, JPEG and WebP data URLs are accepted.
The scanner reuses the bounded, already observed response body; it performs no
additional image fetch. At most eight admitted pages contribute, with 250 KB
per page and eight fingerprints per page. Only representatives of emitted
creative findings survive final aggregation. The JavaScript and native host
reject duplicate IDs, wrong URL/category joins, invalid image representations,
more than 64 assets or 2,670,000 image characters. The full manifest retains
its 8 MB native limit.

The extra-analysis list displays the actual collected image, labelled separately
from viewport and element-region captures. Loading, failed retrieval and absent
capture remain explicit. Linux scanner-to-React execution decoded the stored
64-by-64 asset, checked exact source bytes and preserved official0/extra2
separation. Installed Windows execution also passed the same original-byte and
decode checks, displayed the actual asset and saved a validated246-byte official
zero-result file. Current-worker Windows scenario performance acceptance passed;
full V2 strict UX release acceptance remains open.

Transparent text needs the ordinary rendered viewport plus a clearly labelled analysis outline at the measured location; do not alter the screenshot pixels and call that the rendered page. For offscreen elements, a viewport image alone cannot show the element: provide measured bounds relative to viewport and, if technically possible within budget, a separate element crop labelled as an analysis capture. An image advertisement extra finding may use the actual image crop only when the image pipeline produces it; current text-only official detection does not support claiming image-ad capture.

Coordinate origin, scroll offsets, device scale, and frame path must be stored with the capture so an overlay is not drawn at the wrong place. If the candidate sits in an iframe, capture the containing page and store frame geometry or show a reason precise overlay is unavailable. Original page URL and capture timestamp are displayed; external ad URLs are text only and never opened automatically.

Inspect available live Playwright `Frame` objects directly during the containing page's work item. Preserve absolute frame `src`, ancestor selector chain, and official `>>>` serialization. Bound frame count, depth, and time by the same page/deadline limits. A cross-origin frame that Playwright can inspect remains eligible; an inaccessible/detached frame becomes a typed coverage issue. Do not navigate a fresh Page to every frame URL solely to recover content.

## Evidence graph

The existing `EvidenceNode`/`EvidenceEdge` core remains. The inspector may show related observed nodes for a finding; 추가 분석 may offer a bounded full graph view on demand. “반복적으로 관측된 도메인” or “공유 기술 지표” is defensible when edges support it. “동일 운영자” is not. Graph retrieval is lazy and outside crawl hot path; expensive correlation belongs after collection. The official result list and counts never include `ExtraFinding`.

## Integrity checks

Each manifest detail joins an official finding by ID and the exact exported
URL/location/technique/raw text. A live L2 test decoded JPEG magic bytes from
every available image and checked the CSS, normalized text, and failed-page
coverage. A viewport image alone cannot locate a hidden element; the inspector
states that limit. A future visual acceptance test must compare pixel content
and location metadata with a known rendered page on Windows. Capture overhead
remains to be measured separately there.
