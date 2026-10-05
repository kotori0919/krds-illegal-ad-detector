/** Contract v0.2: session-local evidence, separate from official result.json. */
import type { OfficialTechnique } from "./technique.js";
import type { OfficialResult, ValidationOutcome } from "./result.js";

export interface FindingDetail {
  findingId: string;
  url: string;
  location: string;
  technique: OfficialTechnique;
  rawText: string;
  normalizedText: string;
  matchedTerms: string[];
  techniqueReason: string;
  destinationUrl?: string;
  observed: {
    box: { x: number; y: number; width: number; height: number };
    css: { color: string; backgroundColor: string; opacity: string; display: string; fontSize: string; position: string };
  };
  visual: {
    state: "available" | "unavailable";
    reason?: "budget" | "capture-error";
    capturedAt?: string;
    mimeType?: "image/jpeg";
    dataUrl?: string;
    viewport?: { width: number; height: number; scrollX: number; scrollY: number };
  };
}

export interface ScanCoverage {
  checkedPages: number;
  failedPages: { url: string; status: number; reason: string }[];
  timedOut: boolean;
}

export interface ScanDetailBundle {
  version: 2;
  findings: FindingDetail[];
  coverage: ScanCoverage;
}

/** Check the ID join and bounded image representation before host transfer. */
export function validateScanDetailBundle(bundle: ScanDetailBundle, official: OfficialResult): ValidationOutcome {
  const errors: string[] = [];
  if (bundle.version !== 2) errors.push("detail version must be 2");
  if (bundle.findings.length !== official.findings.length) errors.push("detail finding count mismatch");
  const byId = new Map(bundle.findings.map((detail) => [detail.findingId, detail]));
  if (byId.size !== bundle.findings.length) errors.push("detail finding IDs duplicated");
  for (const finding of official.findings) {
    const detail = byId.get(finding.id);
    if (!detail) { errors.push(`detail missing ${finding.id}`); continue; }
    if (detail.url !== finding.url || detail.location !== finding.location
      || detail.technique !== finding.technique || detail.rawText !== finding.evidence_text) {
      errors.push(`detail identity mismatch ${finding.id}`);
    }
    if (detail.visual.state === "available") {
      if (detail.visual.mimeType !== "image/jpeg"
        || !detail.visual.dataUrl?.startsWith("data:image/jpeg;base64,")
        || detail.visual.dataUrl.length > 700_000) errors.push(`detail visual invalid ${finding.id}`);
    } else if (detail.visual.dataUrl) errors.push(`unavailable detail has image ${finding.id}`);
  }
  if (bundle.coverage.failedPages.length > bundle.coverage.checkedPages) errors.push("failed pages exceed checked pages");
  return { ok: errors.length === 0, errors };
}
