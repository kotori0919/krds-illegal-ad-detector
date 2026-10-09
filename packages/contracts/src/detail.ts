/** Contract v0.2: session-local evidence, separate from official result.json. */
import type { OfficialTechnique } from "./technique.js";
import type { DecisionEvidence } from "./detection.js";
import type { ExtraResult, OfficialResult, ValidationOutcome } from "./result.js";
import type { EvidenceAsset, EvidenceGraph, InfrastructureRelation, VisualSourceKind, VisualAnalysisCoverage } from "./evidence-access.js";

export interface FindingDetail {
  findingId: string;
  url: string;
  location: string;
  technique: OfficialTechnique;
  rawText: string;
  normalizedText: string;
  matchedTerms: string[];
  techniqueReason: string;
  /** Versioned local policy evidence; offsets reference analysisText, mapped to rawText below. */
  textPolicy?: {
    version: "text-policy-2";
    reasonCodes: ("AD_CATEGORY" | "AD_OFFER" | "OBSERVED_DESTINATION_PATTERN" | "PUBLIC_INFORMATION"
      | "QUOTED_PUBLIC_EXAMPLE" | "LIBRARY_SERVICE" | "NO_SUPPORTED_AD_EVIDENCE" | "TEXT_ANALYSIS_LIMIT")[];
    analysisText: string;
    alignment: "exact" | "unavailable";
    sourceMapping: { analysisStart: number; sourceStart: number; length: number }[];
    matches: { term: string; start: number; end: number; raw: string;
      transforms: ("width" | "case" | "cyrillic" | "jamo" | "separator" | "leet")[] }[];
    techniqueSpans: { term: string; start: number; end: number; raw: string;
      transforms: ("width" | "case" | "cyrillic" | "jamo" | "separator" | "leet")[] }[];
    offerSpans: { start: number; end: number; raw: string }[];
    quotedSpans: { start: number; end: number; raw: string }[];
    truncated: boolean;
  };
  destinationUrl?: string;
  observed: {
    /** Unique source of CSS/geometry when an inline descendant carries the signal. */
    selector?: string;
    renderingIssues?: string[];
    box: { x: number; y: number; width: number; height: number };
    css: { color: string; backgroundColor: string; opacity: string; display: string; fontSize: string; position: string };
  };
  visual: {
    state: "available" | "unavailable";
    reason?: "budget" | "capture-error";
    capturedAt?: string;
    mimeType?: "image/jpeg";
    dataUrl?: string;
    assetId?: string;
    viewport?: { width: number; height: number; scrollX: number; scrollY: number; deviceScaleFactor: number };
    target?: { state: "available"; coordinateSpace: "main-viewport"; box: { x: number; y: number; width: number; height: number } }
      | { state: "unavailable"; reason: "target-unavailable" };
    element?: { state: "available"; capturedAt: string; mimeType: "image/jpeg"; dataUrl?: string; assetId?: string;
      box: { x: number; y: number; width: number; height: number } }
      | { state: "unavailable"; reason: "budget" | "capture-error" | "outside-viewport" | "target-unavailable" };
  };
}

export interface ScanCoverage {
  /** Successfully processed pages, excluding every failed page. */
  checkedPages: number;
  failedPages: { url: string; status: number; reason: string }[];
  timedOut: boolean;
  cancelled?: boolean;
}

export interface PageOutcome {
  url: string;
  finalUrl: string;
  status: number;
  depth: number;
  outcome: "checked" | "failed";
  reason?: string;
  issue?: ScanIssue;
  discoverySource?: "entry" | "link" | "sitemap";
  collectionIssues?: string[];
}

/** Measured access/processing limitation. Kept outside official result.json. */
export interface ScanIssue {
  kind: "challenge" | "denied" | "rate-limit" | "login-required" | "timeout" | "navigation" | "network-policy" | "unknown";
  retryable: boolean;
  retryAfterMs?: number;
}

export const scanIssueLabel: Record<ScanIssue["kind"], string> = {
  challenge: "보안 확인이 필요하여 이 페이지를 점검하지 못했습니다",
  denied: "접근 거부",
  "rate-limit": "요청 제한",
  "login-required": "로그인 필요",
  timeout: "연결 시간 초과",
  navigation: "페이지 연결 실패",
  "network-policy": "허용된 네트워크 범위 밖의 주소",
  unknown: "점검 실패 (원인 확인 필요)",
};
export const discoverySourceLabel = { entry: "시작 주소", link: "페이지 링크", sitemap: "사이트맵" } as const;

