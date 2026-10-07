/**
 * Evidence graph builder (GOAL Phase 12, KODEX §25).
 *
 * Observes ad infrastructure from crawl snapshots without recursively
 * browsing uncontrolled sites. Node/edge vocabulary is the frozen contract;
 * wording discipline enforced at summary time ("correlated / related /
 * shared / recurring advertisement infrastructure" — never operator
 * identity).
 */
import type { EvidenceEdge, EvidenceEdgeKind, EvidenceNode, EvidenceNodeKind, EvidenceGraph,
  EvidenceGraphQuery, EvidenceGraphSlice, InfrastructureRelation } from "@krds-detector/contracts";

export type { EvidenceGraph } from "@krds-detector/contracts";

export interface GraphInput {
  pageUrl: string;
  links: string[];
  frames: { url: string }[];
  externals: { url: string; kind: "link" | "iframe" | "resource" | "redirect" }[];
  /** Exact advertisement witnesses; page adjacency alone never marks infrastructure. */
  adEvidence?: { findingId?: string; location?: string; resourceUrl?: string; destinationUrl?: string;
    creativeId?: string; reason: string }[];
}

function hostOf(url: string): string | undefined {
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
}

function compactNodeId(kind: string, key: string): string {
  let h = 0x811c9dc5;
  const s = `${kind}:${key}`;
  for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return `${kind.toLowerCase()}-${(h >>> 0).toString(16)}`;
}

export function buildEvidenceGraph(inputs: GraphInput[]): EvidenceGraph {
  const nodes = new Map<string, EvidenceNode>();
  const edges: EvidenceEdge[] = [];
  const edgeKeys = new Map<string, EvidenceEdge>();
  // Compare exact identities before deduplication. Common hashes retain one
  // key; only real collisions allocate a bucket and later receive suffixes.
  const identities = new Map<string, string | Map<string, string>>();
  const nodeId = (kind: string, key: string): string => {
    const compact = compactNodeId(kind, key);
    const prior = identities.get(compact);
    if (prior === undefined) { identities.set(compact, key); return compact; }
    if (typeof prior === "string") {
      if (prior === key) return compact;
      const distinct = `${compact}-1`;
      identities.set(compact, new Map([[prior, compact], [key, distinct]]));
      return distinct;
    }
    const existing = prior.get(key);
    if (existing) return existing;
    const distinct = `${compact}-${String(prior.size)}`;
    prior.set(key, distinct);
    return distinct;
  };
  const link = (from: string, to: string, kind: EvidenceEdgeKind, reason?: string): void => {
    if (from === to) return;
    const key = `${from}\0${to}\0${kind}`;
    let edge = edgeKeys.get(key);
    if (!edge) {
      edge = { from, to, kind };
      edgeKeys.set(key, edge);
      edges.push(edge);
    }
    if (reason) { edge.adRelated = true; edge.evidenceKinds = [...new Set([...(edge.evidenceKinds ?? []), reason])].sort(); }
  };
  const put = (node: EvidenceNode): string => {
    const prior = nodes.get(node.id);
    if (!prior) nodes.set(node.id, node);
    else if (node.adRelated) Object.assign(prior, node, { adRelated: true });
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
    for (const witness of input.adEvidence ?? []) {
      if (!witness.reason) continue;
      const elementKey = `${input.pageUrl}\0${witness.findingId ?? ""}\0${witness.location
        ?? witness.creativeId ?? witness.resourceUrl ?? witness.destinationUrl ?? witness.reason}`;
      const elementId = put({ id: nodeId("Element", elementKey), kind: "Element",
        label: witness.location ?? witness.resourceUrl ?? witness.destinationUrl ?? witness.reason,
        pageUrl: input.pageUrl, findingId: witness.findingId, adRelated: true });
      put({ id: pageId, kind: "Page", url: input.pageUrl, label: input.pageUrl, adRelated: true });
      link(pageId, elementId, "CONTAINS", witness.reason);
      let creativeId: string | undefined;
      if (witness.creativeId) {
        creativeId = put({ id: nodeId("Creative", witness.creativeId), kind: "Creative",
          label: witness.creativeId, creativeId: witness.creativeId, adRelated: true });
        link(elementId, creativeId, "DISPLAYS", witness.reason);
      }
      for (const [url, kind, edgeKind] of [
        [witness.resourceUrl, "Resource", "LOADS"],
        [witness.destinationUrl, "Landing", "LINKS_TO"],
      ] as const) {
        if (!url) continue;
        const host = hostOf(url);
        if (!host) continue;
        const referenceId = put({ id: nodeId(kind, url), kind, url, label: url, adRelated: true });
        // Keep the exact occurrence relation even when a shared creative has
        // sources on several domains. Summary attribution starts here.
        link(elementId, referenceId, edgeKind, witness.reason);
        if (kind === "Resource" && creativeId) link(creativeId, referenceId, "LOADS", witness.reason);
        const domainId = put({ id: nodeId("Domain", host), kind: "Domain", url: `https://${host}/`, label: host, adRelated: true });
        link(referenceId, domainId, "LINKS_TO", witness.reason);
      }
    }
  }
  // Canonicalize collision suffixes by exact key so resource completion order
  // cannot change node identity. Every already-built reference follows it.
  const canonicalIds = new Map<string, string>();
  for (const [compact, bucket] of identities) {
    if (typeof bucket === "string") continue;
    const ordered = [...bucket].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
    for (const [index, [, provisional]] of ordered.entries()) canonicalIds.set(provisional, `${compact}-${String(index)}`);
  }
  if (canonicalIds.size) {
    for (const node of nodes.values()) node.id = canonicalIds.get(node.id) ?? node.id;
    for (const edge of edges) {
      edge.from = canonicalIds.get(edge.from) ?? edge.from;
      edge.to = canonicalIds.get(edge.to) ?? edge.to;
    }
  }
  return { nodes: [...nodes.values()], edges };
}

