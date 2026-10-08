// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { EvidenceAsset, FindingDetailView, HostBridge, ImageAnalysisPage, OfficialResult, VisualAnalysisCoverage } from "@krds-detector/contracts";
import { initialProgress, serializeOfficialResult } from "@krds-detector/contracts";
import { AssetImage } from "../src/screens/AssetImage.js";
import { EvidenceView } from "../src/screens/EvidenceView.js";
import { ScanResult } from "../src/screens/ScanResult.js";
import { VisualCoverage } from "../src/screens/VisualCoverage.js";
import { evidenceHost } from "./evidence-host.js";
import { ExportDialog } from "../src/screens/ExportDialog.js";
import { BrowserHost } from "../src/host/browser.js";

afterEach(() => { cleanup(); vi.useRealTimers(); });
const official: OfficialResult = { meta: { topic: "TOPIC", entry_url: "https://example.kr", started_at: "2026-10-07T00:00:00Z", finished_at: "2026-10-07T00:01:00Z", elapsed_sec: 60, tool_version: "0.1.0" },
  findings: [{ id: "a", url: "https://example.kr/a", is_violation: true, location: "#a", technique: "JAMO", evidence_text: "첫 번째 공식 문구" },
    { id: "b", url: "https://example.kr/b", is_violation: true, location: "#b", technique: "JAMO", evidence_text: "두 번째 공식 문구" }] };
const detail = (id: string): FindingDetailView => ({ findingId: id, url: `https://example.kr/${id}`, location: `#${id}`, technique: "JAMO", rawText: id,
  normalizedText: `변환 문구 ${id}`, matchedTerms: [], techniqueReason: "fixture", observed: { box: { x: 0, y: 0, width: 10, height: 10 }, css: { color: "black", backgroundColor: "white", opacity: "1", display: "block", fontSize: "16px", position: "static" } }, visual: { state: "unavailable", reason: "budget" } });
const baseHost = (): HostBridge => ({ ...evidenceHost({ version: 2, findings: [], creativeImages: [], coverage: { checkedPages: 2, failedPages: [], timedOut: false } }),
  getCapabilities: async () => ({ localScan: true }), getSession: async () => ({ id: "s1", status: "succeeded", hasResult: true }), getOfficialResult: async () => official,
  getExtraResult: async () => ({ meta: official.meta, findings: [] }) } as unknown as HostBridge);
function Results({ host, sessionId = "s1", view = "findings" }: { host: HostBridge; sessionId?: string; view?: "findings" | "extra" }) {
  return <ScanResult host={host} sessionId={sessionId} query="" onQueryChange={() => {}} filter="ALL" onFilterChange={() => {}} view={view} onViewChange={() => {}}
    reviewedIds={new Set()} onReviewMany={() => {}} onSelectionHidden={() => {}} onEvidence={() => {}} onExport={() => {}} onRestart={() => {}} />;
}
const advance = async () => { await act(async () => { await vi.advanceTimersByTimeAsync(500); }); };

