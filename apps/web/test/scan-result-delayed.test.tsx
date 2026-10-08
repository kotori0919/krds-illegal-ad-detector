// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { ScanResult } from "../src/screens/ScanResult.js";
import type { HostBridge, OfficialResult, ScanCoverageView } from "@krds-detector/contracts";
import { evidenceHost } from "./evidence-host.js";

afterEach(cleanup);

function findingResult(): OfficialResult {
  return {
    meta: {
      topic: "t",
      entry_url: "https://example.kr/",
      started_at: "2026-10-01T00:00:00Z",
      finished_at: "2026-10-01T00:01:00Z",
      elapsed_sec: 60,
      tool_version: "0.1.0",
    },
    findings: [
      {
        id: "f1",
        url: "https://example.kr/a",
        is_violation: true,
        location: "#a",
        evidence_text: "광고 원문 유지",
        technique: "HOMOGLYPH",
      },
    ],
  };
}

function renderResultState(getResult: HostBridge["getOfficialResult"], getCoverage: HostBridge["getScanCoverage"]) {
  const host = { getCapabilities: async () => ({ localScan: true }),
    getSession: async () => ({ id: "s1", status: "succeeded" }),
    ...evidenceHost(), getOfficialResult: getResult, getScanCoverage: getCoverage,
    getExtraResult: async () => undefined } as unknown as HostBridge;
  function Workspace() {
    const [view, setView] = useState<"findings" | "pages" | "coverage" | "extra">("coverage");
    return <ScanResult host={host} sessionId="s1" query="" onQueryChange={() => {}} filter="ALL"
      onFilterChange={() => {}} view={view} onViewChange={setView} reviewedIds={new Set()}
      onSelectionHidden={() => {}} onReviewMany={() => {}} onEvidence={() => {}} onExport={() => {}} onRestart={() => {}} />;
  }
  render(<Workspace />);
}