/** Summarize exact witnessed references, independently of unrelated page resources. */
export function summarizeInfrastructure(graph: EvidenceGraph, entryHosts: string[] = []): InfrastructureRelation[] {
  const entrySet = new Set(entryHosts);
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const domainsByReference = new Map<string, EvidenceNode[]>();
  const relations = new Map<string, { nodeId: string; pages: Set<string>; evidenceKinds: Set<string> }>();
  for (const edge of graph.edges) {
    const target = nodes.get(edge.to);
    if (edge.adRelated && target?.kind === "Domain" && !entrySet.has(target.label)) {
      const domains = domainsByReference.get(edge.from) ?? [];
      domains.push(target);
      domainsByReference.set(edge.from, domains);
    }
  }
  for (const edge of graph.edges) {
    const source = nodes.get(edge.from);
    if (!edge.adRelated || source?.kind !== "Element" || !source.pageUrl) continue;
    for (const domain of domainsByReference.get(edge.to) ?? []) {
      let relation = relations.get(domain.label);
      if (!relation) { relation = { nodeId: domain.id, pages: new Set(), evidenceKinds: new Set() }; relations.set(domain.label, relation); }
      relation.pages.add(source.pageUrl);
      for (const reason of edge.evidenceKinds ?? []) relation.evidenceKinds.add(reason);
    }
  }
  return [...relations].map(([domain, relation]) => ({ domain, nodeId: relation.nodeId,
    pageUrls: [...relation.pages].sort(), evidenceKinds: [...relation.evidenceKinds].sort() }))
    .sort((a, b) => b.pageUrls.length - a.pageUrls.length || a.domain.localeCompare(b.domain));
}

/** Repetition is an extra finding only after exact advertisement correlation. */
export function summarizeCorrelatedInfrastructure(graph: EvidenceGraph, entryHosts: string[] = []): string[] {
  return summarizeInfrastructure(graph, entryHosts).filter((relation) => relation.pageUrls.length >= 2)
    .map((relation) => `recurring advertisement infrastructure: ${relation.domain} (observed on ${String(relation.pageUrls.length)} pages)`);
}

function bounded(name: string, value: number | undefined, fallback: number, maximum: number, minimum = 1): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${String(minimum)} and ${String(maximum)}`);
  }
  return value;
}

/**
 * Focus accepts node IDs or finding ID, page URL, creative SHA, domain host.
 * Traversal is undirected around the focus, at most two hops. Without a
 * focus, only explicitly advertisement-related nodes/edges are exposed.
 */
export function sliceEvidenceGraph(graph: EvidenceGraph, query: EvidenceGraphQuery = {}): EvidenceGraphSlice {
  const maxNodes = bounded("maxNodes", query.maxNodes, 100, 250);
  const maxEdges = bounded("maxEdges", query.maxEdges, 200, 500, 0);
  const depth = bounded("depth", query.depth, 2, 2, 0);
  const focus = query.focus;
  if (focus !== undefined && (!focus || typeof focus !== "object"
    || !["finding", "page", "creative", "domain"].includes(focus.kind)
    || typeof focus.id !== "string" || !focus.id.trim())) {
    throw new Error("invalid graph focus: kind must be finding, page, creative or domain and id must be non-empty text");
  }
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const sortedNodes = [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id));
  const edges = graph.edges.filter((edge) => nodes.has(edge.from) && nodes.has(edge.to))
    .sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to) || a.kind.localeCompare(b.kind));
  const matches = (node: EvidenceNode): boolean => {
    if (!focus) return node.adRelated === true;
    if (node.id === focus.id) return true;
    switch (focus.kind) {
      case "finding": return node.findingId === focus.id;
      case "page": return node.kind === "Page" && node.url === focus.id;
      case "creative": return node.kind === "Creative" && node.creativeId === focus.id;
      case "domain": return node.kind === "Domain" && node.label === focus.id;
    }
  };
  const seeds = sortedNodes.filter(matches);
  if (!seeds.length) return { nodes: [], edges: [], truncated: false };
  const selected = new Set<string>();
  let truncated = false;
  const add = (id: string): boolean => {
    if (selected.has(id)) return false;
    if (selected.size >= maxNodes) { truncated = true; return false; }
    selected.add(id); return true;
  };
  const traversable = focus ? edges : edges.filter((edge) => edge.adRelated);
  const adjacency = new Map<string, Set<string>>();
  for (const edge of traversable) {
    for (const [from, to] of [[edge.from, edge.to], [edge.to, edge.from]]) {
      const neighbors = adjacency.get(from!) ?? new Set<string>();
      neighbors.add(to!); adjacency.set(from!, neighbors);
    }
  }
  let frontier = seeds.filter((node) => add(node.id)).map((node) => node.id);
  for (let hop = 0; hop < depth && frontier.length; hop += 1) {
    const next = new Set<string>();
    for (const id of frontier) for (const neighbor of [...(adjacency.get(id) ?? [])].sort()) {
      if (add(neighbor)) next.add(neighbor);
    }
    frontier = [...next].sort();
  }
  const selectedEdges = traversable.filter((edge) => selected.has(edge.from) && selected.has(edge.to));
  return { nodes: sortedNodes.filter((node) => selected.has(node.id)), edges: selectedEdges.slice(0, maxEdges),
    truncated: truncated || selectedEdges.length > maxEdges };
}
