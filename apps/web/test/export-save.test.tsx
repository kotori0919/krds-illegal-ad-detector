// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { ExportDialog } from "../src/screens/ExportDialog.js";
import type { HostBridge, OfficialResult, ScanDetailBundle } from "@krds-detector/contracts";

afterEach(cleanup);

function result(): OfficialResult {
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

function hostWith(over: Partial<HostBridge>): HostBridge {
  return {
    getCapabilities: vi.fn(async () => ({
      localScan: true,
      filesystem: true,
      localInference: true,
      nativeProcessControl: true,
      windowsIntegration: true,
    })),
    getOfficialResult: vi.fn(async () => result()),
    getDetailBundle: vi.fn(async () => undefined),
    exportResult: vi.fn(async () => ({ resultJson: "C:\\out\\result.json" })),
    ...over,
  } as unknown as HostBridge;
}

function renderExport(host: HostBridge) {
  render(
    <ExportDialog host={host} sessionId="s1" onClose={() => {}} />,
  );
}

describe("ExportDialog save semantics", () => {
  it.each(["missing", "rejected"] as const)(
    "settles %s result loading with a recovery action and disabled save",
    async (failure) => {
      const getOfficialResult = vi.fn(async () => {
        if (failure === "rejected") throw new Error("native read failed");
        return undefined;
      });
      renderExport(hostWith({ getOfficialResult }));
      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toContain("창을 닫고 다시 시도해 주세요");
      expect(screen.queryByText("검증할 결과를 불러오는 중입니다.")).toBeNull();
      expect((screen.getByRole("button", { name: "파일 저장" }) as HTMLButtonElement).disabled).toBe(true);
      expect(screen.getByRole("button", { name: "취소" })).toBeDefined();
    },
  );

  it("names incomplete coverage while keeping a valid result savable", async () => {
    const finding = result().findings[0]!;
    const bundle: ScanDetailBundle = {
      version: 2,
      findings: [{ findingId: finding.id, url: finding.url, location: finding.location,
        technique: finding.technique, rawText: finding.evidence_text,
        normalizedText: "x", matchedTerms: [], techniqueReason: "fixture",
        observed: { box: { x: 0, y: 0, width: 1, height: 1 },
          css: { color: "black", backgroundColor: "white", opacity: "1", display: "block", fontSize: "16px", position: "static" } },
        visual: { state: "unavailable", reason: "budget" } }],
      coverage: { checkedPages: 6, failedPages: [{ url: "https://example.kr/missing", status: 404, reason: "HTTP 404" }], timedOut: true },
    };
    renderExport(hostWith({ getDetailBundle: vi.fn(async () => bundle) }));
    const note = await screen.findByRole("note");
    expect(note.textContent).toContain("확인한 페이지 6개 중 실패 1개");
    expect(note.textContent).toContain("점검 시간 제한 도달");
    expect((await screen.findByRole("button", { name: "파일 저장" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("cancel is a silent no-op: no file, no error, no download", async () => {
    const exportResult = vi.fn(async () => ({ resultJson: null }));
    renderExport(hostWith({ exportResult }));
    await act(async () => {});
    await act(async () => {
      screen.getByRole("button", { name: "파일 저장" }).click();
    });
    expect(exportResult).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(/저장됨/)).toBeNull();
  });
  it("write failure gives a recovery action without a false saved message", async () => {
    const exportResult = vi.fn(async () => {
      throw new Error("export failed: permission denied");
    });
    renderExport(hostWith({ exportResult }));
    await act(async () => {});
    await act(async () => {
      screen.getByRole("button", { name: "파일 저장" }).click();
    });
    const alert = await screen.findByRole("alert");
    expect(alert.textContent ?? "").toContain("저장 위치의 권한과 남은 공간");
    expect(alert.textContent ?? "").not.toContain("permission denied");
    expect(screen.queryByText(/저장됨/)).toBeNull();
  });

  it("successful save shows the exact path, not a fallback label", async () => {
    renderExport(hostWith({}));
    await act(async () => {});
    await act(async () => {
      screen.getByRole("button", { name: "파일 저장" }).click();
    });
    const status = await screen.findByRole("status");
    expect(status.textContent ?? "").toContain("C:\\out\\result.json");
  });

  it("browser mode downloads client-side without calling export", async () => {
    const exportResult = vi.fn(async () => ({ resultJson: "x" }));
    renderExport(
      hostWith({
        getCapabilities: vi.fn(async () => ({
          localScan: false,
          filesystem: false,
          localInference: false,
          nativeProcessControl: false,
          windowsIntegration: false,
        })),
        exportResult,
      }),
    );
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    const downloads: { href: string; filename: string }[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push({ href: this.href, filename: this.download });
    });
    URL.createObjectURL = (() => "blob:mock") as typeof URL.createObjectURL;
    URL.revokeObjectURL = (() => {}) as typeof URL.revokeObjectURL;
    try {
      const button = await screen.findByRole("button", { name: "파일 저장" });
      await act(async () => {
        button.click();
        await new Promise((resolve) => setTimeout(resolve, 100));
      });
    } finally {
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
      click.mockRestore();
    }
    expect(downloads).toEqual([{ href: "blob:mock", filename: "result.json" }]);
    expect(exportResult).not.toHaveBeenCalled();
  });
});
