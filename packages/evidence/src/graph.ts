/**
 * Evidence graph builder (GOAL Phase 12, KODEX §25).
 *
 * Observes ad infrastructure from crawl snapshots without recursively
 * browsing uncontrolled sites. Node/edge vocabulary is the frozen contract;
 * wording discipline enforced at summary time ("correlated / related /
 * shared / recurring advertisement infrastructure" — never operator
 * identity).
 */
import type { EvidenceEdge, EvidenceEdgeKind, EvidenceNode, EvidenceNodeKind } from "@krds-detector/contracts";

export interface GraphInput {
  pageUrl: string;
  links: string[];
  frames: { url: string }[];
  externals: { url: string; kind: "link" | "iframe" | "resource" | "redirect" }[];
}

function hostOf(url: string): string | undefined {
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
}

function nodeId(kind: string, key: string): string {
  let h = 0x811c9dc5;
  const s = `${kind}:${key}`;
  for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return `${kind.toLowerCase()}-${(h >>> 0).toString(16)}`;
}

export interface EvidenceGraph {
  nodes: EvidenceNode[];
  edges: EvidenceEdge[];
}

export function buildEvidenceGraph(inputs: GraphInput[]): EvidenceGraph {
  const nodes = new Map<string, EvidenceNode>();
  const edges: EvidenceEdge[] = [];
  const link = (from: string, to: string, kind: EvidenceEdgeKind): void => {
    if (from === to) return;
    if (!edges.some((e) => e.from === from && e.to === to && e.kind === kind)) {
      edges.push({ from, to, kind });
    }
  };
  const put = (node: EvidenceNode): string => {
    const prior = nodes.get(node.id);
    if (!prior) nodes.set(node.id, node);
    return node.id;
  };

  for (const input of inputs) {
    const pageId = put({ id: nodeId("Page", input.pageUrl), kind: "Page", url: input.pageUrl, label: input.pageUrl });
    const pageHost = hostOf(input.pageUrl);
    if (pageHost) {
      const domainId = put({ id: nodeId("Domain", pageHost), kind: "Domain", url: `https://${pageHost}/`, label: pageHost });
      link(pageId, domainId, "LINKS_TO");
    }
    for (const frame of input.frames) {
      const frameId = put({ id: nodeId("Frame", frame.url), kind: "Frame", url: frame.url, label: frame.url });
      link(pageId, frameId, "EMBEDS");
      const frameHost = hostOf(frame.url);
      if (frameHost && frameHost !== pageHost) {
        const domainId = put({ id: nodeId("Domain", frameHost), kind: "Domain", url: `https://${frameHost}/`, label: frameHost });
        link(frameId, domainId, "LINKS_TO");
      }
    }
    for (const raw of input.links) {
      const host = hostOf(raw);
      if (!host) continue;
      if (host === pageHost) {
        const targetId = put({ id: nodeId("Page", raw), kind: "Page", url: raw, label: raw });
        link(pageId, targetId, "LINKS_TO");
      } else {
        const landingId = put({ id: nodeId("Landing", raw), kind: "Landing", url: raw, label: raw });
        link(pageId, landingId, "LINKS_TO");
        const domainId = put({ id: nodeId("Domain", host), kind: "Domain", url: `https://${host}/`, label: host });
        link(landingId, domainId, "LINKS_TO");
      }
    }
    for (const ext of input.externals) {
      const kind: EvidenceNodeKind =
        ext.kind === "iframe" ? "Frame" : ext.kind === "redirect" ? "Redirect" : ext.kind === "resource" ? "Resource" : "Landing";
      const id = put({ id: nodeId(kind, ext.url), kind, url: ext.url, label: ext.url });
      link(pageId, id, ext.kind === "redirect" ? "REDIRECTS_TO" : ext.kind === "iframe" ? "EMBEDS" : ext.kind === "resource" ? "LOADS" : "LINKS_TO");
      const host = hostOf(ext.url);
      if (host) {
        const domainId = put({ id: nodeId("Domain", host), kind: "Domain", url: `https://${host}/`, label: host });
        link(id, domainId, "LINKS_TO");
      }
    }
  }
  return { nodes: [...nodes.values()], edges };
}

/** Correlated infrastructure summary with disciplined wording. */
export function summarizeCorrelatedInfrastructure(graph: EvidenceGraph, entryHosts: string[] = []): string[] {
  const entrySet = new Set(entryHosts);
  const byDomain = new Map<string, number>();
  for (const node of graph.nodes) {
    if (node.kind !== "Domain") continue;
    if (entrySet.has(node.label)) continue;
    const refs = graph.edges.filter((e) => e.to === node.id).length;
    byDomain.set(node.label, refs);
  }
  return [...byDomain.entries()]
    .filter(([, refs]) => refs >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([domain, refs]) => `recurring advertisement infrastructure: ${domain} (referenced ${String(refs)} times)`);
}
