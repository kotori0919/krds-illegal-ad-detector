/** Contract v0.2: session-local evidence, separate from official result.json. */
import type { OfficialTechnique } from "./technique.js";
import type { DecisionEvidence } from "./detection.js";
import type { ExtraResult, OfficialResult, ValidationOutcome } from "./result.js";

export interface FindingDetail {
  findingId: string;
  url: string;
  location: string;
  technique: OfficialTechnique;
  rawText: string;
  normalizedText: string;
  matchedTerms: string[];
  techniqueReason: string;
  destinationUrl?: string;
  observed: {
    /** Unique source of CSS/geometry when an inline descendant carries the signal. */
    selector?: string;
    box: { x: number; y: number; width: number; height: number };
    css: { color: string; backgroundColor: string; opacity: string; display: string; fontSize: string; position: string };
  };
  visual: {
    state: "available" | "unavailable";
    reason?: "budget" | "capture-error";
    capturedAt?: string;
    mimeType?: "image/jpeg";
    dataUrl?: string;
    viewport?: { width: number; height: number; scrollX: number; scrollY: number; deviceScaleFactor: number };
    target?: { state: "available"; coordinateSpace: "main-viewport"; box: { x: number; y: number; width: number; height: number } }
      | { state: "unavailable"; reason: "target-unavailable" };
    element?: { state: "available"; capturedAt: string; mimeType: "image/jpeg"; dataUrl: string;
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
}

export interface ImageAnalysis {
  sourceUrl: string;
  pageUrls: string[];
  ocr: { state: "available"; backend: string; text: string; confidence: number }
    | { state: "unavailable"; backend: string; reason: "budget" | "recognition-error" };
  matchedTerms: string[];
  normalizedText?: string;
  decision: DecisionEvidence;
}

export interface CreativeImage {
  findingId: string;
  sourceUrl: string;
  sha256: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  dataUrl: string;
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
}

/** Check the ID join and bounded image representation before host transfer. */
export function validateScanDetailBundle(bundle: ScanDetailBundle, official: OfficialResult, extra: ExtraResult): ValidationOutcome {
  const errors: string[] = [];
  if (bundle.version !== 2) errors.push("detail version must be 2");
  if (bundle.findings.length !== official.findings.length) errors.push("detail finding count mismatch");
  const byId = new Map(bundle.findings.map((detail) => [detail.findingId, detail]));
  if (byId.size !== bundle.findings.length) errors.push("detail finding IDs duplicated");
  for (const finding of official.findings) {
    const detail = byId.get(finding.id);
    if (!detail) { errors.push(`detail missing ${finding.id}`); continue; }
    if (detail.url !== finding.url || detail.location !== finding.location
      || detail.technique !== finding.technique || detail.rawText !== finding.evidence_text) {
      errors.push(`detail identity mismatch ${finding.id}`);
    }
    if (detail.visual.state === "available") {
      if (detail.visual.mimeType !== "image/jpeg"
        || !detail.visual.dataUrl?.startsWith("data:image/jpeg;base64,")
        || detail.visual.dataUrl.length > 700_000) errors.push(`detail visual invalid ${finding.id}`);
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
        || element.mimeType !== "image/jpeg" || !element.dataUrl.startsWith("data:image/jpeg;base64,")
        || element.dataUrl.length > 700_000 || !viewport || element.box.x < 0 || element.box.y < 0
        || element.box.x + element.box.width > viewport.width || element.box.y + element.box.height > viewport.height)) {
        errors.push(`detail element capture invalid ${finding.id}`);
      }
      else if (element.state !== "available" && (element.state !== "unavailable"
        || !["budget", "capture-error", "outside-viewport", "target-unavailable"].includes(element.reason)
        || "dataUrl" in element)) errors.push(`unavailable detail element invalid ${finding.id}`);
    } else if (detail.visual.dataUrl) errors.push(`unavailable detail has image ${finding.id}`);
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
          || (page.outcome === "checked") !== (page.status > 0 && page.status < 400)) errors.push("page outcome representation invalid");
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
    if (!["image/png", "image/jpeg", "image/webp"].includes(image.mimeType)
      || !image.dataUrl.startsWith(`data:${image.mimeType};base64,`) || image.dataUrl.length > 334_000
      || !/^[A-Za-z0-9+/]+={0,2}$/.test(image.dataUrl.slice(image.dataUrl.indexOf(",") + 1))
      || !/^[a-f0-9]{64}$/.test(image.sha256) || !Number.isInteger(image.width) || image.width < 8
      || !Number.isInteger(image.height) || image.height < 8 || !Number.isFinite(Date.parse(image.capturedAt))) {
      errors.push("creative image representation invalid");
    }
    imageCharacters += image.dataUrl.length;
  }
  if (imageCharacters > 2_670_000) errors.push("creative images exceed capture budget");
  return { ok: errors.length === 0, errors };
}