export interface ImageAnalysis {
  analysisId?: string;
  assetId?: string;
  sourceKind?: VisualSourceKind;
  frameUrl?: string;
  location?: string;
  destinationUrl?: string;
  candidateEvidence?: string[];
  visibleDomEquivalent?: boolean;
  extraFindingId?: string;
  sourceUrl: string;
  pageUrls: string[];
  ocr: { state: "available"; backend: string; text: string; confidence: number }
    | { state: "unavailable"; backend: string; reason: "budget" | "recognition-error" };
  matchedTerms: string[];
  normalizedText?: string;
  decision: DecisionEvidence;
}

export interface CreativeImage {
  assetId?: string;
  findingId: string;
  sourceUrl: string;
  sha256: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  dataUrl?: string;
  width: number;
  height: number;
  capturedAt: string;
}

export interface ScanDetailBundle {
  version: 2;
  findings: FindingDetail[];
  creativeImages: CreativeImage[];
  coverage: ScanCoverage;
  pageOutcomes?: PageOutcome[];
  imageAnalysis?: ImageAnalysis[];
  visualAnalysisCoverage?: VisualAnalysisCoverage;
  visualAssets?: EvidenceAsset[];
  evidenceGraph?: EvidenceGraph;
  infrastructure?: InfrastructureRelation[];
  analysisIssues?: string[];
  /** Worker analysis timestamps; excludes IPC serialization, host commit and Save As. */
  timing?: { workerStartedAt: string; officialFinalizedAt: string; analysisFinishedAt: string; analysisElapsedMs: number };
}

/** Check the ID join and bounded image representation before host transfer. */
function validTextPolicy(value: unknown, source: string): boolean {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  const reasons = ["AD_CATEGORY", "AD_OFFER", "OBSERVED_DESTINATION_PATTERN", "PUBLIC_INFORMATION", "QUOTED_PUBLIC_EXAMPLE", "LIBRARY_SERVICE", "NO_SUPPORTED_AD_EVIDENCE", "TEXT_ANALYSIS_LIMIT"];
  const transforms = ["width", "case", "cyrillic", "jamo", "separator", "leet"];
  const list = (v: unknown, allowed: string[]): boolean => Array.isArray(v) && v.length <= allowed.length
    && new Set(v).size === v.length && v.every((s) => typeof s === "string" && allowed.includes(s));
  if (p.version !== "text-policy-2" || !list(p.reasonCodes, reasons) || typeof p.analysisText !== "string"
    || p.analysisText.length > 32768 || !["exact", "unavailable"].includes(String(p.alignment)) || typeof p.truncated !== "boolean") return false;
  const analysis = p.analysisText;
  const index = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
  const boundary = (text: string, n: number): boolean => n === 0 || n === text.length
    || !(text.charCodeAt(n - 1) >= 0xd800 && text.charCodeAt(n - 1) <= 0xdbff && text.charCodeAt(n) >= 0xdc00 && text.charCodeAt(n) <= 0xdfff);
  const spans = (v: unknown, transformed: boolean): boolean => Array.isArray(v) && v.length <= 32768 && v.every((s: unknown) => {
    if (!s || typeof s !== "object") return false;
    const span = s as Record<string, unknown>;
    return index(span.start) && index(span.end) && span.start < span.end && span.end <= analysis.length
      && boundary(analysis, span.start) && boundary(analysis, span.end) && typeof span.raw === "string"
      && analysis.slice(span.start, span.end) === span.raw && (!transformed || typeof span.term === "string"
        && span.term.length > 0 && span.term.length <= 128 && list(span.transforms, transforms));
  });
  if (!spans(p.matches, true) || !spans(p.techniqueSpans, true) || !spans(p.offerSpans, false) || !spans(p.quotedSpans, false)
    || !Array.isArray(p.sourceMapping) || p.sourceMapping.length > 10000) return false;
  if (p.alignment === "unavailable") return p.sourceMapping.length === 0;
  let analysisEnd = 0; let sourceEnd = 0;
  for (const value of p.sourceMapping) {
    if (!value || typeof value !== "object") return false;
    const m = value as Record<string, unknown>;
    if (!index(m.analysisStart) || !index(m.sourceStart) || !index(m.length) || m.length === 0
      || m.analysisStart !== analysisEnd || m.sourceStart < sourceEnd || m.analysisStart + m.length > analysis.length
      || m.sourceStart + m.length > source.length || !boundary(analysis, m.analysisStart) || !boundary(analysis, m.analysisStart + m.length)
      || !boundary(source, m.sourceStart) || !boundary(source, m.sourceStart + m.length)
      || analysis.slice(m.analysisStart, m.analysisStart + m.length) !== source.slice(m.sourceStart, m.sourceStart + m.length)) return false;
    analysisEnd = m.analysisStart + m.length; sourceEnd = m.sourceStart + m.length;
  }
  return analysisEnd === analysis.length;
}

