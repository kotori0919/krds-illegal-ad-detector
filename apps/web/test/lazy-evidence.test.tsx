// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { initialProgress, type HostBridge, type OfficialResult, type ScanDetailBundle } from "@krds-detector/contracts";
import { ScanResult } from "../src/screens/ScanResult.js";
import { InfrastructureAnalysis } from "../src/screens/InfrastructureAnalysis.js";
import { EvidenceView } from "../src/screens/EvidenceView.js";
import { BrowserHost } from "../src/host/browser.js";
import { evidenceHost } from "./evidence-host.js";

afterEach(() => { cleanup(); vi.useRealTimers(); });

const official: OfficialResult = { meta: { topic: "TOPIC", entry_url: "https://example.kr/", started_at: "2026-10-07T00:00:00Z",
  finished_at: "2026-10-07T00:01:00Z", elapsed_sec: 60, tool_version: "0.1.0" }, findings: [
  { id: "f1", url: "https://example.kr/", location: "#ad", is_violation: true, evidence_text: "카지노 가입", technique: "HOMOGLYPH" },
] };
const detail: ScanDetailBundle = { version: 2, findings: [], creativeImages: [],
  coverage: { checkedPages: 1, failedPages: [], timedOut: false },
  imageAnalysis: Array.from({ length: 13 }, (_, index) => ({ sourceUrl: `https://example.kr/image-${index}.png`, pageUrls: [official.meta.entry_url],
    ocr: { state: "available" as const, backend: "local", text: `인식 문구 ${index}`, confidence: 0.9 }, matchedTerms: [],
    decision: { rule: "terms", score: 0, threshold: 0.7, passed: false, detail: "no ad terms" } })),
  infrastructure: [{ domain: "ads.example", nodeId: "domain-ad", pageUrls: [official.meta.entry_url], evidenceKinds: ["official-finding"] }],
};

function resultHost(): HostBridge {
  return { ...evidenceHost(detail), getCapabilities: async () => ({ localScan: true }),
    getSession: async () => ({ id: "s1", status: "succeeded" }), getOfficialResult: async () => official,
    getExtraResult: async () => undefined, openCase: async () => undefined } as unknown as HostBridge;
}

