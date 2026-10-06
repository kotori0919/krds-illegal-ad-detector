// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { ExportDialog } from "../src/screens/ExportDialog.js";
import { validateOfficialResultText, type ExportPaths, type HostBridge, type OfficialResult, type ScanDetailBundle } from "@krds-detector/contracts";

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
  function Harness() {
    const [open, setOpen] = useState(true);
    return open ? <ExportDialog host={host} sessionId="s1" onClose={() => setOpen(false)} /> : <h1>결과 검토</h1>;
  }
  render(<Harness />);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((complete, fail) => { resolve = complete; reject = fail; });
  return { promise, resolve, reject };
}

describe("ExportDialog save semantics", () => {
  it("waits for coverage before enabling save so partial warnings precede the file picker", async () => {
    const coverage = deferred<ScanDetailBundle | undefined>();
    renderExport(hostWith({ getDetailBundle: () => coverage.promise }));
    await screen.findByRole("status");
    expect((screen.getByRole("button", { name: "저장" }) as HTMLButtonElement).disabled).toBe(true);
    const before = screen.getByRole("status").textContent;
    await act(async () => coverage.resolve({ version: 2, findings: [], creativeImages: [], coverage: {
      checkedPages: 6, failedPages: [{ url: "https://example.kr/missing", status: 404, reason: "HTTP 404" }], timedOut: true,
    } }));
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("note").textContent).not.toBe(before);
    expect((screen.getByRole("button", { name: "저장" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("keeps focus and confirmation during pending save and restores save after native cancellation", async () => {
    const saved = deferred<ExportPaths>();
    renderExport(hostWith({ exportResult: () => saved.promise }));
    await act(async () => {});
    const save = screen.getByRole("button", { name: "저장" });
    await act(async () => { save.click(); save.click(); });
    const dialog = screen.getByRole("dialog");
    expect([...dialog.querySelectorAll("button")].every((button) => button.disabled)).toBe(true);
    expect(screen.getByRole("status")).toBeDefined();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBe(dialog);
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "결과 저장" }));
    await act(async () => saved.resolve({ resultJson: null }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect((save as HTMLButtonElement).disabled).toBe(false);
    expect(document.activeElement).toBe(save);
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("heading", { name: "결과 검토" })).toBeDefined();
  });

  it("clears a prior success while retrying, then gives a focused retry after failure", async () => {
    let saved = deferred<ExportPaths>();
    renderExport(hostWith({ exportResult: () => saved.promise }));
    await act(async () => {});
    await act(async () => { screen.getByRole("button", { name: "저장" }).click(); });
    await act(async () => saved.resolve({ resultJson: "C:\\out\\first.json" }));
    expect(screen.getByRole("status")).toBeDefined();
    saved = deferred<ExportPaths>();
    await act(async () => { screen.getByRole("button", { name: "다시 저장" }).click(); });
    expect(screen.getByRole("status").textContent).not.toContain("first.json");
    await act(async () => saved.reject(new Error("private permission detail")));
    expect(screen.getByRole("alert").textContent).not.toContain("private permission detail");
    expect(screen.queryByRole("status")).toBeNull();
    const retry = screen.getByRole("button", { name: "저장" });
    expect((retry as HTMLButtonElement).disabled).toBe(false);
    expect(document.activeElement).toBe(retry);
  });
  it.each(["missing", "rejected"] as const)(
    "settles %s result loading with a recovery action and disabled save",
    async (failure) => {
      const getOfficialResult = vi.fn(async () => {
        if (failure === "rejected") throw new Error("native read failed");
        return undefined;
      });
      renderExport(hostWith({ getOfficialResult }));
      await screen.findByRole("alert");
      expect(screen.queryByRole("status")).toBeNull();
      expect((screen.getByRole("button", { name: "저장" }) as HTMLButtonElement).disabled).toBe(true);
      expect(screen.getByRole("button", { name: "취소" })).toBeDefined();
    },
  );

  it.each([false, true])("names incomplete coverage while keeping a valid result savable (cancelled=%s)", async (cancelled) => {
    const finding = result().findings[0]!;
    const bundle: ScanDetailBundle = {
      version: 2,
      creativeImages: [],
      findings: [{ findingId: finding.id, url: finding.url, location: finding.location,
        technique: finding.technique, rawText: finding.evidence_text,
        normalizedText: "x", matchedTerms: [], techniqueReason: "fixture",
        observed: { box: { x: 0, y: 0, width: 1, height: 1 },
          css: { color: "black", backgroundColor: "white", opacity: "1", display: "block", fontSize: "16px", position: "static" } },
        visual: { state: "unavailable", reason: "budget" } }],
      coverage: { checkedPages: 6, failedPages: [{ url: "https://example.kr/missing", status: 404, reason: "HTTP 404" }], timedOut: true, cancelled },
    };
    renderExport(hostWith({ getDetailBundle: vi.fn(async () => bundle) }));
    const note = await screen.findByRole("note");
    expect(note.textContent).toContain("확인 실패 1페이지");
    expect(note.textContent).toContain("점검 시간 초과");
    if (cancelled) expect(note.textContent).toContain("중지 전 완료된 부분 결과");
    expect((await screen.findByRole("button", { name: "저장" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it.each(["duplicate", "blank-location"] as const)("blocks %s output before opening a save dialog", async (failure) => {
    const invalid = result();
    if (failure === "duplicate") invalid.findings.push({ ...invalid.findings[0]!, id: "f2" });
    else invalid.findings[0]!.location = " ";
    const exportResult = vi.fn(async () => ({ resultJson: "C:\\out\\result.json" }));
    renderExport(hostWith({ getOfficialResult: vi.fn(async () => invalid), exportResult }));
    await screen.findByRole("alert");
    const save = screen.getByRole("button", { name: "저장" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    save.click();
    expect(exportResult).not.toHaveBeenCalled();
  });

  it("cancel is a silent no-op: no file, no error, no download", async () => {
    const exportResult = vi.fn(async () => ({ resultJson: null }));
    renderExport(hostWith({ exportResult }));
    await act(async () => {});
    await act(async () => {
      screen.getByRole("button", { name: "저장" }).click();
    });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });
  it("write failure gives a recovery action without a false saved message", async () => {
    const exportResult = vi.fn(async () => {
      throw new Error("export failed: permission denied");
    });
    renderExport(hostWith({ exportResult }));
    await act(async () => {});
    await act(async () => {
      screen.getByRole("button", { name: "저장" }).click();
    });
    const alert = await screen.findByRole("alert");
    expect(alert.textContent ?? "").not.toContain("permission denied");
    expect(screen.queryByRole("status")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "저장" }));
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
    let content: Blob | undefined;
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push({ href: this.href, filename: this.download });
    });
    URL.createObjectURL = ((blob: Blob) => { content = blob; return "blob:mock"; }) as typeof URL.createObjectURL;
    URL.revokeObjectURL = (() => {}) as typeof URL.revokeObjectURL;
    try {
      const button = await screen.findByRole("button", { name: "저장" });
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
    const downloadedText = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(content!, "utf-8");
    });
    expect(validateOfficialResultText(downloadedText).ok).toBe(true);
    expect(JSON.parse(downloadedText).findings).toEqual(result().findings);
    expect(exportResult).not.toHaveBeenCalled();
  });
});
