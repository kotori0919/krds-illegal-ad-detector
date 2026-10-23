/** Operational import/batch metadata, never part of result.json. */
export interface ImportedTarget {
  label: string;
  entryUrl: string;
  kind: "site" | "sitemap";
}

export interface ImportRow {
  row: number;
  target?: ImportedTarget;
  status: "valid" | "invalid" | "duplicate";
  reason?: string;
}

export interface TargetPreview {
  rows: ImportRow[];
  valid: number;
  invalid: number;
  duplicate: number;
  format: "xlsx" | "csv" | "jsonl" | "xml";
}
import type { ScanRequest } from "./scan.js";

/** File intake has a separate native command with mandatory public networking. */
export interface BatchScanRequest extends ScanRequest { kind: "site" | "sitemap" }