describe("ScanResult delayed availability", () => {
  it("distinguishes pending coverage from absence and preserves official findings when coverage settles", async () => {
    let complete!: (bundle: ScanCoverageView | undefined) => void;
    const pending = new Promise<ScanCoverageView | undefined>((resolve) => { complete = resolve; });
    renderResultState(async () => findingResult(), () => pending);
    await screen.findByText(/공식 탐지 1건/);
    const before = screen.getByText("점검 범위를 불러오는 중입니다.").textContent;
    await act(async () => complete({ pageOutcomes: [], coverage: {
      checkedPages: 6, failedPages: [{ url: "https://example.kr/missing", status: 404, reason: "HTTP 404" }], timedOut: false,
    } }));
    expect(screen.queryByText("점검 범위를 불러오는 중입니다.")).toBeNull();
    expect(screen.getByText("확인한 페이지 6개 · 실패한 페이지 1개", { exact: true })).toBeDefined();
    expect(screen.queryByText(before!)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "공식 탐지", exact: true }));
    expect(screen.getByRole("button", { name: "근거 보기", exact: true }).dataset.findingId).toBe(findingResult().findings[0]!.id);
  });

  it("reports a rejected coverage read while keeping the valid official list and save action", async () => {
    renderResultState(async () => findingResult(), async () => { throw new Error("private coverage error"); });
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).not.toContain("private coverage error");
    expect(screen.queryByText("점검 범위를 불러오는 중입니다.")).toBeNull();
    expect((screen.getByRole("button", { name: "결과 저장" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "공식 탐지", exact: true }));
    expect(screen.getByRole("button", { name: "근거 보기", exact: true }).dataset.findingId).toBe(findingResult().findings[0]!.id);
  });

  it("settles rejected result reads with an error, blocked save and an enabled new-scan action", async () => {
    renderResultState(async () => { throw new Error("private result error"); }, async () => undefined);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).not.toContain("private result error");
    expect(screen.queryByRole("status")).toBeNull();
    expect((screen.getByRole("button", { name: "결과 저장" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "새로 검사하기" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("updates result count for search and filter, with a clear reset action", async () => {
    const host = {
      getCapabilities: vi.fn(async () => ({ localScan: true })),
      getSession: vi.fn(async () => ({ id: "s1", status: "succeeded" })),
      getOfficialResult: vi.fn(async () => findingResult()),
      ...evidenceHost(),
    } as unknown as HostBridge;
    function Workspace() {
      const [query, setQuery] = useState("");
      const [filter, setFilter] = useState<"ALL" | "HOMOGLYPH" | "JAMO">("ALL");
      const [view, setView] = useState<"findings" | "pages" | "coverage">("findings");
      return <ScanResult host={host} sessionId="s1" query={query} onQueryChange={setQuery}
        filter={filter} onFilterChange={(value) => setFilter(value as typeof filter)}
        view={view} onViewChange={setView} reviewedIds={new Set()} onSelectionHidden={() => {}} onReviewMany={() => {}} onEvidence={() => {}} onExport={() => {}} onRestart={() => {}} />;
    }
    render(<Workspace />);
    expect(await screen.findByText("표시 중인 탐지 1건 / 전체 1건")).toBeDefined();
    fireEvent.change(screen.getByLabelText("결과 검색"), { target: { value: "없는 단어" } });
    expect(screen.getByText("표시 중인 탐지 0건 / 전체 1건")).toBeDefined();
    fireEvent.click(screen.getByText("검색·필터 초기화"));
    expect(screen.getByText("표시 중인 탐지 1건 / 전체 1건")).toBeDefined();
    fireEvent.change(screen.getByLabelText("기법 필터"), { target: { value: "JAMO" } });
    expect(screen.getByText("표시 중인 탐지 0건 / 전체 1건")).toBeDefined();
    fireEvent.click(screen.getByText("검색·필터 초기화"));
    fireEvent.click(screen.getByRole("button", { name: "페이지별" }));
  });

  it("renders the stored result even when the first fetch precedes the store", async () => {
    let calls = 0;
    const host = {
      getCapabilities: vi.fn(async () => ({ localScan: true })),
      getSession: vi.fn(async () => ({ id: "s1", status: "succeeded" })),
      getOfficialResult: vi.fn(async () => {
        calls += 1;
        return calls >= 3 ? findingResult() : undefined;
      }),
      ...evidenceHost(),
    } as unknown as HostBridge;
    render(
      <ScanResult
        host={host}
        sessionId="s1"
        query=""
        onQueryChange={() => {}}
        filter="ALL"
        onFilterChange={() => {}}
        view="findings"
        onViewChange={() => {}}
        reviewedIds={new Set()}
        onSelectionHidden={() => {}} onReviewMany={() => {}}
        onEvidence={() => {}}
        onExport={() => {}}
        onRestart={() => {}}
      />,
    );
    expect((await screen.findByRole("button", { name: "근거 보기", exact: true }, { timeout: 5000 })).dataset.findingId).toBe(findingResult().findings[0]!.id);
  });

  it("stays empty when no result is ever stored", async () => {
    vi.useFakeTimers();
    try {
      const host = {
        getCapabilities: vi.fn(async () => ({ localScan: true })),
        getSession: vi.fn(async () => ({ id: "s1", status: "succeeded" })),
        getOfficialResult: vi.fn(async () => undefined),
        ...evidenceHost(),
      } as unknown as HostBridge;
      render(
        <ScanResult
          host={host}
          sessionId="s1"
          query=""
          onQueryChange={() => {}}
          filter="ALL"
          onFilterChange={() => {}}
          view="findings"
          onViewChange={() => {}}
          reviewedIds={new Set()}
          onSelectionHidden={() => {}} onReviewMany={() => {}}
          onEvidence={() => {}}
          onExport={() => {}}
          onRestart={() => {}}
        />,
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(6000);
      });
      expect(screen.getByText(/결과 파일을 불러오지 못했습니다/)).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("offers a fresh scan for cancelled sessions", async () => {
    const host = {
      getCapabilities: vi.fn(async () => ({ localScan: true })),
      getSession: vi.fn(async () => ({ id: "s1", status: "cancelled" })),
      getOfficialResult: vi.fn(async () => undefined),
      ...evidenceHost(),
    } as unknown as HostBridge;
    render(
      <ScanResult
        host={host}
        sessionId="s1"
        query=""
        onQueryChange={() => {}}
        filter="ALL"
        onFilterChange={() => {}}
        view="findings"
        onViewChange={() => {}}
        reviewedIds={new Set()}
        onSelectionHidden={() => {}} onReviewMany={() => {}}
        onEvidence={() => {}}
        onExport={() => {}}
        onRestart={() => {}}
      />,
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    const status = await screen.findByText(/취소되었습니다/, {}, { timeout: 3000 });
    expect(status.textContent ?? "").toContain("취소되었습니다");
  });
});
