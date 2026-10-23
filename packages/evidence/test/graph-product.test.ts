import { describe, expect, it } from "vitest";
import type { EvidenceGraph, EvidenceGraphQuery } from "@krds-detector/contracts";
import { buildEvidenceGraph, sliceEvidenceGraph, summarizeInfrastructure, summarizeCorrelatedInfrastructure } from "../src/graph.js";

describe("ad-correlated infrastructure", () => {
  it("keeps repeated CDN, font and analytics observations out of ad summaries", () => {
    const graph = buildEvidenceGraph(["a", "b"].map((page) => ({
      pageUrl: `https://site.example/${page}`, links: [], frames: [], externals: [
        { url: "https://cdn.example/framework.js", kind: "resource" as const },
        { url: "https://font.example/font.woff2", kind: "resource" as const },
        { url: "https://analytics.example/count.js", kind: "resource" as const },
      ],
    })));
    expect(graph.nodes.filter((node) => node.kind === "Domain").map((node) => node.label).sort())
      .toEqual(["analytics.example", "cdn.example", "font.example", "site.example"]);
    expect(summarizeCorrelatedInfrastructure(graph, ["site.example"])).toEqual([]);
  });

  it("counts exact advertisement witnesses once per page without leaking unrelated page resources", () => {
    const graph = buildEvidenceGraph(["a", "b"].map((page) => ({
      pageUrl: `https://site.example/${page}`, links: [], frames: [], externals: [
        { url: "https://cdn.example/framework.js", kind: "resource" as const },
        { url: "https://ads.example/banner.png", kind: "resource" as const },
      ], adEvidence: [
        { findingId: `f-${page}`, location: "#ad", destinationUrl: "https://destination.example/join", reason: "official-finding" },
        { creativeId: "sha-one", resourceUrl: "https://ads.example/banner.png", reason: "ocr-positive" },
        { creativeId: "sha-one", resourceUrl: "https://ads.example/banner.png", reason: "repeated-creative" },
      ],
    })));
    const summaries = summarizeInfrastructure(graph, ["site.example"]);
    expect(summaries.map(({ domain, pageUrls, evidenceKinds }) => ({ domain, pageUrls, evidenceKinds }))).toEqual([
      { domain: "ads.example", pageUrls: ["https://site.example/a", "https://site.example/b"], evidenceKinds: ["ocr-positive", "repeated-creative"] },
      { domain: "destination.example", pageUrls: ["https://site.example/a", "https://site.example/b"], evidenceKinds: ["official-finding"] },
    ]);
    expect(summarizeCorrelatedInfrastructure(graph, ["site.example"])).toHaveLength(2);
    const relatedDomains = new Set(graph.edges.filter((edge) => edge.adRelated)
      .map((edge) => graph.nodes.find((node) => node.id === edge.to)).filter((node) => node?.kind === "Domain").map((node) => node!.label));
    expect(relatedDomains).toEqual(new Set(["ads.example", "destination.example"]));
  });

  it("shows one-page related infrastructure without creating a repetition extra", () => {
    const graph = buildEvidenceGraph([{ pageUrl: "https://site.example/a", links: [], frames: [], externals: [],
      adEvidence: [{ findingId: "f1", location: "#ad", destinationUrl: "https://ads.example/join", reason: "official-finding" }],
    }]);
    expect(summarizeInfrastructure(graph, ["site.example"]).map(({ domain, pageUrls }) => ({ domain, pageUrls })))
      .toEqual([{ domain: "ads.example", pageUrls: ["https://site.example/a"] }]);
    expect(summarizeCorrelatedInfrastructure(graph, ["site.example"])).toEqual([]);
    expect(summarizeInfrastructure(graph, ["ads.example", "site.example"])).toEqual([]);
  });

  it("does not copy a shared creative's other resource domains onto the wrong page", () => {
    const graph = buildEvidenceGraph(["a", "b"].map((page) => ({
      pageUrl: `https://site.example/${page}`, links: [], frames: [], externals: [],
      adEvidence: [{ creativeId: "shared-sha", resourceUrl: `https://${page}.example/banner.png`, reason: "repeated-creative" }],
    })));
    expect(summarizeInfrastructure(graph).map(({ domain, pageUrls }) => ({ domain, pageUrls }))).toEqual([
      { domain: "a.example", pageUrls: ["https://site.example/a"] },
      { domain: "b.example", pageUrls: ["https://site.example/b"] },
    ]);
    expect(summarizeCorrelatedInfrastructure(graph)).toEqual([]);
  });

  it("preserves independent resource attribution when observed URL keys collide in the compact hash", () => {
    // These distinct Resource keys both produced the old ID resource-dd60bd35.
    const resources = ["https://a.example/assets/fbfa7e21.png", "https://b.example/assets/e20624f4.png"];
    const inputs = resources.map((resourceUrl, index) => ({
      pageUrl: `https://site.example/${String(index)}`, links: [], frames: [],
      externals: resources.map((url) => ({ url, kind: "resource" as const })),
      adEvidence: [{ findingId: `f${String(index)}`, location: "#ad", resourceUrl, reason: "official-finding" }],
    }));
    const graph = buildEvidenceGraph(inputs);
    const resourceNodes = graph.nodes.filter((node) => node.kind === "Resource");
    expect(resourceNodes.map((node) => node.url).sort()).toEqual(resources);
    expect(summarizeInfrastructure(graph).map(({ domain, pageUrls }) => ({ domain, pageUrls }))).toEqual([
      { domain: "a.example", pageUrls: ["https://site.example/0"] },
      { domain: "b.example", pageUrls: ["https://site.example/1"] },
    ]);
    expect(summarizeCorrelatedInfrastructure(graph)).toEqual([]);
    for (const [index, url] of resources.entries()) {
      const slice = sliceEvidenceGraph(graph, { focus: { kind: "finding", id: `f${String(index)}` }, depth: 1 });
      expect(slice.nodes.filter((node) => node.kind === "Resource").map((node) => node.url)).toEqual([url]);
    }
    const reversed = buildEvidenceGraph(inputs.map((input) => ({ ...input, externals: [...input.externals].reverse() })));
    expect(sliceEvidenceGraph(reversed)).toEqual(sliceEvidenceGraph(graph));
    expect(summarizeInfrastructure(reversed)).toEqual(summarizeInfrastructure(graph));
    expect(sliceEvidenceGraph(buildEvidenceGraph(inputs))).toEqual(sliceEvidenceGraph(graph));
  });
});

