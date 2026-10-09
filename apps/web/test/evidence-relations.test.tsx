// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { EvidenceGraphSlice, HostBridge } from "@krds-detector/contracts";
import { EvidenceRelations } from "../src/screens/EvidenceRelations.js";

afterEach(cleanup);
const graph: EvidenceGraphSlice = {
  truncated: true,
  nodes: [
    { id: "page", kind: "Page", label: "https://example.kr/news?private=long", url: "https://example.kr/news?private=long" },
    { id: "element", kind: "Element", label: "iframe#ad >>> div:nth-child(99)" },
    { id: "creative", kind: "Creative", label: "a".repeat(64), creativeId: "a".repeat(64) },
    { id: "destination", kind: "Landing", label: "https://links.example/signup?long=query" },
    { id: "redirect", kind: "Redirect", label: "https://redirect.example/banners" },
    { id: "resource", kind: "Resource", label: `https://images.example/assets/${"b".repeat(64)}.png` },
  ],
  edges: [
    { from: "page", to: "element", kind: "CONTAINS", evidenceKinds: ["official-finding"] },
    { from: "element", to: "creative", kind: "DISPLAYS", evidenceKinds: ["ocr-positive-ad-creative"] },
    { from: "element", to: "destination", kind: "LINKS_TO" },
    { from: "page", to: "redirect", kind: "REDIRECTS_TO", evidenceKinds: ["ad-candidate-resource-redirect"] },
    { from: "element", to: "resource", kind: "LOADS" },
  ],
};
function hostWith(read: HostBridge["getEvidenceGraphSlice"]): HostBridge {
  return { getEvidenceGraphSlice: read } as HostBridge;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("operator relationship reads", () => {
  it("explains observed relations with readable labels and keeps exact identities in disclosure", async () => {
    const host = hostWith(vi.fn().mockResolvedValue(graph));
    render(<EvidenceRelations host={host} sessionId="s1" focus={{ kind: "finding", id: "f1" }} />);
    expect(screen.queryByRole("region", { name: "근거 관계" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "관계 보기" }));
    const region = await screen.findByRole("region", { name: "근거 관계" });
    const primary = within(region).getAllByRole("list")[0]!;
    expect(primary.textContent).toContain("페이지 · example.kr/news");
    expect(primary.textContent).toContain("탐지 요소 2");
    expect(primary.textContent).toContain("이미지 소재 3");
    expect(primary.textContent).toContain("링크 목적지 · links.example/signup");
    expect(primary.textContent).toContain("관측된 리디렉션");
    expect(primary.textContent).toContain("자료 호스트 · images.example");
    expect(primary.textContent).toContain("페이지 문구에서 탐지 근거가 확인됨");
    expect(primary.textContent).toContain("이미지 인식 문구와 보조 근거");
    expect(primary.textContent).not.toContain("a".repeat(64));
    expect(primary.textContent).not.toContain("b".repeat(64));
    expect(primary.textContent).not.toContain("nth-child");
    expect(primary.textContent).not.toContain("?private");
    expect(region.textContent).toContain("일부 관계만 표시합니다");
    const technical = within(region).getByText("관계 기술 정보").closest("details")!;
    expect(technical.open).toBe(false);
    expect(technical.textContent).toContain("a".repeat(64));
    expect(technical.textContent).toContain(`https://images.example/assets/${"b".repeat(64)}.png`);
    expect(technical.textContent).toContain("iframe#ad >>> div:nth-child(99)");
    const close = screen.getByRole("button", { name: "관계 닫기" });
    close.focus(); fireEvent.click(close);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "관계 보기" }));
    expect(screen.queryByRole("region", { name: "근거 관계" })).toBeNull();
  });

  it("recovers a failed graph read without changing its bounds or starting a scan", async () => {
    const read = vi.fn().mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValueOnce({ nodes: [], edges: [], truncated: false });
    const host = hostWith(read);
    render(<EvidenceRelations host={host} sessionId="s1" focus={{ kind: "domain", id: "ads.example" }} />);
    fireEvent.click(screen.getByRole("button", { name: "관계 보기" }));
    expect(screen.getByRole("status").textContent).toContain("불러오는 중");
    expect((await screen.findByRole("alert")).textContent).toContain("이 조회만");
    fireEvent.click(screen.getByRole("button", { name: "관계 다시 시도" }));
    expect(await screen.findByText("선택한 항목에 연결된 관계가 없습니다.")).toBeDefined();
    expect(read.mock.calls).toEqual(Array.from({ length: 2 }, () => ["s1", {
      focus: { kind: "domain", id: "ads.example" }, maxNodes: 100, maxEdges: 200, depth: 2,
    }]));
  });

  it.each(["session", "focus", "host"])("ignores a late read after the %s changes", async (change) => {
    const prior = deferred<EvidenceGraphSlice | undefined>();
    const host = hostWith(vi.fn().mockReturnValue(prior.promise));
    const nextHost = hostWith(vi.fn().mockResolvedValue(undefined));
    const { rerender } = render(<EvidenceRelations host={host} sessionId="s1" focus={{ kind: "finding", id: "f1" }} />);
    fireEvent.click(screen.getByRole("button", { name: "관계 보기" }));
    rerender(<EvidenceRelations host={change === "host" ? nextHost : host} sessionId={change === "session" ? "s2" : "s1"}
      focus={{ kind: "finding", id: change === "focus" ? "f2" : "f1" }} />);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("region", { name: "근거 관계" })).toBeNull();
    await act(async () => { prior.resolve(graph); });
    expect(screen.queryByRole("region", { name: "근거 관계" })).toBeNull();
    expect(screen.getByRole("button", { name: "관계 보기" }).getAttribute("aria-expanded")).toBe("false");
  });

  it("discards cached prior-focus evidence and distinguishes unavailable records", async () => {
    const read = vi.fn().mockResolvedValueOnce(graph).mockResolvedValueOnce(undefined);
    const host = hostWith(read);
    const { rerender } = render(<EvidenceRelations host={host} sessionId="s1" focus={{ kind: "finding", id: "f1" }} />);
    fireEvent.click(screen.getByRole("button", { name: "관계 보기" }));
    await screen.findByRole("region", { name: "근거 관계" });
    fireEvent.click(screen.getByRole("button", { name: "관계 닫기" }));
    rerender(<EvidenceRelations host={host} sessionId="s1" focus={{ kind: "finding", id: "f2" }} />);
    fireEvent.click(screen.getByRole("button", { name: "관계 보기" }));
    expect(await screen.findByText("이 결과에 저장된 관계 분석 기록이 없습니다.")).toBeDefined();
    expect(screen.queryByText(/관련 항목 6개/)).toBeNull();
  });

  it("does not revive cached evidence when the host changes away and back", async () => {
    const host = hostWith(vi.fn().mockResolvedValueOnce(graph).mockResolvedValueOnce({ nodes: [], edges: [], truncated: false }));
    const other = hostWith(vi.fn().mockResolvedValue(undefined));
    const props = { sessionId: "s1", focus: { kind: "finding" as const, id: "f1" } };
    const { rerender } = render(<EvidenceRelations host={host} {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "관계 보기" }));
    await screen.findByRole("region", { name: "근거 관계" });
    rerender(<EvidenceRelations host={other} {...props} />);
    expect(screen.queryByRole("region", { name: "근거 관계" })).toBeNull();
    rerender(<EvidenceRelations host={host} {...props} />);
    expect(screen.queryByRole("region", { name: "근거 관계" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "관계 보기" }));
    expect(await screen.findByText("선택한 항목에 연결된 관계가 없습니다.")).toBeDefined();
  });

  it("reopens a successfully absent relationship record without treating it as a failed read", async () => {
    const read = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("unnecessary second read"));
    render(<EvidenceRelations host={hostWith(read)} sessionId="s1" focus={{ kind: "finding", id: "f1" }} />);
    fireEvent.click(screen.getByRole("button", { name: "관계 보기" }));
    expect(await screen.findByText("이 결과에 저장된 관계 분석 기록이 없습니다.")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "관계 닫기" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "관계 보기" })); });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button", { name: "관계 다시 시도" })).toBeNull();
    expect(within(screen.getByRole("region", { name: "근거 관계" })).getByText("이 결과에 저장된 관계 분석 기록이 없습니다.")).toBeDefined();
  });
});
