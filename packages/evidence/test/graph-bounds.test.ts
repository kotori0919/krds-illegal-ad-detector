import { expect, it } from "vitest";
import { buildEvidenceGraph, sliceEvidenceGraph } from "../src/graph.js";

it("bounds collected graph identities/edges and retains witnessed evidence before unrelated context", () => {
  const graph = buildEvidenceGraph(Array.from({ length: 20 }, (_, index) => ({ pageUrl: `https://site.invalid/${index}`,
    links: Array.from({ length: 1500 }, (_, item) => `https://other-${index}.invalid/${item}`), frames: [], externals: [],
    adEvidence: [{ findingId: `finding-${index}`, location: "#ad", destinationUrl: `https://advertiser-${index}.invalid/`, reason: "official-finding" }] })));
  expect(graph.truncated).toBe(true);
  expect(graph.nodes.length).toBeLessThanOrEqual(4000); expect(graph.edges.length).toBeLessThanOrEqual(8000);
  for (let index = 0; index < 20; index += 1) {
    expect(graph.nodes.some((node) => node.findingId === `finding-${index}`)).toBe(true);
    expect(graph.nodes.some((node) => node.url === `https://advertiser-${index}.invalid/` && node.adRelated)).toBe(true);
  }
  const ids = new Set(graph.nodes.map((node) => node.id));
  expect(graph.edges.every((edge) => ids.has(edge.from) && ids.has(edge.to))).toBe(true);
  expect(sliceEvidenceGraph(graph, { focus: { kind: "finding", id: "finding-19" } }).truncated).toBe(true);
});