function starGraph(count: number): EvidenceGraph {
  return { nodes: [
    { id: "domain", kind: "Domain", label: "ads.example", adRelated: true },
    ...Array.from({ length: count }, (_, index) => ({ id: `element-${String(index).padStart(3, "0")}`,
      kind: "Element" as const, label: String(index), findingId: `f${String(index)}`, adRelated: true })),
    { id: "unrelated", kind: "Resource", label: "framework.js" },
  ], edges: Array.from({ length: count }, (_, index) => ({ from: "domain", to: `element-${String(index).padStart(3, "0")}`,
    kind: "LINKS_TO" as const, adRelated: true })) };
}

describe("bounded evidence graph exploration", () => {
  it("defaults to 100 nodes and excludes disconnected observed-only infrastructure", () => {
    const graph = starGraph(300);
    const slice = sliceEvidenceGraph(graph);
    expect(slice.nodes).toHaveLength(100);
    expect(slice.edges).toHaveLength(99);
    expect(slice.truncated).toBe(true);
    expect(slice.nodes.some((node) => node.id === "unrelated")).toBe(false);
    const ids = new Set(slice.nodes.map((node) => node.id));
    expect(slice.edges.every((edge) => ids.has(edge.from) && ids.has(edge.to))).toBe(true);
    expect(sliceEvidenceGraph({ nodes: [...graph.nodes].reverse(), edges: [...graph.edges].reverse() })).toEqual(slice);
  });

  it("applies hard limits, returns only edges whose endpoints fit, and respects an edge budget", () => {
    const graph = starGraph(300);
    expect(sliceEvidenceGraph(graph, { maxNodes: 250, maxEdges: 500 }).nodes).toHaveLength(250);
    const sparse = sliceEvidenceGraph(graph, { maxNodes: 20, maxEdges: 3 });
    expect(sparse.edges).toHaveLength(3);
    expect(sparse.truncated).toBe(true);
    const ids = new Set(sparse.nodes.map((node) => node.id));
    expect(sparse.edges.every((edge) => ids.has(edge.from) && ids.has(edge.to))).toBe(true);
    const dense: EvidenceGraph = { nodes: graph.nodes.slice(0, 40), edges: [] };
    for (let from = 0; from < dense.nodes.length; from += 1) for (let to = from + 1; to < dense.nodes.length; to += 1) {
      dense.edges.push({ from: dense.nodes[from]!.id, to: dense.nodes[to]!.id, kind: "LINKS_TO", adRelated: true });
    }
    expect(sliceEvidenceGraph(dense).edges).toHaveLength(200);
    expect(sliceEvidenceGraph(dense, { maxEdges: 500 }).edges).toHaveLength(500);
  });

  it("drills into finding, page, creative and domain IDs with traversal depth at most two", () => {
    const graph = buildEvidenceGraph([{ pageUrl: "https://site.example/a", links: [], frames: [], externals: [],
      adEvidence: [{ findingId: "f1", location: "#ad", creativeId: "sha-one", resourceUrl: "https://ads.example/banner.png", reason: "ocr-positive" }],
    }]);
    for (const focus of [{ kind: "finding" as const, id: "f1" }, { kind: "page" as const, id: "https://site.example/a" },
      { kind: "creative" as const, id: "sha-one" }, { kind: "domain" as const, id: "ads.example" }]) {
      const selected = sliceEvidenceGraph(graph, { focus, depth: 0 });
      expect(selected.nodes).toHaveLength(1);
      expect(selected.edges).toEqual([]);
      expect(selected.nodes[0]!.kind).toBe({ finding: "Element", page: "Page", creative: "Creative", domain: "Domain" }[focus.kind]);
    }
    const page = graph.nodes.find((node) => node.kind === "Page")!;
    expect(sliceEvidenceGraph(graph, { focus: { kind: "page", id: page.id }, depth: 0 }).nodes).toEqual([page]);
    expect(sliceEvidenceGraph(graph, { focus: { kind: "finding", id: "missing" } })).toEqual({ nodes: [], edges: [], truncated: false });
    const oneHop = sliceEvidenceGraph(graph, { focus: { kind: "finding", id: "f1" }, depth: 1 });
    expect(oneHop.nodes.filter((node) => node.kind === "Domain")).toEqual([]);
    const twoHops = sliceEvidenceGraph(graph, { focus: { kind: "finding", id: "f1" }, depth: 2 });
    expect(twoHops.nodes.filter((node) => node.kind === "Domain").map((node) => node.label).sort())
      .toEqual(["ads.example", "site.example"]);
    const fromPage = sliceEvidenceGraph(graph, { focus: { kind: "page", id: "https://site.example/a" }, depth: 2 });
    expect(fromPage.nodes.some((node) => node.kind === "Domain" && node.label === "ads.example")).toBe(false);
  });

  it("rejects invalid budgets and excessive depth before returning a slice", () => {
    const graph = starGraph(300);
    for (const query of [{ maxNodes: Number.NaN }, { maxNodes: 0 }, { maxNodes: 251 }, { maxNodes: 1.5 },
      { maxEdges: Number.POSITIVE_INFINITY }, { maxEdges: -1 }, { maxEdges: 501 }, { depth: -1 }, { depth: 3 }]) {
      expect(() => sliceEvidenceGraph(graph, query)).toThrow();
    }
    expect(sliceEvidenceGraph(graph, { maxEdges: 0 }).edges).toEqual([]);
  });

  it("rejects malformed runtime focus values rather than silently returning an empty graph", () => {
    const graph = starGraph(3);
    for (const focus of [null, "domain", {}, { kind: "resource", id: "domain" },
      { kind: "domain", id: 42 }, { kind: "domain", id: "" }, { kind: "domain", id: "   " }]) {
      expect(() => sliceEvidenceGraph(graph, { focus } as unknown as EvidenceGraphQuery)).toThrow(/invalid graph focus/);
    }
  });
});
