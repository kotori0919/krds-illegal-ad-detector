// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { ScanResult } from "../src/screens/ScanResult.js";
import type { HostBridge, OfficialResult } from "@krds-detector/contracts";

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
        evidence_text: "x",
        technique: "HOMOGLYPH",
      },
    ],
  };
}

describe("ScanResult delayed availability", () => {
  it("renders the stored result even when the first fetch precedes the store", async () => {
    let calls = 0;
    const host = {
      getSession: vi.fn(async () => ({ id: "s1", status: "succeeded" })),
      getOfficialResult: vi.fn(async () => {
        calls += 1;
        return calls >= 3 ? findingResult() : undefined;
      }),
    } as unknown as HostBridge;
    render(
      <ScanResult
        host={host}
        sessionId="s1"
        onEvidence={() => {}}
        onExport={() => {}}
        onRestart={() => {}}
      />,
    );
    expect(await screen.findByText("확정된 탐지 목록 (1건)", {}, { timeout: 5000 })).toBeDefined();
  });

  it("stays empty when no result is ever stored", async () => {
    vi.useFakeTimers();
    try {
      const host = {
        getSession: vi.fn(async () => ({ id: "s1", status: "succeeded" })),
        getOfficialResult: vi.fn(async () => undefined),
      } as unknown as HostBridge;
      render(
        <ScanResult
          host={host}
          sessionId="s1"
          onEvidence={() => {}}
          onExport={() => {}}
          onRestart={() => {}}
        />,
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(6000);
      });
      expect(screen.getByText(/확정된 탐지가 없습니다/)).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("offers a fresh scan for cancelled sessions", async () => {
    const host = {
      getSession: vi.fn(async () => ({ id: "s1", status: "cancelled" })),
      getOfficialResult: vi.fn(async () => undefined),
    } as unknown as HostBridge;
    render(
      <ScanResult
        host={host}
        sessionId="s1"
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
