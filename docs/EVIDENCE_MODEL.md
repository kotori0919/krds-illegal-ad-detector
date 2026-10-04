# Evidence model V2

Status: design freeze, 2026-10-05. Actual scanner currently returns `OfficialFinding` only; this document specifies the Phase B/D persistence and retrieval design.

## What the inspector can assert

1. **무엇을 발견했나요?** `OfficialFinding.technique`, unmodified `evidence_text`, and `url` are observed/exported facts.
2. **왜 문제인가요?** A Korean explanation combines stored illegal-ad semantic signals and technique evidence. For 투명 텍스트, explain the captured computed style/ancestor visibility; for 화면 밖 은닉, explain measured element versus viewport. For 닮은꼴 글자 위장 and 자모 분해, display `rawText → interpretedText`. Highlight changed segments only when a reliable aligned mapping exists; otherwise show two labelled strings without artificial highlighting.
3. **기술 정보** expands selector, frame path, computed CSS, geometry, normalized text, OCR, resource URLs, model verdict, and graph relation. Each is labelled observed, derived, or inferred. A model score is never the primary reason and never represented as a direct observation.

The explanation is generated from persisted `CandidateEvidence` during scan finalization. A template keyed only by technique is insufficient: it could claim transparency or offscreen position that the actual evidence did not prove. Keep evidence fields for each official finding, including an explicit unavailable reason when optional visual capture fails.

## Visual artifact contract

```ts
interface VisualEvidence {
  captureState: "available" | "unavailable";
  unavailableReason?: "budget" | "detached" | "navigation" | "unsupported" | "capture-error";
  capturedAt?: string;
  pageAssetId?: string;       // opaque ID, scoped to session
  elementAssetId?: string;    // optional crop of the actual rendered element
  boundingBox?: GeometryEvidence; // page/viewport coordinates documented below
  viewport?: { width: number; height: number; scrollX: number; scrollY: number };
  elementOutsideViewport?: boolean;
  overlay?: { kind: "analysis-location"; boundingBox: GeometryEvidence };
}
```

The scan worker records pixel artifacts and metadata in a session-local evidence directory; the native host maps opaque IDs to files inside that directory, enforces session ownership and size/type checks, and sends an app-safe image URL or bytes. Untrusted page content cannot choose a local path. Assets are never embedded in `result.json`. A page screenshot and crop may be shared by duplicate findings at the same location; the manifest references it by ID.

## Capture sequence and budget

The existing scan analyzes live Playwright pages after crawl. During that same live page, retain the element handle and its computed style/geometry only for candidates that pass both the illegal-ad gate and an official concealment gate. After result identity dedup, capture at most one relevant viewport screenshot and one crop per unique location, subject to a configured per-session time/byte cap. Record cap exhaustion as `unavailableReason="budget"`; never block the official finding or export. A detached element, failed screenshot, zero-size box, or browser close is recorded as unavailable, not silently replaced with a mock.

Transparent text needs the ordinary rendered viewport plus a clearly labelled analysis outline at the measured location; do not alter the screenshot pixels and call that the rendered page. For offscreen elements, a viewport image alone cannot show the element: provide measured bounds relative to viewport and, if technically possible within budget, a separate element crop labelled as an analysis capture. An image advertisement extra finding may use the actual image crop only when the image pipeline produces it; current text-only official detection does not support claiming image-ad capture.

Coordinate origin, scroll offsets, device scale, and frame path must be stored with the capture so an overlay is not drawn at the wrong place. If the candidate sits in an iframe, capture the containing page and store frame geometry or show a reason precise overlay is unavailable. Original page URL and capture timestamp are displayed; external ad URLs are text only and never opened automatically.

## Evidence graph

The existing `EvidenceNode`/`EvidenceEdge` core remains. The inspector may show related observed nodes for a finding; 추가 분석 may offer a bounded full graph view on demand. “반복적으로 관측된 도메인” or “공유 기술 지표” is defensible when edges support it. “동일 운영자” is not. Graph retrieval is lazy and outside crawl hot path; expensive correlation belongs after collection. The official result list and counts never include `ExtraFinding`.

## Integrity checks

Every available asset ID resolves to a real file captured for the same session and maps to the recorded finding location. Missing/corrupt assets show an unavailable state and do not break `result.json`. A visual test must compare capture metadata with a known rendered page; a mocked URL or static decorative screenshot is not acceptance evidence. Budget overhead is measured separately from crawl/detection time in `TEST_STRATEGY_V2.md`.
