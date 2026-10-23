// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { EvidenceGraphSlice, EvidenceSummary, OpenCase, OfficialResult } from "@krds-detector/contracts";
import { BrowserHost } from "../src/host/browser.js";
import { InfrastructureAnalysis } from "../src/screens/InfrastructureAnalysis.js";

afterEach(cleanup);

const official: OfficialResult = { meta: { topic: "TOPIC", entry_url: "https://agency.example/",
  started_at: "2026-10-20T00:00:00Z", finished_at: "2026-10-20T00:01:00Z", elapsed_sec: 60, tool_version: "0.2.1" }, findings: [
  { id: "finding-1", url: "https://agency.example/a", location: "a.ad", is_violation: true,
    technique: "OFFSCREEN", evidence_text: "카지노 광고" },
] };
const summary: EvidenceSummary = { graphAvailable: true, observedDomainCount: 30, imageAnalysisCount: 0, creativeImages: [], infrastructure: [
  { domain: "single.example", nodeId: "d1", pageUrls: ["https://agency.example/c", "https://agency.example/c"], evidenceKinds: ["ocr-positive-ad-creative"] },
  { domain: "repeated.example", nodeId: "d2", pageUrls: ["https://agency.example/a", "https://agency.example/b"], evidenceKinds: ["official-finding", "repeated-ad-creative"] },
  { domain: "another.example", nodeId: "d3", pageUrls: ["https://agency.example/a", "https://agency.example/b"], evidenceKinds: ["official-finding"] },
] };
const graph: EvidenceGraphSlice = { truncated: false, nodes: [
  { id: "d2", kind: "Domain", label: "repeated.example" },
  { id: "element", kind: "Element", label: "a.ad", findingId: "finding-1", adRelated: true },
], edges: [{ from: "element", to: "d2", kind: "LINKS_TO", evidenceKinds: ["official-finding"] }] };

function fixture() {
  const host = new BrowserHost();
  const readSummary = vi.spyOn(host, "getEvidenceSummary").mockResolvedValue(summary);
  vi.spyOn(host, "getOfficialResult").mockResolvedValue(official);
  const readGraph = vi.spyOn(host, "getEvidenceGraphSlice").mockResolvedValue(graph);
  const scan = vi.spyOn(host, "startScan");
  const register = vi.spyOn(host, "registerWarp");
  const ready = vi.spyOn(host, "getWarpStatus");
  return { host, readSummary, readGraph, scan, register, ready };
}

