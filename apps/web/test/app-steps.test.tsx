// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { App } from "../src/App.js";
import { STEPS, stepStates } from "../src/steps.js";
import type { HostBridge } from "@krds-detector/contracts";

vi.mock("../src/host/index.js", () => ({
  createHost: async () =>
    ({
      startScan: vi.fn(async () => ({ id: "s1" })),
      cancelScan: vi.fn(async () => {}),
      onScanEvent: () => () => {},
      getResult: vi.fn(),
      getFinding: vi.fn(),
      exportResult: vi.fn(),
      saveFile: vi.fn(),
    }) as unknown as HostBridge,
}));

// Replace screens with plain navigation buttons so the test only exercises
// step-state derivation in App itself.
vi.mock("../src/screens/ScanStart.js", () => ({
  ScanStart: ({ onStarted }: { onStarted: (id: string) => void }) => (
    <button onClick={() => onStarted("s1")}>mock-start</button>
  ),
}));
vi.mock("../src/screens/ScanProgress.js", () => ({
  ScanProgressView: ({ onDone }: { onDone: () => void }) => (
    <button onClick={onDone}>mock-done</button>
  ),
}));
vi.mock("../src/screens/ScanResult.js", () => ({
  ScanResult: ({
    onEvidence,
    onExport,
    onRestart,
  }: {
    onEvidence: (id: string) => void;
    onExport: () => void;
    onRestart: () => void;
  }) => (
    <>
      <button onClick={() => onEvidence("f1")}>mock-evidence</button>
      <button onClick={onExport}>mock-skip-to-export</button>
      <button onClick={onRestart}>mock-restart</button>
    </>
  ),
}));
vi.mock("../src/screens/EvidenceView.js", () => ({
  EvidenceView: ({ onBack }: { onBack: () => void }) => (
    <>
      <button onClick={onBack}>mock-evidence-back</button>
    </>
  ),
}));
vi.mock("../src/screens/ExportDialog.js", () => ({
  ExportDialog: ({ onClose }: { onClose: () => void }) => (
    <>
      <button onClick={onClose}>mock-export-close</button>
    </>
  ),
}));

function items(): HTMLElement[] {
  return Array.from(document.querySelectorAll("ol.steps > li"));
}
function item(id: typeof STEPS[number]["id"]): HTMLElement {
  const index = STEPS.findIndex((s) => s.id === id);
  const li = items()[index];
  if (!li) throw new Error(`step ${id} not rendered`);
  return li;
}

describe("stepStates helper", () => {
  it("treats inspection as a result-stage action", () => {
    expect(stepStates("evidence").map((s) => s.className)).toEqual(["done", "done", "current"]);
  });

  it("shows exactly three stages in order", () => {
    expect(STEPS.map((s) => s.label)).toEqual(["점검 설정", "사이트 점검", "결과 검토"]);
  });
});

describe("App step indicator", () => {
  afterEach(cleanup);

  it("keeps aria-current on the current step and no done cue at start", async () => {
    render(<App />);
    expect(await screen.findByText("mock-start")).toBeTruthy();
    expect(item("start").getAttribute("aria-current")).toBe("step");
    expect(item("start").className).toBe("current");
    expect(items()).toHaveLength(3);
    expect(item("result").className).toBe("todo");
  });

  it("keeps result stage current during evidence and export", async () => {
    render(<App />);
    fireEvent.click(await screen.findByText("mock-start")); // start → progress
    expect(item("start").className).toBe("done");

    fireEvent.click(screen.getByText("mock-done")); // progress → result
    expect(item("progress").className).toBe("done");

    fireEvent.click(screen.getByText("mock-evidence"));
    expect(item("result").getAttribute("aria-current")).toBe("step");
    fireEvent.click(screen.getByText("mock-evidence-back"));
    fireEvent.click(screen.getByText("mock-skip-to-export"));
    expect(item("result").getAttribute("aria-current")).toBe("step");
    expect(screen.getByText("mock-export-close")).toBeDefined();

    for (const id of ["start", "progress"] as const) {
      const li = item(id);
      expect(li.className).toBe("done");
      // Perceivable without color: visible check glyph + SR-only 완료.
      expect(li.querySelector(".done-check")?.textContent).toContain("✓");
      expect(li.querySelector(".sr-only")?.textContent).toContain("완료");
    }
  });

  it("restart resets completion so no step stays done", async () => {
    render(<App />);
    const started = await screen.findByText("mock-start");
    fireEvent.click(started);
    fireEvent.click(screen.getByText("mock-done"));
    fireEvent.click(screen.getByText("mock-skip-to-export"));
    fireEvent.click(screen.getByText("mock-export-close"));
    // Closing export keeps the result stage in place.
    expect(item("result").getAttribute("aria-current")).toBe("step");
    fireEvent.click(screen.getByText("mock-restart"));
    expect(item("start").getAttribute("aria-current")).toBe("step");
    for (const id of ["progress", "result"] as const) {
      expect(item(id).className).toBe("todo");
      expect(item(id).textContent).not.toContain("✓");
    }
  });
});