describe("operator evidence read recovery", () => {
  it("recovers the failed summary without losing official findings or restarting other reads", async () => {
    vi.useFakeTimers(); const host = baseHost(); const summary = await host.getEvidenceSummary("s1");
    const read = vi.spyOn(host, "getEvidenceSummary").mockRejectedValueOnce(new Error("private")).mockResolvedValue(summary);
    const officialRead = vi.spyOn(host, "getOfficialResult"); const coverageRead = vi.spyOn(host, "getScanCoverage");
    render(<Results host={host} />); await advance();
    expect(screen.getByRole("alert").textContent).toContain("근거 요약");
    expect(screen.getByText(official.findings[0]!.evidence_text)).toBeDefined();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "근거 요약 다시 불러오기" })); });
    expect(screen.queryByRole("alert")).toBeNull(); expect(read).toHaveBeenCalledTimes(2);
    expect(officialRead).toHaveBeenCalledTimes(1); expect(coverageRead).toHaveBeenCalledTimes(1);
    expect((screen.getByRole("button", { name: "공식 JSON 저장" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("retries detail alone and excludes delayed metadata from a previous selection", async () => {
    const host = baseHost(); let resolveOld!: (value: FindingDetailView) => void;
    const reads = vi.spyOn(host, "getFindingDetail").mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
      .mockRejectedValueOnce(new Error("private")).mockResolvedValue(detail("b"));
    const officialRead = vi.spyOn(host, "getOfficialResult");
    const props = { host, sessionId: "s1", reviewed: false, onBack: () => {}, onReviewChange: () => {} };
    const ui = render(<EvidenceView {...props} findingId="a" />);
    expect(await screen.findByText(official.findings[0]!.evidence_text)).toBeDefined();
    ui.rerender(<EvidenceView {...props} findingId="b" />);
    expect(screen.queryByText(official.findings[0]!.evidence_text)).toBeNull();
    await screen.findByRole("alert");
    await act(async () => { resolveOld(detail("a")); });
    expect(screen.queryByText("변환 문구 a")).toBeNull();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "판단 근거 다시 불러오기" })); });
    expect(screen.getByText("변환 문구 b")).toBeDefined();
    expect(reads).toHaveBeenCalledTimes(3); expect(officialRead).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("heading", { name: "탐지 상세" })).toBe(document.activeElement);
  });

  it("removes the previous asset immediately, ignores its late response and retries the new asset", async () => {
    const host = baseHost(); let resolveOld!: (value: EvidenceAsset) => void;
    const read = vi.spyOn(host, "getEvidenceAsset").mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
      .mockRejectedValueOnce(new Error("private")).mockResolvedValue({ assetId: "b", mimeType: "image/png", dataUrl: "data:image/png;base64,Yg==" });
    const ui = render(<AssetImage host={host} sessionId="s1" assetId="a" alt="선택 이미지" />);
    ui.rerender(<AssetImage host={host} sessionId="s2" assetId="b" alt="선택 이미지" />);
    await screen.findByRole("alert");
    await act(async () => { resolveOld({ assetId: "a", mimeType: "image/png", dataUrl: "data:image/png;base64,YQ==" }); });
    expect(screen.queryByRole("img")).toBeNull();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "이미지 다시 불러오기" })); });
    expect(screen.getByRole("img").getAttribute("src")).toBe("data:image/png;base64,Yg==");
    expect(read).toHaveBeenLastCalledWith("s2", "b");
    expect(document.activeElement).toBe(screen.getByRole("img"));
  });

  it("does not flash an already loaded asset during a selection change", async () => {
    const host = baseHost();
    vi.spyOn(host, "getEvidenceAsset").mockResolvedValueOnce({ assetId: "a", mimeType: "image/png", dataUrl: "data:image/png;base64,YQ==" })
      .mockImplementationOnce(() => new Promise(() => {}));
    const ui = render(<AssetImage host={host} sessionId="s1" assetId="a" alt="선택 이미지" />);
    await screen.findByRole("img");
    ui.rerender(<AssetImage host={host} sessionId="s1" assetId="b" alt="선택 이미지" />);
    expect(screen.queryByRole("img")).toBeNull(); expect(screen.getByRole("status").textContent).toContain("불러오는 중");
  });

  it("shows native null assets as absent without offering a retrieval retry", async () => {
    const host = baseHost();
    vi.spyOn(host, "getEvidenceAsset").mockResolvedValueOnce(null as unknown as undefined)
      .mockResolvedValueOnce({ assetId: "a", mimeType: "image/png", dataUrl: "data:image/png;base64,YQ==" });
    render(<AssetImage host={host} sessionId="s1" assetId="a" alt="선택 이미지" />);
    expect(await screen.findByText("이 결과에 저장된 수집 이미지가 없습니다.")).toBeDefined();
    expect(screen.queryByRole("button", { name: "이미지 다시 불러오기" })).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("removes an asset from a previous host even when the session and asset identity stay the same", async () => {
    const firstHost = baseHost(); const secondHost = baseHost();
    vi.spyOn(firstHost, "getEvidenceAsset").mockResolvedValue({ assetId: "a", mimeType: "image/png", dataUrl: "data:image/png;base64,YQ==" });
    let complete!: (value: EvidenceAsset) => void;
    vi.spyOn(secondHost, "getEvidenceAsset").mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
    const ui = render(<AssetImage host={firstHost} sessionId="s1" assetId="a" alt="선택 이미지" />);
    await screen.findByRole("img");
    ui.rerender(<AssetImage host={secondHost} sessionId="s1" assetId="a" alt="선택 이미지" />);
    expect(screen.queryByRole("img")).toBeNull();
    await act(async () => { complete({ assetId: "a", mimeType: "image/png", dataUrl: "data:image/png;base64,Yg==" }); });
    expect(screen.getByRole("img").getAttribute("src")).toBe("data:image/png;base64,Yg==");
  });

  it("retries a failed image page while preserving already displayed records", async () => {
    vi.useFakeTimers(); const host = baseHost();
    const item = { sourceUrl: "https://example.kr/a.png", pageUrls: ["https://example.kr"], ocr: { state: "available" as const, backend: "local", text: "분석한 문구", confidence: 0.8 }, matchedTerms: [], decision: { rule: "fixture", score: 0, threshold: 1, passed: false, detail: "fixture" } };
    const read = vi.spyOn(host, "getImageAnalysis").mockResolvedValueOnce({ items: [item], total: 2, nextCursor: 1 })
      .mockRejectedValueOnce(new Error("private")).mockResolvedValueOnce({ items: [{ ...item, sourceUrl: "https://example.kr/b.png", ocr: { ...item.ocr, text: "다음 분석 문구" } }], total: 2 });
    render(<Results host={host} view="extra" />); await advance();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "이미지 분석 더 보기" })); });
    expect(screen.getByText("분석한 문구")).toBeDefined(); expect(screen.getByRole("alert").textContent).toContain("이미지 문자 분석");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "이미지 문자 분석 다시 불러오기" })); });
    expect(screen.getByText("다음 분석 문구")).toBeDefined(); expect(read).toHaveBeenLastCalledWith("s1", { cursor: 1, limit: 12 });
  });

  it("recovers selected image evidence without refreshing the other analysis page or official list", async () => {
    vi.useFakeTimers(); const host = baseHost();
    const finding = { id: "extra-a", url: "https://example.kr/a", location: "#image", is_violation: true as const, technique: "ETC" as const,
      extra_finding: "IMAGE_ONLY_ILLEGAL_AD" as const, evidence_text: "선택 이미지 광고 원문" };
    vi.spyOn(host, "getExtraResult").mockResolvedValue({ meta: official.meta, findings: [finding] });
    const read = vi.spyOn(host, "getImageAnalysis").mockResolvedValueOnce({ items: [], total: 0 }).mockRejectedValueOnce(new Error("private"))
      .mockResolvedValueOnce({ items: [{ sourceUrl: "https://example.kr/a.png", pageUrls: [finding.url], extraFindingId: finding.id,
        ocr: { state: "available", backend: "local", text: finding.evidence_text, confidence: 0.8 }, matchedTerms: ["카지노"],
        decision: { rule: "fixture", score: 3, threshold: 3, passed: true, detail: "fixture" } }], total: 1 });
    const officialRead = vi.spyOn(host, "getOfficialResult");
    render(<Results host={host} view="extra" />); await advance();
    const card = screen.getByRole("heading", { name: "이미지 안의 불법 광고" }).closest("li")!;
    await act(async () => { fireEvent.click(within(card).getByRole("button", { name: "이미지 근거 보기" })); });
    expect(within(card).getByRole("alert")).toBeDefined();
    await act(async () => { fireEvent.click(within(card).getByRole("button", { name: "이미지 근거 다시 불러오기" })); });
    expect(within(card).getByText("광고 표현 확인")).toBeDefined();
    expect(read).toHaveBeenCalledTimes(3); expect(read).toHaveBeenLastCalledWith("s1", { extraFindingId: finding.id, limit: 1 });
    expect(officialRead).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(within(card).getByRole("button", { name: "이미지 근거 닫기" }));
  });

  it("discards old session pagination responses and shows the new session without old images", async () => {
    vi.useFakeTimers(); const host = baseHost(); let resolveNext!: (value: ImageAnalysisPage) => void;
    const item = { sourceUrl: "https://example.kr/a.png", pageUrls: ["https://example.kr"], ocr: { state: "available" as const, backend: "local", text: "이전 세션 문구", confidence: 0.8 }, matchedTerms: [], decision: { rule: "fixture", score: 0, threshold: 1, passed: false, detail: "fixture" } };
    vi.spyOn(host, "getImageAnalysis").mockResolvedValueOnce({ items: [item], total: 2, nextCursor: 1 })
      .mockImplementationOnce(() => new Promise((resolve) => { resolveNext = resolve; })).mockResolvedValue({ items: [], total: 0 });
    const ui = render(<Results host={host} view="extra" />); await advance();
    fireEvent.click(screen.getByRole("button", { name: "이미지 분석 더 보기" }));
    ui.rerender(<Results host={host} sessionId="s2" view="extra" />);
    expect(screen.queryByText("이전 세션 문구")).toBeNull(); await advance();
    await act(async () => { resolveNext({ items: [item], total: 2 }); });
    expect(screen.queryByText("이전 세션 문구")).toBeNull();
    expect(screen.getByText(/저장된 문자 분석 이미지가 없습니다/)).toBeDefined();
  });

  it("keeps official saved content independent of temporary review marks", async () => {
    const host = new BrowserHost();
    host.setReplayResult({ id: "s1", entryUrl: official.meta.entry_url, status: "succeeded", startedAt: official.meta.started_at, progress: initialProgress("succeeded") }, official,
      { version: 2, findings: [detail("a"), detail("b")], creativeImages: [], coverage: { checkedPages: 2, failedPages: [], timedOut: false } });
    const before = JSON.stringify(await host.getOfficialResult("s1"));
    function Workspace() {
      const [reviewed, setReviewed] = useState(false);
      const [exportOpen, setExportOpen] = useState(false);
      return <><EvidenceView host={host} sessionId="s1" findingId="a" reviewed={reviewed} onReviewChange={setReviewed} onBack={() => {}} />
        <button type="button" onClick={() => setExportOpen(true)}>저장 확인</button>
        {exportOpen ? <ExportDialog host={host} sessionId="s1" onClose={() => setExportOpen(false)} /> : null}</>;
    }
    render(<Workspace />); await screen.findByText(official.findings[0]!.evidence_text);
    fireEvent.click(screen.getByRole("button", { name: "검토 완료로 표시" }));
    expect(screen.getByRole("button", { name: "검토 완료 취소" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "저장 확인" }));
    const exportDialog = await screen.findByRole("dialog");
    const save = within(exportDialog).getByRole("button", { name: "저장", exact: true }) as HTMLButtonElement;
    await waitFor(() => expect(save.disabled).toBe(false));
    let saved: Blob | undefined;
    const originalCreate = URL.createObjectURL; const originalRevoke = URL.revokeObjectURL;
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    URL.createObjectURL = ((blob: Blob) => { saved = blob; return "blob:operator-save"; }) as typeof URL.createObjectURL;
    URL.revokeObjectURL = () => {};
    try { await act(async () => { fireEvent.click(save); }); }
    finally { URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke; click.mockRestore(); }
    const savedText = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsText(saved!);
    });
    expect(savedText).toBe(serializeOfficialResult(official));
    expect(JSON.stringify(await host.getOfficialResult("s1"))).toBe(before);
    expect((await host.getOfficialResult("s1"))?.findings).toEqual(official.findings);
  });
});

describe("measured operator coverage", () => {
  it("keeps page work, records and unique OCR work distinct without inventing candidate totals", () => {
    const coverage: VisualAnalysisCoverage = { pagesConsidered: 8, pagesNotConsidered: 2, candidatesObserved: 16, candidateTotal: null,
      imagesAcquired: 9, imageAnalysisRecords: 9, ocrImagesAttempted: 6, ocrImagesCompleted: 5, ocrImagesUnavailable: 1,
      limits: { pages: 8, candidatesPerDocument: 8, elementsPerDocument: 10000, bytesPerPage: 250000, distinctOcrImages: 6 },
      limitsReached: ["page-limit", "ocr-image-limit"], skips: [{ reason: "page-limit", unit: "page", count: 2 }, { reason: "capture-error", unit: "image", count: 1 }] };
    render(<VisualCoverage coverage={coverage} />);
    expect(screen.getByText(/16개 · 전체 후보 수 알 수 없음/)).toBeDefined();
    expect(screen.getByText(/시도 6개 · 완료 5개 · 분석 불가 1개/)).toBeDefined();
    expect(within(screen.getByRole("list", { name: "이미지 분석 제외 및 실패 사유" })).getByText(/이미지 촬영 실패/)).toBeDefined();
  });
});
