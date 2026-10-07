import type { EvidenceAsset, EvidenceSummary, FindingDetailView, ImageAnalysisPage, ImageAnalysisQuery, ScanDetailBundle } from "@krds-detector/contracts";

/** Index one replay record once; bytes stay behind session-scoped asset reads. */
export function indexSessionEvidence(bundle: ScanDetailBundle) {
  const assets = new Map<string, EvidenceAsset>();
  const assetContents = new Map<string, string>();
  const assetReferences = new Map<string, string>();
  const add = (mimeType: EvidenceAsset["mimeType"], dataUrl: string) => {
    const existing = assetContents.get(dataUrl);
    if (existing) return existing;
    const assetId = `asset-${assets.size}`;
    assets.set(assetId, { assetId, mimeType, dataUrl });
    assetContents.set(dataUrl, assetId);
    return assetId;
  };
  const findings = new Map<string, FindingDetailView>();
  for (const detail of bundle.findings) {
    const { dataUrl, element, ...visual } = detail.visual;
    const view: FindingDetailView = { ...detail, visual: { ...visual } };
    if (visual.state === "available" && dataUrl) view.visual.assetId = add("image/jpeg", dataUrl);
    if (element?.state === "available") {
      const { dataUrl: crop, ...metadata } = element;
      view.visual.element = { ...metadata, assetId: add("image/jpeg", crop) };
    } else view.visual.element = element;
    findings.set(detail.findingId, view);
  }
  const creativeImages = bundle.creativeImages.map(({ dataUrl, ...image }) => {
    const assetId = add(image.mimeType, dataUrl);
    if (image.assetId) assetReferences.set(image.assetId, assetId);
    return { ...image, assetId };
  });
  for (const asset of bundle.visualAssets ?? []) assetReferences.set(asset.assetId, add(asset.mimeType, asset.dataUrl));
  const analyses = (bundle.imageAnalysis ?? []).map((analysis) => ({ ...analysis,
    assetId: analysis.assetId ? assetReferences.get(analysis.assetId)
      : creativeImages.find((image) => image.sourceUrl === analysis.sourceUrl)?.assetId,
  }));
  const summary: EvidenceSummary = {
    observedDomainCount: bundle.evidenceGraph?.nodes.filter((node) => node.kind === "Domain").length ?? 0,
    infrastructure: bundle.infrastructure ?? [], imageAnalysisCount: analyses.length, creativeImages,
    graphAvailable: bundle.evidenceGraph !== undefined,
    analysisIssues: bundle.analysisIssues ?? [],
  };
  return {
    findings, assets, summary, graph: bundle.evidenceGraph,
    coverage: { coverage: bundle.coverage, pageOutcomes: bundle.pageOutcomes ?? [] },
    imagePage(query: ImageAnalysisQuery = {}): ImageAnalysisPage {
      const cursor = query.cursor ?? 0;
      const limit = query.limit ?? 12;
      if (!Number.isSafeInteger(cursor) || cursor < 0) throw new Error("cursor must be a nonnegative integer");
      if (!Number.isInteger(limit) || limit < 1 || limit > 24) throw new Error("limit must be 1..24");
      const items = analyses.filter((item) => (query.pageUrl === undefined || item.pageUrls.includes(query.pageUrl))
        && (query.extraFindingId === undefined || item.extraFindingId === query.extraFindingId));
      const nextCursor = cursor + limit < items.length ? cursor + limit : undefined;
      return { items: items.slice(cursor, cursor + limit), total: items.length, nextCursor };
    },
  };
}
