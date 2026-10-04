# Domain model V2

Status: proposed internal Contract v0.2, frozen as a design decision on 2026-10-05. Type names and fields are migration targets; current source remains Contract v0 until Phase B.

## Boundaries

`OfficialResult` and `OfficialFinding` in `packages/contracts/src/result.ts` are the immutable contest serialization boundary: four technique values, raw `evidence_text`, exact `url` and `location`, unique `id`, and identity `(url, location, technique)`. `ExtraResult` is a separate output. Neither includes screenshot bytes, coverage, or explanatory UI text. Internal V2 records are session-scoped and must not be serialized into `result.json`.

| Entity | Identity and owner | Required meaning |
| --- | --- | --- |
| `ScanSession` | host-generated `sessionId` | Entry URL, started/finished timestamps, lifecycle state; not primary UI text. |
| `ScanProgress` | latest event for session | Measured counts and stage only; current page and meaningful activity may be a bounded event stream. |
| `ScanCoverage` | one per session | Checked, failed, skipped-by-limit counts; page issues and timing. Distinct from number of findings. |
| `ScanIssue` | session + page/frame URL + phase + reason | A page/frame that could not be inspected. Safe human-readable reason, optional bounded technical detail. |
| `OfficialFinding` | `(url, location, technique)` + exported ID | Contest finding summary and export source of truth. |
| `FindingDetail` | `(sessionId, findingId)` | Explanation, evidence, text transform, optional visual assets, related graph IDs. Detail refers to the same official finding ID. |
| `EvidenceGraph` | session | Observed resource/domain/creative relations; derived correlations remain distinct from ownership claims. |

## Target typed shape

```ts
type ScanIssueReason = "timeout" | "access-denied" | "connection" | "navigation" | "analysis" | "frame" | "other";
interface ScanIssue {
  url: string; phase: "crawl" | "analysis" | "frame";
  reason: ScanIssueReason; detail?: string;
}
interface ScanCoverage {
  sessionId: string; checkedPages: number; failedPages: number;
  skippedByLimit: number; issues: ScanIssue[];
  startedAt: string; finishedAt: string;
}
interface FindingSemanticExplanation {
  summary: string; observedAdSignals: string[];
  concealmentReason: string; // derived from stored technique evidence
  classification: "official";
}
interface FindingDetail {
  findingId: string; explanation: FindingSemanticExplanation;
  evidence: Evidence[]; textTransform?: { raw: string; interpreted: string };
  visual?: VisualEvidence; relatedNodeIds: string[];
}
```

`VisualEvidence` is defined in `EVIDENCE_MODEL.md`. Explanations are derived from the same captured `CandidateEvidence` that created the official finding, not reconstructed from the exported text alone. If an evidence field was not captured, leave it absent and state that in the UI; never populate it with a guessed value.

## HostBridge migration

Add `getFindingDetail(sessionId, findingId)`, `getScanCoverage(sessionId)`, and `getEvidenceGraph(sessionId)` to the bridge. The graph method is used only when the user opens 추가 분석/관계도, with a bounded payload or paging if real sessions exceed a chosen size limit. Visual assets use an opaque session-scoped asset ID and a narrow `getEvidenceAsset(sessionId, assetId)` retrieval; no page-controlled filesystem path reaches React. BrowserHost returns clearly marked replay records. TauriHost invokes narrow native commands backed by the persisted session manifest; no React view imports Tauri APIs. Return `undefined` only for truly absent records; use typed failures for unavailable/corrupt assets so the UI can explain recovery.

## Invariants and migration checks

- `FindingDetail.findingId` joins exactly one `OfficialFinding.id`; no orphan or duplicate detail. One element with two official techniques has two finding IDs and technique-specific reasons, possibly sharing one captured asset.
- Page grouping uses `OfficialFinding.url` as the affected public page key. Frame path is technical location. Distinct canonical URLs are not collapsed by display path.
- Coverage counts are computed from actual navigation/analysis outcomes; a page does not count as checked until its analysis finishes. A failed page may still have a crawl snapshot, but it is not silently treated as checked.
- Result and detail manifest must be persisted atomically enough that `succeeded` is never observable before the host can retrieve them. Event counts may lead the persisted result during running; the UI labels those counts provisional.
- Export always revalidates `OfficialResult`; coverage and detail never change the official JSON shape. Old v0 records, if loaded, show “상세 근거 없음” rather than fabricated V2 evidence.
