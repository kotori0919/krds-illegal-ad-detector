/** Session-scoped operator reads. Metadata never embeds image bytes or paths. */
import type { CreativeImage, FindingDetail, ImageAnalysis, PageOutcome, ScanCoverage } from "./detail.js";
import type { EvidenceEdge, EvidenceNode } from "./evidence.js";

export type VisualSourceKind = "img" | "background-image" | "svg" | "canvas";

export interface EvidenceAsset {
  assetId: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  dataUrl: string;
}

export type FindingDetailView = Omit<FindingDetail, "visual"> & {
  visual: Omit<FindingDetail["visual"], "dataUrl" | "element"> & {
    assetId?: string;
    element?: { state: "available"; capturedAt: string; mimeType: "image/jpeg"; assetId: string;
      box: { x: number; y: number; width: number; height: number } }
      | { state: "unavailable"; reason: "budget" | "capture-error" | "outside-viewport" | "target-unavailable" };
  };
};

export type CreativeImageView = Omit<CreativeImage, "dataUrl"> & { assetId: string };

export interface ScanCoverageView {
  coverage: ScanCoverage;
  pageOutcomes: PageOutcome[];
}

export interface ImageAnalysisQuery { cursor?: number; limit?: number; pageUrl?: string; extraFindingId?: string }
export interface ImageAnalysisPage { items: ImageAnalysis[]; total: number; nextCursor?: number }

export interface InfrastructureRelation {
  domain: string;
  nodeId: string;
  pageUrls: string[];
  evidenceKinds: string[];
}

export interface EvidenceSummary {
  graphAvailable?: boolean;
  analysisIssues?: string[];
  observedDomainCount: number;
  infrastructure: InfrastructureRelation[];
  imageAnalysisCount: number;
  creativeImages: CreativeImageView[];
}

export interface EvidenceGraph { nodes: EvidenceNode[]; edges: EvidenceEdge[] }
export interface EvidenceGraphQuery {
  focus?: { kind: "finding" | "page" | "creative" | "domain"; id: string };
  maxNodes?: number;
  maxEdges?: number;
  depth?: number;
}
export interface EvidenceGraphSlice extends EvidenceGraph { truncated: boolean }
