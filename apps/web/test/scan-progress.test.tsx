// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { ScanProgressView } from "../src/screens/ScanProgress.js";
import type { HostBridge, ScanEvent } from "@krds-detector/contracts";

afterEach(cleanup);

function setup(cancelScan = vi.fn(async () => {})) {
  let handler: ((event: ScanEvent) => void) | undefined;
  const host = {
    onScanEvent: (h: (event: ScanEvent) => void) => {
      handler = h;
      return () => {
        handler = undefined;
      };
    },
    cancelScan,
    getSession: vi.fn(async () => ({ status: "cancelled" })),
  } as unknown as HostBridge;
  const onDone = vi.fn();
  const onCancel = vi.fn();
  render(
    <ScanProgressView
      host={host}
      sessionId="s1"
      onDone={onDone}
      onCancel={onCancel}
    />,
  );
  return {
    emit: (event: ScanEvent) => {
      act(() => handler?.(event));
    },
    onDone,
    onCancel,
  };
}

function event(
  over: Partial<ScanEvent> & { progress: ScanEvent["progress"] },
): ScanEvent {
  return {
    kind: "page-visited",
    sessionId: "s1",
    at: "2026-10-01T00:00:00.000Z",
    ...over,
  };
}

function statusLine(): string {
  return screen.getByRole("status").textContent ?? "";
}

function page(): HTMLElement {
  return document.querySelector("main.page") as HTMLElement;
}

describe("ScanProgress live region", () => {
  it("does not mark the page busy while the scan runs, so status updates are not suppressed", () => {
    setup();
    expect(page().hasAttribute("aria-busy")).toBe(false);
  });

  it("keeps the status region outside any aria-busy ancestor", () => {
    setup();
    const status = screen.getByRole("status");
    expect(page().contains(status)).toBe(true);
    expect(status.closest("[aria-busy='true']")).toBeNull();
    expect(status.getAttribute("aria-live")).toBe("polite");
  });

  it("marks the page busy on session-finished and hands off to onDone", () => {
    const { emit, onDone } = setup();
    emit(
      event({
        kind: "session-finished",
        progress: {
          visitedPages: 12,
          queuedPages: 0,
          framesInspected: 4,
          elementsAnalyzed: 30,
          candidates: 2,
          confirmedFindings: 1,
          elapsedSec: 42,
          stage: "done",
        },
      }),
    );
    expect(page().getAttribute("aria-busy")).toBe("true");
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("announces stage and confirmed-count changes", () => {
    const { emit } = setup();
    emit(
      event({
        progress: {
          visitedPages: 3,
          queuedPages: 4,
          framesInspected: 0,
          elementsAnalyzed: 0,
          candidates: 0,
          confirmedFindings: 2,
          elapsedSec: 1,
          stage: "analyzing",
        },
      }),
    );
    expect(statusLine()).toContain("analyzing");
    expect(statusLine()).toContain("확정된 탐지 2건");
  });

  it("does not re-announce identical lines while per-page counters still update", () => {
    const { emit } = setup();
    const base = {
      visitedPages: 3,
      queuedPages: 4,
      framesInspected: 0,
      elementsAnalyzed: 0,
      candidates: 0,
      confirmedFindings: 0,
      elapsedSec: 1,
      stage: "crawling",
    };
    emit(event({ progress: { ...base } }));
    const first = statusLine();
    emit(event({ progress: { ...base, visitedPages: 4 } }));
    emit(event({ progress: { ...base, visitedPages: 5 } }));

    expect(statusLine()).toBe(first);
    expect(document.querySelector("dl.stats")?.textContent).toContain("5");
  });

  it("ignores events belonging to another session", () => {
    const { emit } = setup();
    const before = statusLine();
    emit(
      event({
        sessionId: "other",
        progress: {
          visitedPages: 9,
          queuedPages: 0,
          framesInspected: 0,
          elementsAnalyzed: 0,
          candidates: 0,
          confirmedFindings: 9,
          elapsedSec: 9,
          stage: "finished",
        },
      }),
    );
    expect(statusLine()).toBe(before);
  });

  it("marks the page busy while cancelling", async () => {
    const cancelScan = vi.fn(async () => {});
    const { onCancel } = setup(cancelScan);
    await act(async () => {
      screen.getByRole("button", { name: "탐지 취소" }).click();
      await new Promise((resolve) => setTimeout(resolve, 2600));
    });
    expect(cancelScan).toHaveBeenCalledWith("s1");
    expect(page().getAttribute("aria-busy")).toBe("true");
    // The 2.5 s settle lets the cancelled poll tick fire onCancel; the
    // finally-driven onCancel then fires once more. Both paths must converge
    // on onCancel (never strand on progress).
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
describe("ScanProgress per-page counters", () => {
  it("renders non-zero visited pages from a page-visited event", () => {
    const { emit } = setup();
    const base = {
      sessionId: "s1",
      at: new Date().toISOString(),
      kind: "page-visited",
      message: "crawled 3 pages",
      pageUrl: "http://127.0.0.1:4123/",
      progress: {
        visitedPages: 3,
        queuedPages: 0,
        framesInspected: 0,
        elementsAnalyzed: 0,
        candidates: 0,
        confirmedFindings: 0,
        elapsedSec: 4,
        stage: "crawling",
      },
    } as const;
    act(() => {
      emit(event(base));
    });
    expect(statusLine()).toContain("crawling");
    expect(document.body.textContent ?? "").toContain("방문한 페이지");
  });
});

describe("ScanProgress cancel event", () => {
  it("routes session-cancelled to onCancel instead of stranding on progress", () => {
    const { emit, onCancel } = setup();
    const base = {
      sessionId: "s1",
      at: new Date().toISOString(),
      kind: "session-cancelled",
      progress: {
        visitedPages: 0,
        queuedPages: 0,
        framesInspected: 0,
        elementsAnalyzed: 0,
        candidates: 0,
        confirmedFindings: 0,
        elapsedSec: 3,
        stage: "cancelled",
      },
    } as const;
    act(() => {
      emit(event(base));
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