export function validateScanDetailBundle(bundle: ScanDetailBundle, official: OfficialResult, extra: ExtraResult): ValidationOutcome {
  const errors: string[] = [];
  if (bundle.version !== 2) errors.push("detail version must be 2");
  if (bundle.findings.length !== official.findings.length) errors.push("detail finding count mismatch");
  const byId = new Map(bundle.findings.map((detail) => [detail.findingId, detail]));
  const shared = new Map(bundle.visualAssets?.map((asset) => [asset.assetId, asset]));
  const validJpeg = (dataUrl?: string, assetId?: string): boolean => {
    if (assetId !== undefined) {
      const asset = shared.get(assetId);
      return dataUrl === undefined && asset?.mimeType === "image/jpeg" && asset.dataUrl.startsWith("data:image/jpeg;base64,") && asset.dataUrl.length <= 700_000;
    }
    return dataUrl?.startsWith("data:image/jpeg;base64,") === true && dataUrl.length <= 700_000;
  };
  if (byId.size !== bundle.findings.length) errors.push("detail finding IDs duplicated");
  for (const finding of official.findings) {
    const detail = byId.get(finding.id);
    if (!detail) { errors.push(`detail missing ${finding.id}`); continue; }
    if (detail.url !== finding.url || detail.location !== finding.location
      || detail.technique !== finding.technique || detail.rawText !== finding.evidence_text) {
      errors.push(`detail identity mismatch ${finding.id}`);
    }
    if (detail.textPolicy !== undefined && !validTextPolicy(detail.textPolicy, detail.rawText)) errors.push(`detail text policy invalid ${finding.id}`);
    const issues = detail.observed?.renderingIssues;
    if (issues !== undefined && (!Array.isArray(issues) || issues.length > 32
      || issues.some((issue) => typeof issue !== "string" || !issue || issue.length > 256))) errors.push(`detail rendering issues invalid ${finding.id}`);
    if (detail.visual.state === "available") {
      if (detail.visual.mimeType !== "image/jpeg"
        || !validJpeg(detail.visual.dataUrl, detail.visual.assetId)) errors.push(`detail visual invalid ${finding.id}`);
      const { target, element, viewport } = detail.visual;
      const validBox = (box: { x: number; y: number; width: number; height: number }): boolean =>
        Number.isFinite(box.x) && Number.isFinite(box.y) && Number.isFinite(box.width)
        && Number.isFinite(box.height) && box.width > 0 && box.height > 0;
      if (!viewport || !Number.isFinite(viewport.width) || !Number.isFinite(viewport.height)
        || viewport.width <= 0 || viewport.height <= 0 || !Number.isFinite(viewport.deviceScaleFactor)
        || viewport.deviceScaleFactor <= 0 || !Number.isFinite(viewport.scrollX)
        || !Number.isFinite(viewport.scrollY)) errors.push(`detail viewport invalid ${finding.id}`);
      if (!target || (target.state === "available" ? (!validBox(target.box)
        || target.coordinateSpace !== "main-viewport") : target.state !== "unavailable"
        || target.reason !== "target-unavailable")) errors.push(`detail target invalid ${finding.id}`);
      if (!element) errors.push(`detail element capture missing ${finding.id}`);
      else if (element.state === "available" && (target?.state !== "available" || !validBox(element.box)
        || element.mimeType !== "image/jpeg" || !validJpeg(element.dataUrl, element.assetId)
        || !viewport || element.box.x < 0 || element.box.y < 0
        || element.box.x + element.box.width > viewport.width || element.box.y + element.box.height > viewport.height)) {
        errors.push(`detail element capture invalid ${finding.id}`);
      }
      else if (element.state !== "available" && (element.state !== "unavailable"
        || !["budget", "capture-error", "outside-viewport", "target-unavailable"].includes(element.reason)
        || "dataUrl" in element)) errors.push(`unavailable detail element invalid ${finding.id}`);
    } else if (detail.visual.dataUrl || detail.visual.assetId) errors.push(`unavailable detail has image ${finding.id}`);
  }
  if (bundle.timing !== undefined) {
    const timing = bundle.timing;
    const stamps = [timing?.workerStartedAt, timing?.officialFinalizedAt, timing?.analysisFinishedAt];
    const dates = stamps.map((stamp) => {
      if (typeof stamp !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(stamp)) return Number.NaN;
      const year = Number(stamp.slice(0, 4)); const month = Number(stamp.slice(5, 7)); const day = Number(stamp.slice(8, 10));
      const days = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      return month < 1 || month > 12 || day < 1 || day > days[month - 1]! ? Number.NaN : Date.parse(stamp);
    });
    if (dates.some((date) => !Number.isFinite(date)) || dates[0]! > dates[1]! || dates[1]! > dates[2]!
      || typeof timing?.analysisElapsedMs !== "number" || !Number.isFinite(timing.analysisElapsedMs)
      || timing.analysisElapsedMs < 0 || timing.analysisElapsedMs > Number.MAX_SAFE_INTEGER) errors.push("detail timing invalid");
  }
  if (!Number.isSafeInteger(bundle.coverage.checkedPages) || bundle.coverage.checkedPages < 0) errors.push("checked pages invalid");
  if (bundle.coverage.cancelled !== undefined && typeof bundle.coverage.cancelled !== "boolean") errors.push("cancelled coverage invalid");
  if (bundle.pageOutcomes !== undefined) {
    const pages = bundle.pageOutcomes;
    if (!Array.isArray(pages) || pages.length > 200 || new Set(pages.map((page) => page.url)).size !== pages.length) {
      errors.push("page outcomes invalid");
    } else {
      for (const page of pages) {
        if (typeof page.url !== "string" || !page.url || typeof page.finalUrl !== "string" || !page.finalUrl
          || !Number.isSafeInteger(page.depth) || page.depth < 0 || !Number.isSafeInteger(page.status) || page.status < 0
          || !["checked", "failed"].includes(page.outcome)
          || (page.outcome === "checked") !== (page.status > 0 && page.status < 400 && page.issue === undefined)) errors.push("page outcome representation invalid");
        if (page.issue !== undefined && (!page.issue || !Object.hasOwn(scanIssueLabel, page.issue.kind) || typeof page.issue.retryable !== "boolean"
          || (page.issue.retryAfterMs !== undefined && (!Number.isSafeInteger(page.issue.retryAfterMs) || page.issue.retryAfterMs < 0)))) errors.push("page issue invalid");
        if (page.discoverySource !== undefined && !Object.hasOwn(discoverySourceLabel, page.discoverySource)) errors.push("page discovery source invalid");
        if (page.collectionIssues !== undefined && (!Array.isArray(page.collectionIssues) || page.collectionIssues.length > 32
          || new Set(page.collectionIssues).size !== page.collectionIssues.length
          || page.collectionIssues.some((issue) => typeof issue !== "string" || !issue || new TextEncoder().encode(issue).byteLength > 256))) errors.push("page collection issues invalid");
        if (page.outcome === "failed" && !bundle.coverage.failedPages.some((failure) => failure.url === page.url && failure.status === page.status)) {
          errors.push("failed page outcome mismatch");
        }
      }
      if (pages.filter((page) => page.outcome === "checked").length !== bundle.coverage.checkedPages
        || pages.filter((page) => page.outcome === "failed").length !== bundle.coverage.failedPages.length) errors.push("page outcome coverage mismatch");
    }
  }
  if (bundle.imageAnalysis !== undefined) {
    if (!Array.isArray(bundle.imageAnalysis) || bundle.imageAnalysis.length > 64) errors.push("image analysis invalid");
    else for (const analysis of bundle.imageAnalysis) {
      if (typeof analysis.sourceUrl !== "string" || !analysis.sourceUrl || !Array.isArray(analysis.pageUrls)
        || !analysis.pageUrls.length || analysis.pageUrls.some((url) => typeof url !== "string" || !url)
        || !Array.isArray(analysis.matchedTerms) || analysis.matchedTerms.some((term) => typeof term !== "string")
        || analysis.normalizedText !== undefined && typeof analysis.normalizedText !== "string") errors.push("image analysis source invalid");
      const recognition = analysis.ocr;
      if (!recognition || typeof recognition.backend !== "string" || !recognition.backend
        || (recognition.state === "available" ? typeof recognition.text !== "string"
          || !Number.isFinite(recognition.confidence) || recognition.confidence < 0 || recognition.confidence > 1
          : recognition.state !== "unavailable" || !["budget", "recognition-error"].includes(recognition.reason))) errors.push("image OCR representation invalid");
      const decision = analysis.decision;
      if (!decision || typeof decision.rule !== "string" || typeof decision.detail !== "string"
        || !Number.isFinite(decision.score) || !Number.isFinite(decision.threshold)
        || typeof decision.passed !== "boolean" || decision.passed !== (decision.score >= decision.threshold)) errors.push("image decision invalid");
    }
  }
  const creativeIds = new Set<string>();
  let imageCharacters = 0;
  if (!Array.isArray(bundle.creativeImages) || bundle.creativeImages.length > 64) errors.push("creative images invalid");
  else for (const image of bundle.creativeImages) {
    const finding = extra.findings.find((item) => item.id === image.findingId);
    if (!finding || finding.extra_finding !== "REUSED_AD_CREATIVE" || finding.url !== image.sourceUrl
      || finding.location !== image.sourceUrl || creativeIds.has(image.findingId)) errors.push("creative image identity invalid");
    creativeIds.add(image.findingId);
    const sharedCreative=image.assetId?shared.get(image.assetId):undefined;
    const imageData=image.dataUrl??sharedCreative?.dataUrl;
    if (!["image/png", "image/jpeg", "image/webp"].includes(image.mimeType)
      || !imageData?.startsWith(`data:${image.mimeType};base64,`) || imageData.length > 334_000
      || sharedCreative!==undefined && sharedCreative.mimeType!==image.mimeType
      || !/^[A-Za-z0-9+/]+={0,2}$/.test(imageData.slice(imageData.indexOf(",") + 1))
      || !/^[a-f0-9]{64}$/.test(image.sha256) || !Number.isInteger(image.width) || image.width < 8
      || !Number.isInteger(image.height) || image.height < 8 || !Number.isFinite(Date.parse(image.capturedAt))) {
      errors.push("creative image representation invalid");
    }
    imageCharacters += image.dataUrl?.length??0;
  }
  if (imageCharacters > 2_670_000) errors.push("creative images exceed capture budget");
  const assets = new Set(Array.isArray(bundle.creativeImages) ? bundle.creativeImages.flatMap((image)=>image.assetId && image.dataUrl ? [image.assetId] : []) : []);
  let visualCharacters = imageCharacters;
  if (bundle.visualAssets !== undefined) {
    if (!Array.isArray(bundle.visualAssets) || bundle.visualAssets.length>64) errors.push("visual assets invalid");
    else for (const asset of bundle.visualAssets) {
      if (typeof asset.assetId!=="string" || !asset.assetId || assets.has(asset.assetId)
        || !["image/png","image/jpeg","image/webp"].includes(asset.mimeType)
        || typeof asset.dataUrl!=="string" || asset.dataUrl.length>700_000
        || !asset.dataUrl.startsWith(`data:${asset.mimeType};base64,`)
        || !/^[A-Za-z0-9+/]+={0,2}$/.test(asset.dataUrl.slice(asset.dataUrl.indexOf(",")+1))) errors.push("visual asset representation invalid");
      assets.add(asset.assetId);visualCharacters+=asset.dataUrl.length;
    }
  }
  if (visualCharacters>5_340_000) errors.push("visual assets exceed capture budget");
  for (const analysis of Array.isArray(bundle.imageAnalysis) ? bundle.imageAnalysis : []) {
    if (analysis.assetId!==undefined && !assets.has(analysis.assetId)) errors.push("image asset missing");
    if (analysis.sourceKind!==undefined && !["img","background-image","svg","canvas"].includes(analysis.sourceKind)) errors.push("visual source invalid");
    if (analysis.visibleDomEquivalent!==undefined && typeof analysis.visibleDomEquivalent!=="boolean") errors.push("visible DOM equivalence invalid");
    if (analysis.extraFindingId!==undefined) {
      const finding=extra.findings.find((finding)=>finding.id===analysis.extraFindingId);
      if (!finding || finding.extra_finding!=="IMAGE_ONLY_ILLEGAL_AD" || finding.location!==analysis.location
        || analysis.ocr?.state!=="available" || finding.evidence_text!==analysis.ocr.text
        || !analysis.decision?.passed || analysis.visibleDomEquivalent!==false || !analysis.matchedTerms?.length
        || finding.url!==analysis.frameUrl) errors.push("image-only identity invalid");
    }
  }
  if (bundle.evidenceGraph!==undefined) {
    const {nodes,edges}=bundle.evidenceGraph;
    const ids=new Set(Array.isArray(nodes) ? nodes.map((node)=>node.id) : []);
    if (!Array.isArray(nodes) || !Array.isArray(edges) || ids.size!==nodes.length || nodes.some((node)=>!node.id || typeof node.label!=="string"
      || !["Page","Frame","Element","Resource","Creative","Domain","Redirect","Landing"].includes(node.kind)
      || node.adRelated!==undefined && typeof node.adRelated!=="boolean")
      || edges.some((edge)=>!ids.has(edge.from) || !ids.has(edge.to)
        || !["CONTAINS","LOADS","EMBEDS","DISPLAYS","LINKS_TO","REDIRECTS_TO","SIMILAR_TO"].includes(edge.kind)
        || edge.adRelated!==undefined && typeof edge.adRelated!=="boolean")) errors.push("evidence graph invalid");
  }
  if (bundle.infrastructure!==undefined && (!Array.isArray(bundle.infrastructure)
    || bundle.infrastructure.some((relation)=>!relation.domain || !relation.nodeId || !Array.isArray(relation.pageUrls)
      || !relation.pageUrls.length || relation.pageUrls.some((url)=>typeof url!=="string" || !url)
      || !Array.isArray(relation.evidenceKinds) || !relation.evidenceKinds.length
      || relation.evidenceKinds.some((kind)=>typeof kind!=="string" || !kind)))) errors.push("infrastructure summary invalid");
  if (bundle.analysisIssues!==undefined && (!Array.isArray(bundle.analysisIssues)
    || bundle.analysisIssues.some((issue)=>typeof issue!=="string" || !issue))) errors.push("analysis issues invalid");
  if (bundle.visualAnalysisCoverage !== undefined) {
    const c = bundle.visualAnalysisCoverage;
    const selection=c?.selection;
    if(selection && (typeof selection.policy!=="string" || !selection.policy
      || ![selection.retainedRecords,selection.retainedAssets,selection.retainedBytes,selection.excludedRecords].every(n=>Number.isSafeInteger(n)&&n>=0)
      || selection.retainedRecords>64 || selection.retainedAssets>40 || selection.retainedBytes>2_000_000
      || !Array.isArray(selection.ocrSha256) || selection.ocrSha256.length>6 || new Set(selection.ocrSha256).size!==selection.ocrSha256.length
      || selection.ocrSha256.some(sha=>!/^[a-f0-9]{64}$/.test(sha)))) errors.push("visual selection invalid");
    const integer = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
    const limits = ["page-limit", "candidate-limit", "element-limit", "byte-limit", "ocr-image-limit", "deadline"];
    const reasons = [...limits, "cancelled", "capture-error", "document-unavailable", "image-unavailable", "target-unavailable"];
    if (!c || ![c.pagesConsidered, c.pagesNotConsidered, c.candidatesObserved, c.imagesAcquired,
      c.imageAnalysisRecords, c.ocrImagesAttempted, c.ocrImagesCompleted, c.ocrImagesUnavailable].every(integer)
      || c.candidateTotal !== null || !c.limits
      || ![c.limits.pages, c.limits.candidatesPerDocument, c.limits.elementsPerDocument,
        c.limits.bytesPerPage, c.limits.distinctOcrImages].every((value) => integer(value) && value > 0)
      || c.pagesConsidered > c.limits.pages || c.imagesAcquired > c.candidatesObserved
      || c.imageAnalysisRecords > c.imagesAcquired || c.ocrImagesAttempted > c.imageAnalysisRecords
      || c.ocrImagesAttempted > c.limits.distinctOcrImages
      || c.ocrImagesCompleted + c.ocrImagesUnavailable !== c.ocrImagesAttempted
      || !Array.isArray(c.limitsReached) || new Set(c.limitsReached).size !== c.limitsReached.length
      || c.limitsReached.some((reason) => !limits.includes(reason))
      || !Array.isArray(c.skips) || c.skips.some((skip) => !skip || !reasons.includes(skip.reason)
        || !["page", "document", "candidate", "image"].includes(skip.unit) || !integer(skip.count) || skip.count === 0)) {
      errors.push("visual analysis coverage invalid");
    }
  }
  return { ok: errors.length === 0, errors };
}
