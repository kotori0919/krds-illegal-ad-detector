// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { ExportDialog } from "../src/screens/ExportDialog.js";
import type { HostBridge, OfficialResult } from "@krds-detector/contracts";

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
  it("write failure surfaces without a false saved message", async () => {
    const exportResult = vi.fn(async () => {
      throw new Error("export failed: permission denied");
    });
    renderExport(hostWith({ exportResult }));
    await act(async () => {});
    await act(async () => {
      screen.getByRole("button", { name: "파일 저장" }).click();
    });
    const alert = await screen.findByRole("alert");
    expect(alert.textContent ?? "").toContain("permission denied");
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
