import { createHash } from "node:crypto";
import { SCAN_POLICY, type EvidenceAsset } from "@krds-detector/contracts";
import type { CreativeFingerprint } from "@krds-detector/evidence";
import type { CapturedVisualImage } from "./creative.js";

export const VISUAL_LIMITS = SCAN_POLICY.visual;

export interface ScheduledVisual { key: string; pageUrl: string; image: CapturedVisualImage; print: CreativeFingerprint }
const priority = (record: ScheduledVisual): number => (record.image.candidate.candidateEvidence.includes("ad-marker") ? 2 : 0)
  + (record.image.candidate.candidateEvidence.includes("external-destination") ? 1 : 0);
const compare = (a: ScheduledVisual, b: ScheduledVisual): number => priority(b) - priority(a)
  || a.image.sha256.localeCompare(b.image.sha256) || a.key.localeCompare(b.key);
const byteSize = (dataUrl: string): number => {
  const body = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return Math.floor(body.length * 3 / 4) - (body.endsWith("==") ? 2 : body.endsWith("=") ? 1 : 0);
};

/** One bounded reservoir owns already-acquired live bytes. Selection is a
 * deterministic set function, independent of page/response completion order.
 * No navigation/revisit occurs after capture. Unknown totals remain unknown.
 */
export class VisualScheduler {
  private records: ScheduledVisual[] = [];
  private rejected = 0;
  offer(pageUrl: string, images: CapturedVisualImage[], prints: CreativeFingerprint[]): void {
    const byPrint = new Map(prints.map((print) => [`${print.sha256}\0${print.sourceUrl}`, print]));
    const candidates = new Map(this.records.map((record) => [record.key, record]));
    // One page's acquisition is already bounded to eight images/250 KiB.
    for (const image of images) {
      const print = byPrint.get(`${image.sha256}\0${image.sourceUrl}`);
      if (!print) continue;
      const key = `${pageUrl}\0${image.candidate.frameUrl}\0${image.candidate.location}\0${image.sha256}`;
      candidates.set(key, { key, pageUrl, image, print });
    }
    const ordered = [...candidates.values()].sort(compare);
    const retained: ScheduledVisual[] = [];
    const assets = new Map<string, string>();
    let bytes = 0;
    for (const record of ordered) {
      const existing = assets.get(record.image.sha256);
      const cost = existing === undefined ? byteSize(record.image.dataUrl) : 0;
      if (retained.length >= VISUAL_LIMITS.retainedRecords || (existing === undefined && assets.size >= VISUAL_LIMITS.retainedAssets)
        || bytes + cost > VISUAL_LIMITS.retainedBytes) break;
      if (existing === undefined) { assets.set(record.image.sha256, record.image.dataUrl); bytes += cost; }
      // Shared strings avoid retaining repeated base64 payloads per occurrence.
      retained.push({ ...record, image: { ...record.image, dataUrl: assets.get(record.image.sha256)! } });
    }
    this.rejected += candidates.size - retained.length;
    this.records = retained;
  }
  retained(): readonly ScheduledVisual[] { return this.records; }
  /** Risk observations first, creative SHA tie-break, then page diversity.
   * One repeated creative consumes one OCR slot, independent of occurrences.
   */
  selectOcr(): ScheduledVisual[] {
    const bySha = new Map<string, ScheduledVisual>();
    for (const record of this.records) if (!bySha.has(record.image.sha256)) bySha.set(record.image.sha256, record);
    const unique = [...bySha.values()].sort(compare);
    const selected: ScheduledVisual[] = [];
    const pages = new Set<string>();
    for (const record of unique) {
      if (pages.has(record.pageUrl)) continue;
      selected.push(record); pages.add(record.pageUrl);
      if (selected.length === VISUAL_LIMITS.ocrImages) return selected;
    }
    for (const record of unique) {
      if (selected.includes(record)) continue;
      selected.push(record);
      if (selected.length === VISUAL_LIMITS.ocrImages) break;
    }
    return selected;
  }
  coverage(): { policy: string; retainedRecords: number; retainedAssets: number; retainedBytes: number; excludedRecords: number; ocrSha256: string[] } {
    const assets = new Map(this.records.map((record) => [record.image.sha256, record.image.dataUrl]));
    return { policy: "observed-risk+creative-sha+page-diversity/v1", retainedRecords: this.records.length, retainedAssets: assets.size,
      retainedBytes: [...assets.values()].reduce((sum, dataUrl) => sum + byteSize(dataUrl), 0), excludedRecords: this.rejected,
      ocrSha256: this.selectOcr().map((record) => record.image.sha256) };
  }
}

/** Shared JPEG bytes. Candidate metadata stores only references from capture
 * time onward. Deterministic hash eviction releases the bytes immediately.
 */
export class CaptureStore {
  private assets = new Map<string, EvidenceAsset>();
  add(bytes: Buffer): string | undefined {
    if (!bytes.length || bytes.length > 500_000) return undefined;
    const assetId = `capture-${createHash("sha256").update(bytes).digest("hex")}`;
    if (this.assets.has(assetId)) return assetId;
    const candidates = [...this.assets.values(), { assetId, mimeType: "image/jpeg" as const, dataUrl: `data:image/jpeg;base64,${bytes.toString("base64")}` }]
      .sort((a, b) => a.assetId.localeCompare(b.assetId));
    this.assets.clear();
    let total = 0;
    for (const asset of candidates) {
      const size = byteSize(asset.dataUrl);
      if (this.assets.size >= VISUAL_LIMITS.captureAssets || total + size > VISUAL_LIMITS.captureBytes) break;
      this.assets.set(asset.assetId, asset); total += size;
    }
    return this.assets.has(assetId) ? assetId : undefined;
  }
  has(assetId: string | undefined): boolean { return assetId !== undefined && this.assets.has(assetId); }
  values(): EvidenceAsset[] { return [...this.assets.values()]; }
}
