// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { App } from "../src/App.js";
import { STEPS, stepStates, type StepState } from "../src/steps.js";
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
  }: {
    onEvidence: (id: string) => void;
    onExport: () => void;
  }) => (
    <>
      <button onClick={() => onEvidence("f1")}>mock-evidence</button>
      <button onClick={onExport}>mock-skip-to-export</button>
    </>
  ),
}));
vi.mock("../src/screens/EvidenceView.js", () => ({
  EvidenceView: ({ onExport, onBack }: { onExport: () => void; onBack: () => void }) => (
    <>
      <button onClick={onExport}>mock-evidence-export</button>
      <button onClick={onBack}>mock-evidence-back</button>
    </>
  ),
}));
vi.mock("../src/screens/ExportView.js", () => ({
  ExportView: ({ onBack, onRestart }: { onBack: () => void; onRestart: () => void }) => (
    <>
      <button onClick={onBack}>mock-export-back</button>
      <button onClick={onRestart}>mock-export-restart</button>
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
  it("skip-Evidence visitor path leaves Evidence not done", () => {
    const states = stepStates("export", new Set(["start", "progress", "result", "export"]));
    expect(states.find((s) => s.id === "evidence")?.className).toBe("todo");
    expect(states.find((s) => s.current)?.id).toBe("export");
  });

  it("full walk marks all non-current visited steps done", () => {
    const states: StepState[] = stepStates(
      "evidence",
      new Set(STEPS.map((s) => s.id)),
    );
    for (const s of states) {
      expect(s.className).toBe(s.id === "evidence" ? "current" : "done");
    }
  });
});

describe("App step indicator", () => {
  afterEach(cleanup);

  it("keeps aria-current on the current step and no done cue at start", async () => {
    render(<App />);
    expect(await screen.findByText("mock-start")).toBeTruthy();
    expect(item("start").getAttribute("aria-current")).toBe("step");
    expect(item("start").className).toBe("current");
    expect(item("export").className).toBe("todo");
  });

  it("marks visited steps done with a non-color cue; skipped Evidence stays todo", async () => {
    render(<App />);
    fireEvent.click(await screen.findByText("mock-start")); // start → progress
    expect(item("start").className).toBe("done");

    fireEvent.click(screen.getByText("mock-done")); // progress → result
    expect(item("progress").className).toBe("done");

    // Escape hatch: 결과 검증 reachable from 탐지 결과 without Evidence.
    fireEvent.click(screen.getByText("mock-skip-to-export"));
    expect(item("evidence").className).toBe("todo");
    expect(item("evidence").textContent).not.toContain("✓");
    expect(item("evidence").textContent).not.toContain("완료");
    expect(item("export").getAttribute("aria-current")).toBe("step");

    for (const id of ["start", "progress", "result"] as const) {
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
    fireEvent.click(screen.getByText("mock-export-restart")); // export onRestart → start
    expect(item("start").getAttribute("aria-current")).toBe("step");
    for (const id of STEPS.map((s) => s.id)) {
      if (id === "start") continue;
      expect(item(id).className).toBe("todo");
      expect(item(id).textContent).not.toContain("✓");
    }
  });
});