describe("lazy operator evidence", () => {
  it("keeps image and graph evidence out of the official list, pages image analysis, and opens only requested relations", async () => {
    vi.useFakeTimers();
    const host = resultHost();
    const imageRead = vi.spyOn(host, "getImageAnalysis");
    const assetRead = vi.spyOn(host, "getEvidenceAsset");
    const graphRead = vi.spyOn(host, "getEvidenceGraphSlice").mockResolvedValue({ truncated: false,
      nodes: [{ id: "page", kind: "Page", label: official.meta.entry_url }, { id: "ad", kind: "Domain", label: "ads.example" }],
      edges: [{ from: "page", to: "ad", kind: "LINKS_TO" }] });
    function Workspace() {
      const [view, setView] = useState<"findings" | "pages" | "extra" | "coverage">("findings");
      const [infrastructure, setInfrastructure] = useState(false);
      return <><div hidden={infrastructure}><ScanResult onInfrastructure={() => setInfrastructure(true)} host={host} sessionId="s1" query="" onQueryChange={() => {}} filter="ALL" onFilterChange={() => {}}
        view={view} onViewChange={setView} reviewedIds={new Set()} onReviewMany={() => {}} onSelectionHidden={() => {}}
        onEvidence={() => {}} onExport={() => {}} onRestart={() => {}} /></div>
        {infrastructure ? <><button type="button" onClick={() => setInfrastructure(false)}>공식 탐지</button><InfrastructureAnalysis host={host} sessionId="s1" /></> : null}</>;
    }
    render(<Workspace />);
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(screen.getByText("카지노 가입")).toBeDefined();
    expect(imageRead).not.toHaveBeenCalled(); expect(assetRead).not.toHaveBeenCalled(); expect(graphRead).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "추가 분석", exact: true })); });
    expect(screen.getByText("인식 문구 11")).toBeDefined();
    expect(screen.queryByText("인식 문구 12")).toBeNull();
    expect(graphRead).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "이미지 분석 더 보기" })); });
    expect(screen.getByText("인식 문구 12")).toBeDefined();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "인프라 분석", exact: true })); });
    const infrastructure = screen.getByRole("region", { name: "광고 연관 인프라" });
    await act(async () => { fireEvent.click(within(infrastructure).getByRole("button", { name: "ads.example 근거 확인" })); });
    await act(async () => { fireEvent.click(within(infrastructure).getByRole("button", { name: "관계 보기" })); });
    expect(within(infrastructure).getByRole("region", { name: "근거 관계" }).textContent).toContain("연결");
    expect(graphRead).toHaveBeenCalledWith("s1", { focus: { kind: "domain", id: "ads.example" }, maxNodes: 100, maxEdges: 200, depth: 2 });
    fireEvent.click(screen.getByRole("button", { name: "공식 탐지", exact: true }));
    expect(screen.getByText("표시 중인 탐지 1건 / 전체 1건")).toBeDefined();
  });

  it("loads only the selected finding and displays its session asset", async () => {
    const host = resultHost();
    const findingRead = vi.spyOn(host, "getFindingDetail").mockResolvedValue({ findingId: "f1", url: official.meta.entry_url,
      location: "#ad", technique: "HOMOGLYPH", rawText: "카지노 가입", normalizedText: "카지노 가입", matchedTerms: ["카지노"], techniqueReason: "fixture",
      observed: { box: { x: 0, y: 0, width: 10, height: 10 }, css: { color: "black", backgroundColor: "white", opacity: "1", display: "block", fontSize: "16px", position: "static" } },
      visual: { state: "available", assetId: "opaque-1", capturedAt: official.meta.finished_at, mimeType: "image/jpeg" } });
    const assetRead = vi.spyOn(host, "getEvidenceAsset").mockResolvedValue({ assetId: "opaque-1", mimeType: "image/jpeg", dataUrl: "data:image/jpeg;base64,YQ==" });
    render(<EvidenceView host={host} sessionId="s1" findingId="f1" reviewed={false} onBack={() => {}} onReviewChange={() => {}} />);
    const image = await screen.findByRole("img", { name: "탐지 당시 페이지의 실제 화면" });
    expect(image.getAttribute("src")).toBe("data:image/jpeg;base64,YQ==");
    expect(findingRead).toHaveBeenCalledWith("s1", "f1");
    expect(assetRead).toHaveBeenCalledWith("s1", "opaque-1");
  });

  it("keeps replay assets session-scoped and strips their bytes from metadata", async () => {
    const host = new BrowserHost();
    const replay = { ...detail, creativeImages: [{ findingId: "e1", sourceUrl: "https://example.kr/ad.png", sha256: "a".repeat(64),
      mimeType: "image/png" as const, dataUrl: "data:image/png;base64,YQ==", width: 10, height: 10, capturedAt: official.meta.finished_at }] };
    host.setReplayResult({ id: "s1", entryUrl: official.meta.entry_url, status: "succeeded", startedAt: official.meta.started_at, progress: initialProgress("succeeded") }, official, replay);
    const summary = await host.getEvidenceSummary("s1");
    expect(JSON.stringify(summary)).not.toContain("data:image");
    const assetId = summary!.creativeImages[0]!.assetId;
    expect((await host.getEvidenceAsset("s1", assetId))?.dataUrl).toBe(replay.creativeImages[0]!.dataUrl);
    expect(await host.getEvidenceAsset("other-session", assetId)).toBeUndefined();
  });

  it("resolves a creative's persisted asset reference and shares identical finding images", async () => {
    const host = new BrowserHost();
    const dataUrl = "data:image/jpeg;base64,YQ==";
    const findingDetail = { findingId: "f1", url: official.meta.entry_url, location: "#ad", technique: "HOMOGLYPH" as const,
      rawText: "카지노 가입", normalizedText: "카지노 가입", matchedTerms: ["카지노"], techniqueReason: "fixture",
      observed: { box: { x: 0, y: 0, width: 10, height: 10 }, css: { color: "black", backgroundColor: "white", opacity: "1", display: "block", fontSize: "16px", position: "static" } },
      visual: { state: "available" as const, mimeType: "image/jpeg" as const, dataUrl } };
    const replay: ScanDetailBundle = { ...detail, findings: [findingDetail, { ...findingDetail, findingId: "f2" }],
      creativeImages: [{ assetId: "stored-creative", findingId: "e1", sourceUrl: "https://example.kr/ad.png", sha256: "a".repeat(64),
        mimeType: "image/jpeg", dataUrl, width: 10, height: 10, capturedAt: official.meta.finished_at }],
      imageAnalysis: [{ ...detail.imageAnalysis![0]!, assetId: "stored-creative" }] };
    host.setReplayResult({ id: "s1", entryUrl: official.meta.entry_url, status: "succeeded", startedAt: official.meta.started_at, progress: initialProgress("succeeded") }, official, replay);
    const first = await host.getFindingDetail("s1", "f1");
    const second = await host.getFindingDetail("s1", "f2");
    const analysis = (await host.getImageAnalysis("s1"))!.items[0]!;
    expect(analysis.assetId).toBe(first!.visual.assetId);
    expect(second!.visual.assetId).toBe(first!.visual.assetId);
    expect((await host.getEvidenceAsset("s1", analysis.assetId!))!.dataUrl).toBe(dataUrl);
    expect(JSON.stringify(first)).not.toContain(dataUrl);
  });

  it("shows image-only OCR text first and retrieves only the selected extra finding's image evidence", async () => {
    vi.useFakeTimers();
    const host = new BrowserHost();
    const imageOnly = { id: "image-only-1", url: official.meta.entry_url, location: "#visual-1", is_violation: true as const,
      technique: "ETC" as const, extra_finding: "IMAGE_ONLY_ILLEGAL_AD" as const, evidence_text: "카지노 이미지 가입 이벤트" };
    const other = { ...imageOnly, id: "image-only-2", url: "https://example.kr/sub-page", location: "#visual-2", evidence_text: "다른 이미지 광고" };
    const replay: ScanDetailBundle = { ...detail, creativeImages: [], imageAnalysis: [
      { ...detail.imageAnalysis![0]!, extraFindingId: imageOnly.id, assetId: "stored-target", destinationUrl: "https://ads.example/offer",
        ocrAlternatives: [{state:"available",backend:"other-actual-reading",text:"다른 원문\n30%",confidence:0.8}],
        ocr: { state: "available", backend: "local", text: imageOnly.evidence_text, confidence: 0.9 }, matchedTerms: ["카지노"] },
      { ...detail.imageAnalysis![1]!, extraFindingId: other.id, assetId: "stored-other" },
    ], visualAssets: [
      { assetId: "stored-target", mimeType: "image/png", dataUrl: "data:image/png;base64,YQ==" },
      { assetId: "stored-other", mimeType: "image/png", dataUrl: "data:image/png;base64,Yg==" },
    ] };
    host.setReplayResult({ id: "s1", entryUrl: official.meta.entry_url, status: "succeeded", startedAt: official.meta.started_at,
      progress: initialProgress("succeeded") }, { ...official, findings: [] }, replay,
    { meta: official.meta, findings: [imageOnly, other] });
    const analyses = vi.spyOn(host, "getImageAnalysis");
    const assets = vi.spyOn(host, "getEvidenceAsset");
    render(<ScanResult simple host={host} sessionId="s1" query="" onQueryChange={() => {}} filter="ALL" onFilterChange={() => {}}
      view="extra" onViewChange={() => {}} reviewedIds={new Set()} onReviewMany={() => {}} onSelectionHidden={() => {}}
      onEvidence={() => {}} onExport={() => {}} onRestart={() => {}} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    const card = screen.getAllByRole("heading", { name: "이미지 광고 검토 후보" })[0]!.closest("li")!;
    expect(within(card).getByText(imageOnly.evidence_text).closest("details")).toBeNull();
    expect(screen.getAllByText("이미지 문자와 광고 관련 단서를 확인한 검토 후보입니다. 원문과 연결 주소를 검토해 주세요.")).toHaveLength(1);
    expect(within(card).queryByText("관련 주소")).toBeNull();
    expect(screen.getByText(other.url)).toBeDefined();
    expect(screen.queryByText("수집한 이미지가 없습니다.")).toBeNull();
    expect(assets).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(within(card).getByRole("button", { name: "1번 이미지 근거 보기" })); });
    expect(within(card).getByRole("img").getAttribute("src")).toBe("data:image/png;base64,YQ==");
    expect(screen.getAllByRole("img")).toHaveLength(1);
    const destination = within(card).getByText("https://ads.example/offer");
    expect(destination.closest("a")).toBeNull();
    expect(destination.closest("dd")?.parentElement?.querySelector("dt")?.textContent).toBe("관측한 연결 주소");
    const alternative = within(card).getByText("다른 원문 30%");
    expect(alternative.textContent).toBe("다른 원문\n30%");
    expect(alternative.closest("details")?.open).toBe(false);
    expect(within(card).getByText("다른 인식 원문 1건 보기").tagName).toBe("SUMMARY");
    expect(analyses).toHaveBeenLastCalledWith("s1", { extraFindingId: imageOnly.id, limit: 1 });
    expect(assets).toHaveBeenCalledTimes(1);
  });
});
