import type { OfficialFinding, OfficialTechnique } from "@krds-detector/contracts";

/** Management projection only. Never serialized into the official result. */
export interface ReviewPattern {
  id: string;
  key: string;
  summary: string;
  technique: OfficialTechnique;
  destination?: string;
  destinationSource?: "selector";
  findings: OfficialFinding[];
  pageUrls: string[];
}

export function normalizeReviewText(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}

function site(url: string): string {
  try { return new URL(url).origin; } catch { return url; }
}

/** Only an explicit href in the recorded selector is evidence of a link.
 * Keep its provenance: bare JSON does not contain a measured DOM destination. */
function selectorDestination(finding: OfficialFinding): string | undefined {
  const localSelector = finding.location.split(">>>").at(-1) ?? finding.location;
  const href = /\[href=["']([^"']+)["']\]/u.exec(localSelector)?.[1];
  if (!href) return undefined;
  // Relative destinations inside a frame cannot be resolved against the page.
  const frame = [...finding.location.matchAll(/iframe\[src=["']([^"']+)["']\]/gu)].at(-1)?.[1];
  try {
    const url = new URL(href, frame ? new URL(frame, finding.url) : finding.url);
    return ["http:", "https:"].includes(url.protocol) ? url.href : undefined;
  } catch { return undefined; }
}

function patternId(key: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const char of key) hash = BigInt.asUintN(64, (hash ^ BigInt(char.codePointAt(0)!)) * 0x100000001b3n);
  return `pattern-${hash.toString(16).padStart(16, "0")}`;
}

/** Conservative selector families: identical selector/frame chain only.
 * Do not erase classes, indices, frame resources, or query parameters: those
 * may distinguish legitimate content from a shared template. */
export function groupReviewPatterns(findings: readonly OfficialFinding[]): ReviewPattern[] {
  const groups = new Map<string, ReviewPattern>();
  for (const finding of findings) {
    const summary = normalizeReviewText(finding.evidence_text);
    const destination = selectorDestination(finding);
    const key = JSON.stringify([site(finding.url), finding.technique, summary, destination ?? null, finding.location]);
    let group = groups.get(key);
    if (!group) {
      group = { id: patternId(key), key, summary, technique: finding.technique, findings: [], pageUrls: [],
        ...(destination ? { destination, destinationSource: "selector" as const } : {}) };
      groups.set(key, group);
    }
    group.findings.push(finding);
  }
  for (const group of groups.values()) {
    group.findings.sort((a, b) => a.url.localeCompare(b.url) || a.location.localeCompare(b.location) || a.id.localeCompare(b.id, "en", { numeric: true }));
    group.pageUrls = [...new Set(group.findings.map((finding) => finding.url))].sort();
  }
  return [...groups.values()].sort((a, b) => b.findings.length - a.findings.length || a.key.localeCompare(b.key));
}
