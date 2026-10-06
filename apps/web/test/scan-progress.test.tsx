// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { ScanProgressView } from "../src/screens/ScanProgress.js";
import type { HostBridge, ScanEvent } from "@krds-detector/contracts";

afterEach(cleanup);

function setup(
  cancelScan = vi.fn(async () => {}),
  getSession = vi.fn(async () => ({ status: "cancelled" as const })),
) {
  let handler: ((event: ScanEvent) => void) | undefined;
  const host = {
    onScanEvent: (h: (event: ScanEvent) => void) => {
      handler = h;
      return () => {
        handler = undefined;
      };
    },
    cancelScan,
    getSession,
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

  it("hands off to onDone on succeeded poll (events never navigate)", async () => {
    const getSession = vi.fn(async () => ({ status: "succeeded" }));
    const { onDone } = setup(vi.fn(async () => {}), getSession);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2100));
    });
    expect(page().getAttribute("aria-busy")).toBe("true");
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("ignores session-finished events for navigation (host emits completion)", () => {
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
          stage: "succeeded",
        },
      }),
    );
    // Event updates counters/notice only; no navigation without a poll.
    expect(onDone).not.toHaveBeenCalled();
    expect(document.querySelector("dl.stats")?.textContent).toContain("12");
  });

  it("announces stage and confirmed-count changes", () => {
    const { emit } = setup();
    emit(
      event({
        kind: "stage-changed",
        progress: {
          visitedPages: 3,
          queuedPages: 4,
          framesInspected: 0,
          elementsAnalyzed: 0,
          candidates: 0,
          confirmedFindings: 2,
          elapsedSec: 1,
          stage: "running",
        },
      }),
    );
    expect(statusLine()).toContain("페이지를 찾고 콘텐츠를 분석하는 중");
    expect(statusLine()).toContain("공식 탐지 2건");
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
      stage: "running",
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
          stage: "succeeded",
        },
      }),
    );
    expect(statusLine()).toBe(before);
  });

  it("confirms cancellation and waits for terminal host status before leaving", async () => {
    const cancelScan = vi.fn(async () => {});
    const { onCancel } = setup(cancelScan);
    await act(async () => {
      screen.getByRole("button", { name: "점검 중지" }).click();
    });
    expect(screen.getByRole("dialog", { name: "점검을 중지할까요?" })).toBeDefined();
    expect(cancelScan).not.toHaveBeenCalled();
    await act(async () => {
      screen.getByRole("button", { name: "점검 중지 확인" }).click();
      await new Promise((resolve) => setTimeout(resolve, 2600));
    });
    expect(cancelScan).toHaveBeenCalledWith("s1");
    // Stays mounted during the settle (no aria-busy): unmounting early
    // orphaned the finally-driven onCancel on the VM. Button flips to the
    // cancelling label while the settle runs.
    expect(page().hasAttribute("aria-busy")).toBe(false);
    expect(screen.getByRole("button", { name: "중지 처리 중…" })).toBeDefined();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("keeps cancellation available after a host failure and gives a Korean recovery action", async () => {
    const cancelScan = vi.fn(async () => { throw new Error("IPC channel closed"); });
    setup(cancelScan);
    await act(async () => {
      screen.getByRole("button", { name: "점검 중지" }).click();
    });
    await act(async () => {
      screen.getByRole("button", { name: "점검 중지 확인" }).click();
    });
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "중지 요청을 처리하지 못했습니다. 점검 상태를 확인한 뒤 다시 시도해 주세요.",
    );
    expect(screen.getByRole("button", { name: "점검 중지" })).toBeDefined();
  });
});
describe("ScanProgress per-page counters", () => {
  it("renders the exact visited-pages value from a page-visited event", () => {
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
        stage: "running",
      },
    } as const;
    act(() => {
      emit(event(base));
    });
    // Exact value assertion: stays-0 passes a label check but fails here.
    expect(statusLine()).toBe("사이트 점검을 시작했습니다.");
    const dds = [...document.querySelectorAll("dl.stats dd")].map((d) => d.textContent);
    expect(dds).toContain("3");
    expect(dds).not.toContain("0건");
  });
});

describe("ScanProgress cancel poll", () => {
  it("routes cancelled poll to onCancel (events never navigate)", async () => {
    const getSession = vi.fn(async () => ({ status: "cancelled" as const }));
    const { onCancel } = setup(vi.fn(async () => {}), getSession);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2100));
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("gives a failed scan a recovery action instead of a cancel control", async () => {
    const getSession = vi.fn(async () => ({ status: "failed" as const, error: "worker exited" }));
    const { onCancel } = setup(vi.fn(async () => {}), getSession);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2100));
    });
    expect(screen.getByRole("alert").textContent).toContain("다시 점검해 주세요");
    expect(screen.getByRole("status").textContent).toBe("점검을 완료하지 못했습니다.");
    expect(screen.getByRole("status").textContent).not.toContain("worker exited");
    expect(screen.queryByRole("button", { name: "점검 중지" })).toBeNull();
    screen.getByRole("button", { name: "새로 검사하기" }).click();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
