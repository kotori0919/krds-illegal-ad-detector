import { describe, expect, it } from "vitest";
import { buildEvidenceGraph, summarizeCorrelatedInfrastructure } from "../src/graph.js";
import {
  blockAverageHash,
  fingerprintCreative,
  groupSimilarCreatives,
  hashDistance,
  sha256Hex,
} from "../src/fingerprint.js";
import { buildExtraResult, zeroWidthSignals } from "../src/extra.js";
import { DisabledMultimodalFallback, RuleDecisionModel } from "../src/adapters.js";

function solidRgba(w: number, h: number, v: number): Uint8Array {
  const out = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i += 1) {
    out[i * 4] = v;
    out[i * 4 + 1] = v;
    out[i * 4 + 2] = v;
    out[i * 4 + 3] = 255;
  }
  return out;
}

describe("evidence graph", () => {
  it("models pages, frames, landings, and externals without crawling them", () => {
    const graph = buildEvidenceGraph([
      {
        pageUrl: "https://example.kr/a",
        links: ["https://example.kr/b", "https://ads.example/win"],
        frames: [{ url: "https://example.kr/f1" }],
        externals: [
          { url: "https://ads.example/win", kind: "resource" },
          { url: "https://example.kr/a?x=1", kind: "redirect" },
        ],
      },
    ]);
    const kinds = new Set(graph.nodes.map((n) => n.kind));
    for (const k of ["Page", "Frame", "Domain", "Landing", "Resource", "Redirect"]) {
      expect(kinds.has(k as never), k).toBe(true);
    }
    const edgeKinds = new Set(graph.edges.map((e) => e.kind));
    expect(edgeKinds.has("EMBEDS")).toBe(true);
    expect(edgeKinds.has("REDIRECTS_TO")).toBe(true);
    // No node claims operator identity.
    expect(graph.nodes.every((n) => !/operator|nationality/i.test(n.label))).toBe(true);
  });

  it("summarizes recurring infrastructure with disciplined wording", () => {
    const graph = buildEvidenceGraph([
      { pageUrl: "https://example.kr/a", links: [], frames: [], externals: [{ url: "https://ads.example/1", kind: "resource" }],
        adEvidence: [{ location: "#ad", resourceUrl: "https://ads.example/1", reason: "official-finding" }] },
      { pageUrl: "https://example.kr/b", links: [], frames: [], externals: [{ url: "https://ads.example/2", kind: "resource" }],
        adEvidence: [{ location: "#ad", resourceUrl: "https://ads.example/2", reason: "official-finding" }] },
    ]);
    const summaries = summarizeCorrelatedInfrastructure(graph, ["example.kr"]);
    expect(summaries.length).toBe(1);
    expect(summaries[0]).toMatch(/recurring advertisement infrastructure: ads\.example/);
  });

  it("counts distinct pages even when they load the exact same external asset", () => {
    const shared = "https://asset.example/banner.webp";
    const graph = buildEvidenceGraph([
      { pageUrl: "https://site.example/a", links: [], frames: [], externals: [{ url: shared, kind: "resource" }],
        adEvidence: [{ location: "#ad", resourceUrl: shared, reason: "repeated-creative" }] },
      { pageUrl: "https://site.example/b", links: [], frames: [], externals: [{ url: shared, kind: "resource" }],
        adEvidence: [{ location: "#ad", resourceUrl: shared, reason: "repeated-creative" }] },
    ]);
    expect(summarizeCorrelatedInfrastructure(graph, ["site.example"]))
      .toEqual(["recurring advertisement infrastructure: asset.example (observed on 2 pages)"]);

    const onePage = buildEvidenceGraph([{ pageUrl: "https://site.example/a", links: [], frames: [], externals: [
      { url: "https://asset.example/one.webp", kind: "resource" },
      { url: "https://asset.example/two.webp", kind: "resource" },
    ] }]);
    expect(summarizeCorrelatedInfrastructure(onePage, ["site.example"])).toEqual([]);
  });
});

describe("creative fingerprint", () => {
  it("hashes exact bytes and structured pixels deterministically", () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    expect(sha256Hex(bytes)).toBe(sha256Hex(new Uint8Array([1, 2, 3, 4])));
    expect(sha256Hex(bytes)).not.toBe(sha256Hex(new Uint8Array([1, 2, 3, 5])));
    const h1 = blockAverageHash(solidRgba(8, 8, 10), 8, 8);
    const h2 = blockAverageHash(solidRgba(8, 8, 10), 8, 8);
    expect(h1).toBe(h2);
    expect(hashDistance(h1, h2)).toBe(0);
  });

  it("groups near-identical creatives into families", () => {
    const base = solidRgba(16, 16, 100);
    // Distinct left/right halves: near twin differs slightly, far inverts.
    for (let i = 0; i < 16 * 16; i += 1) {
      const x = i % 16;
      base[i * 4] = x < 8 ? 40 : 200;
      base[i * 4 + 1] = x < 8 ? 40 : 200;
      base[i * 4 + 2] = x < 8 ? 40 : 200;
    }
    const near = new Uint8Array(base);
    near[0] = 42;
    const far = solidRgba(16, 16, 100);
    for (let i = 0; i < 16 * 16; i += 1) {
      const x = i % 16;
      far[i * 4] = x < 8 ? 200 : 40;
      far[i * 4 + 1] = x < 8 ? 200 : 40;
      far[i * 4 + 2] = x < 8 ? 200 : 40;
    }
    const prints = [
      fingerprintCreative({ bytes: base, rgba: base, width: 16, height: 16, mediaType: "image/png", sourceUrl: "https://a.example/1.png" }),
      fingerprintCreative({ bytes: near, rgba: near, width: 16, height: 16, mediaType: "image/png", sourceUrl: "https://b.example/2.png" }),
      fingerprintCreative({ bytes: far, rgba: far, width: 16, height: 16, mediaType: "image/png", sourceUrl: "https://c.example/3.png" }),
    ];
    const groups = groupSimilarCreatives(prints, 2);
    expect(groups.length).toBe(1);
    expect(groups[0]?.length).toBe(2);
  });
});

