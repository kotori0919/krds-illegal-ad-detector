import { SCAN_POLICY, findingIdentityKey } from "@krds-detector/contracts";
import { normalizeUrlKey } from "@krds-detector/scanner";
import type { DecidedCandidate } from "./pipeline.js";

interface Retained { key: string; order: string; candidate: DecidedCandidate; pageUrl: string; bytes: number }

/** Owns long-lived official candidates. Never truncates source text. A stable
 * prefix makes complete static-scope selection independent of worker order.
 * Byte accounting covers serialized pre-visual evidence, not physical RSS.
 */
export class CandidateAccumulator {
  private records = new Map<string, Retained>();
  private limitedPages = new Set<string>();
  private bytes = 0;
  offer(candidates: DecidedCandidate[], pageUrl: string): void {
    const proposed = new Map(this.records);
    for (const candidate of candidates) {
      const key = findingIdentityKey({ url: candidate.url, location: candidate.location, technique: candidate.technique.technique });
      const previous = proposed.get(key);
      if (previous && previous.candidate.technique.rawText <= candidate.technique.rawText) continue;
      proposed.set(key, { key, candidate, pageUrl,
        order: `${normalizeUrlKey(candidate.url)}\0${candidate.location}\0${candidate.technique.technique}\0${candidate.technique.rawText}`,
        bytes: Buffer.byteLength(JSON.stringify({ candidate, pageUrl }), "utf8") });
    }
    const ordered = [...proposed.values()].sort((a,b)=>a.order < b.order ? -1 : a.order > b.order ? 1 : 0);
    const retained = new Map<string, Retained>();
    let bytes = 0;
    let full = false;
    for (const record of ordered) {
      if (full || retained.size >= SCAN_POLICY.evidence.findings || bytes + record.bytes > SCAN_POLICY.evidence.retainedBytes) {
        full = true; this.limitedPages.add(record.pageUrl); continue;
      }
      retained.set(record.key, record); bytes += record.bytes;
    }
    this.records = retained; this.bytes = bytes;
  }
  contains(candidate: DecidedCandidate): boolean {
    return this.records.get(findingIdentityKey({ url: candidate.url, location: candidate.location, technique: candidate.technique.technique }))?.candidate === candidate;
  }
  pageOf(candidate: DecidedCandidate): string | undefined {
    return this.records.get(findingIdentityKey({ url: candidate.url, location: candidate.location, technique: candidate.technique.technique }))?.pageUrl;
  }
  values(): DecidedCandidate[] { return [...this.records.values()].map((record) => record.candidate); }
  coverage(): { retainedFindings: number; retainedEvidenceBytes: number; limitedPages: readonly string[] } {
    return { retainedFindings: this.records.size, retainedEvidenceBytes: this.bytes, limitedPages: [...this.limitedPages].sort() };
  }
}