describe("single-case infrastructure analysis", () => {
  it("shows ad-witness domains in page-count order and filters without fresh collection", async () => {
    const { host, readGraph, scan, register, ready } = fixture();
    render(<InfrastructureAnalysis host={host} sessionId="case-1" />);
    const list = await screen.findByRole("list", { name: "광고 연관 도메인" });
    const items = within(list).getAllByRole("listitem");
    expect(items.map(item => within(item).getByRole("button").textContent)).toEqual(["another.example 근거 확인", "repeated.example 근거 확인", "single.example 근거 확인"]);
    expect(screen.getByText("https://agency.example/")).toBeDefined();
    expect(screen.getByText("연결 기록 없음 · 당시 연결 방식을 확인할 수 없습니다.")).toBeDefined();
    fireEvent.click(screen.getByLabelText("반복 관측만"));
    expect(within(list).queryByText("single.example")).toBeNull();
    fireEvent.change(screen.getByLabelText("도메인 검색"), { target: { value: "REPEATED" } });
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    fireEvent.change(screen.getByLabelText("근거 종류"), { target: { value: "ocr-positive-ad-creative" } });
    expect(screen.getByText("검색·필터 조건에 맞는 도메인이 없습니다.")).toBeDefined();
    expect(readGraph).not.toHaveBeenCalled();
    expect(scan).not.toHaveBeenCalled();
    expect(register).not.toHaveBeenCalled();
    expect(ready).not.toHaveBeenCalled();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("distinguishes a failed or unavailable summary from zero and retries only that read", async () => {
    const { host, readSummary } = fixture();
    readSummary.mockRejectedValueOnce(new Error("temporary")).mockResolvedValueOnce(undefined).mockResolvedValueOnce({ ...summary, infrastructure: [] });
    render(<InfrastructureAnalysis host={host} sessionId="case-1" />);
    expect((await screen.findByRole("alert")).textContent).toContain("인프라");
    expect(screen.queryByText("광고 근거와 연결된 외부 도메인이 없습니다.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "인프라 다시 불러오기" }));
    expect(await screen.findByText("이 결과에 저장된 인프라 분석 기록이 없습니다.")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "인프라 다시 불러오기" }));
    expect(await screen.findByText("광고 근거와 연결된 외부 도메인이 없습니다.")).toBeDefined();
    expect(readSummary).toHaveBeenCalledTimes(3);
  });

  it("keeps a saved domain list when optional metadata cannot be read", async () => {
    const { host } = fixture();
    vi.spyOn(host, "getSession").mockRejectedValue(new Error("unavailable session"));
    vi.spyOn(host, "getOfficialResult").mockRejectedValue(new Error("unavailable metadata"));
    render(<InfrastructureAnalysis host={host} sessionId="case-1" />);
    expect(await screen.findByRole("list", { name: "광고 연관 도메인" })).toBeDefined();
    expect(screen.getByText("대상 주소 기록 없음")).toBeDefined();
    expect(screen.getByRole("button", { name: "대상 기록 다시 불러오기" })).toBeDefined();
    expect(screen.queryByText("광고 근거와 연결된 외부 도메인이 없습니다.")).toBeNull();
  });

  it("clears prior selection and ignores a prior case read when the case changes", async () => {
    const { host, readSummary } = fixture();
    let resolvePrior!: (value: EvidenceSummary) => void;
    readSummary.mockReturnValueOnce(new Promise<EvidenceSummary>(resolve => { resolvePrior = resolve; }))
      .mockResolvedValueOnce({ ...summary, infrastructure: [] });
    const { rerender } = render(<InfrastructureAnalysis host={host} sessionId="case-1" />);
    expect(screen.getByText("저장된 인프라를 불러오는 중입니다.")).toBeDefined();
    rerender(<InfrastructureAnalysis host={host} sessionId="case-2" />);
    await screen.findByText("광고 근거와 연결된 외부 도메인이 없습니다.");
    await act(async () => { resolvePrior(summary); });
    expect(screen.queryByRole("list", { name: "광고 연관 도메인" })).toBeNull();
    expect(screen.queryByRole("button", { name: "repeated.example 근거 확인" })).toBeNull();
  });

  it("opens bounded saved relations and navigates to the original finding", async () => {
    const { host, readGraph, scan } = fixture();
    const onSelect = vi.fn();
    render(<InfrastructureAnalysis host={host} sessionId="case-1" onSelectFinding={onSelect} />);
    const source = await screen.findByRole("button", { name: "repeated.example 근거 확인" });
    fireEvent.click(source);
    const details = screen.getByRole("region", { name: "repeated.example 근거" });
    expect(within(details).getByText("https://agency.example/a")).toBeDefined();
    expect(readGraph).not.toHaveBeenCalled();
    fireEvent.click(within(details).getByRole("button", { name: "관계 보기" }));
    const relations = await screen.findByRole("region", { name: "근거 관계" });
    fireEvent.click(within(relations).getByRole("button", { name: "원본 요소 finding-1" }));
    fireEvent.click(within(relations).getByRole("button", { name: "원본 기록 finding-1 열기" }));
    expect(onSelect).toHaveBeenCalledWith("finding-1");
    expect(readGraph).toHaveBeenCalledWith("case-1", { focus: { kind: "domain", id: "repeated.example" }, maxNodes: 100, maxEdges: 200, depth: 2 });
    fireEvent.click(screen.getByRole("button", { name: "도메인 목록으로" }));
    expect(document.activeElement).toBe(source);
    expect(scan).not.toHaveBeenCalled();
  });

  it.each(["direct", "warp"] as const)("uses recorded %s transport even without a live tunnel", async kind => {
    const { host, ready } = fixture();
    const opened: OpenCase = { manifest: { schemaVersion: 1, caseId: "case-1", entryUrl: official.meta.entry_url,
      startedAt: official.meta.started_at, finishedAt: official.meta.finished_at, status: "succeeded", toolVersion: "0.2.1",
      policyVersion: 2, exportableAt: official.meta.finished_at, officialSha256: "a".repeat(64), findings: 1, issues: [],
      settings: { transport: kind === "direct" ? { kind, reason: "operator" } : { kind, backend: "usque", version: "4.2.1" } } },
    directory: "saved", review: { schemaVersion: 1, revision: 0, updatedAt: "", records: [] } };
    vi.spyOn(host, "openCase").mockResolvedValue(opened);
    render(<InfrastructureAnalysis host={host} sessionId="case-1" />);
    expect(await screen.findByText(kind === "direct" ? "기본 연결 (앱 전용 WARP 미사용)" : "WARP 연결 (저장된 점검 기록)")).toBeDefined();
    expect(ready).not.toHaveBeenCalled();
  });

  it("does not describe unavailable graph analysis as zero even with saved domains", async () => {
    const { host, readSummary } = fixture();
    readSummary.mockResolvedValue({ ...summary, graphAvailable: false });
    render(<InfrastructureAnalysis host={host} sessionId="case-1" />);
    expect(await screen.findByText("이 사례의 관계 분석 기록을 사용할 수 없습니다. 보관된 도메인 목록은 확인할 수 있습니다.")).toBeDefined();
    expect(screen.getByRole("list", { name: "광고 연관 도메인" })).toBeDefined();
    expect(screen.queryByText("광고 근거와 연결된 외부 도메인이 없습니다.")).toBeNull();
  });
});