describe("extra results", () => {
  it("detects zero-width obfuscation as ETC intelligence", () => {
    expect(zeroWidthSignals("카지노​ 가입")).toBe(true);
    expect(zeroWidthSignals("카지노 가입")).toBe(false);
  });

  it("builds validated result_extra.json with ETC + extra_finding", () => {
    const graph = buildEvidenceGraph([
      { pageUrl: "https://example.kr/a", links: [], frames: [], externals: [{ url: "https://ads.example/1", kind: "resource" }],
        adEvidence: [{ location: "#ad", resourceUrl: "https://ads.example/1", reason: "official-finding" }] },
      { pageUrl: "https://example.kr/b", links: [], frames: [], externals: [{ url: "https://ads.example/2", kind: "resource" }],
        adEvidence: [{ location: "#ad", resourceUrl: "https://ads.example/2", reason: "official-finding" }] },
    ]);
    const bytes = solidRgba(16, 16, 100);
    const result = buildExtraResult({
      topic: "TOPIC",
      entryUrl: "https://example.kr/",
      startedAt: "2026-10-01T00:00:00.000Z",
      finishedAt: "2026-10-01T00:01:00.000Z",
      creatives: [
        fingerprintCreative({ bytes, rgba: bytes, width: 16, height: 16, mediaType: "image/png", sourceUrl: "https://a.example/1.png" }),
        fingerprintCreative({ bytes, rgba: bytes, width: 16, height: 16, mediaType: "image/png", sourceUrl: "https://b.example/2.png" }),
      ],
      graph,
      zeroWidthCases: [
        { url: "https://example.kr/a", location: "#ad", evidenceText: "카지노​ 가입" },
        { url: "https://example.kr/a", location: "#clean", evidenceText: "정상 안내" },
      ],
    });
    expect(result.findings.length).toBe(3);
    expect(result.findings.every((f) => f.technique === "ETC")).toBe(true);
    const types = new Set(result.findings.map((f) => f.extra_finding));
    expect(types).toEqual(
      new Set(["REUSED_AD_CREATIVE", "AD_INFRASTRUCTURE_CORRELATION", "ZERO_WIDTH_OBFUSCATION"]),
    );
  });
  it("serializes image-only decisions once with stable IDs independent of input order", () => {
    const input = { topic: "TOPIC", entryUrl: "https://example.kr/",
      startedAt: "2026-10-01T00:00:00.000Z", finishedAt: "2026-10-01T00:01:00.000Z",
      creatives: [], graph: { nodes: [], edges: [] }, zeroWidthCases: [],
      imageOnlyCases: [
        { url: "https://example.kr/b", location: "#canvas", evidenceText: "카지노 가입" },
        { url: "https://example.kr/a", location: "#banner", evidenceText: "가입 보너스 지급" },
        { url: "https://example.kr/b", location: "#canvas", evidenceText: "카지노 가입" },
      ],
    };
    const result = buildExtraResult(input);
    expect(result.findings.map(({ id, url, location, extra_finding, technique }) => ({ id, url, location, extra_finding, technique }))).toEqual([
      { id: "x1", url: "https://example.kr/a", location: "#banner", extra_finding: "IMAGE_ONLY_ILLEGAL_AD", technique: "ETC" },
      { id: "x2", url: "https://example.kr/b", location: "#canvas", extra_finding: "IMAGE_ONLY_ILLEGAL_AD", technique: "ETC" },
    ]);
    expect(buildExtraResult({ ...input, imageOnlyCases: [...input.imageOnlyCases].reverse() })).toEqual(result);
    expect(buildExtraResult({ ...input, imageOnlyCases: [] }).findings).toEqual([]);
  });
});

describe("decision adapters", () => {
  it("rule model corroborates without becoming the detector", () => {
    const model = new RuleDecisionModel();
    expect(model.resolveAmbiguity({ rawText: "카지노", technique: "JAMO", infrastructureRefs: 0, creativeSimilarity: 99 }).passed).toBe(false);
    expect(
      model.resolveAmbiguity({
        rawText: "카지노",
        technique: "JAMO",
        ocrText: "카지노",
        destinationUrl: "https://ads.example/casino",
        infrastructureRefs: 3,
        creativeSimilarity: 99,
      }).passed,
    ).toBe(true);
  });

  it("multimodal fallback is disabled by default", async () => {
    const vlm = new DisabledMultimodalFallback();
    expect(vlm.enabled).toBe(false);
    const verdict = await vlm.judge({ sourceId: "x", imageBytes: new Uint8Array([0]), width: 1, height: 1, mediaType: "image/png" });
    expect(verdict).toEqual({ state: "unavailable", issue: { code: "DISABLED", retryable: false } });
  });
});
