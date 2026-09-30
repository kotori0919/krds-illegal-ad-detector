/**
 * Contract v0 (frozen 2026-10-01): evidence graph + finding detail.
 *
 * The graph observes ad infrastructure (external domains are observed, never
 * recursively crawled). Finding detail separates observed / derived /
 * inference layers so the UI never renders inference as observation.
 */

export type EvidenceNodeKind =
  | "Page"
  | "Frame"
  | "Element"
  | "Resource"
  | "Creative"
  | "Domain"
  | "Redirect"
  | "Landing";

export interface EvidenceNode {
  id: string;
  kind: EvidenceNodeKind;
  url?: string;
  label: string;
}

export type EvidenceEdgeKind =
  | "CONTAINS"
  | "LOADS"
  | "EMBEDS"
  | "DISPLAYS"
  | "LINKS_TO"
  | "REDIRECTS_TO"
  | "SIMILAR_TO";

export interface EvidenceEdge {
  from: string;
  to: string;
  kind: EvidenceEdgeKind;
}

export interface GeometryEvidence {
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
}

export interface CssEvidence {
  opacity?: string;
  color?: string;
  backgroundColor?: string;
  display?: string;
  fontSize?: string;
  position?: string;
  raw: Record<string, string>;
}

/** Internal per-finding detail; result.json carries a lossless subset. */
export interface Evidence {
  rawText: string;
  normalizedText?: string;
  selector: string;
  framePath: string;
  css?: CssEvidence;
  geometry?: GeometryEvidence;
  resourceUrl?: string;
  resourceHost?: string;
  ocrText?: string;
  relatedNodeIds: string[];
}
