// @vitest-environment jsdom
import { warpHost } from "./evidence-host.js";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { initialProgress, type HostBridge, type ScanEvent, type ScanSession } from "@krds-detector/contracts";
import { ScanProgressView } from "../src/screens/ScanProgress.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); });

function setup() {
  let handler: ((event: ScanEvent) => void) | undefined;
  let session: ScanSession = { id: "s1", entryUrl: "https://example.kr/", status: "running",
    startedAt: "2026-10-06T00:00:00Z", progress: initialProgress("running") };
  let lookupFailed = false;
  let cancelFailed = false;
  const host = { ...warpHost(),
    getSession: async () => { if (lookupFailed) throw new Error("private IPC error"); return session; },
    cancelScan: async () => { if (cancelFailed) throw new Error("private IPC error"); },
    onScanEvent: (next: (event: ScanEvent) => void) => { handler = next; return () => { handler = undefined; }; },
  } as unknown as HostBridge;
  function Harness() {
    const [view, setView] = useState("progress");
    if (view === "results") return <h1>결과 검토</h1>;
    if (view === "setup") return <h1>점검 설정</h1>;
    return <ScanProgressView host={host} sessionId="s1" onDone={() => setView("results")} onCancel={() => setView("setup")} />;
  }
  render(<Harness />);
  return {
    setSession: (value: Partial<ScanSession>) => { session = { ...session, ...value }; },
    failLookup: (value: boolean) => { lookupFailed = value; },
    failCancel: (value: boolean) => { cancelFailed = value; },
    emit: (progress: ScanEvent["progress"], kind: ScanEvent["kind"] = "page-visited", sessionId = "s1") => {
      act(() => handler?.({ sessionId, kind, progress, at: "2026-10-06T00:00:00Z" }));
    },
  };
}

async function tick(ms = 2000) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }

function value(label: string): string | null {
  return screen.getByText(label, { selector: "dt" }).nextElementSibling?.textContent ?? null;
}

describe("recoverable scan feedback", () => {
  it("coalesces rapid finding announcements while keeping counts immediate and terminal feedback prompt", async () => {
    const host = setup();
    await tick(0);
    const initialNotice = screen.getByRole("status").textContent;
    host.emit({ ...initialProgress("running"), sequence: 1, confirmedFindings: 2 });
    await tick(200);
    host.emit({ ...initialProgress("running"), sequence: 2, confirmedFindings: 6 });
    expect(value("탐지")).toBe("6");
    expect(screen.getByRole("status").textContent).toBe(initialNotice);
    await tick(1800);
    expect(screen.getByRole("status").textContent).toContain("6건");
    host.emit({ ...initialProgress("running"), sequence: 3, confirmedFindings: 9 });
    host.emit({ ...initialProgress("failed"), sequence: 4, confirmedFindings: 11 });
    expect(screen.getByRole("status").textContent).toContain("11건");
    expect(screen.getByRole("status").textContent).toContain("실패");
    await tick(2000);
    expect(screen.getByRole("status").textContent).not.toContain("9건");
  });

  it("recovers active work and failures from the host and ignores stale events and polls", async () => {
    const host = setup();
    const progress = { ...initialProgress("running"), sequence: 9, visitedPages: 12, failedPages: 1,
      queuedPages: 8, confirmedFindings: 3, elapsedSec: 123,
      currentPages: ["https://example.kr/a", "https://example.kr/b"],
      recentActivity: [{ sequence: 9, kind: "page-failed" as const, stage: "running" as const,
        elapsedSec: 120, pageUrl: "https://example.kr/missing" }] };
    host.setSession({ progress });
    await tick();
    expect(value("확인한 페이지")).toBe("11");
    expect(value("실패한 페이지")).toBe("1");
    expect(within(screen.getByRole("region", { name: "현재 확인 중" })).getAllByRole("listitem").map((item) => item.textContent))
      .toEqual(progress.currentPages);
    expect(within(screen.getByRole("region", { name: "최근 활동" })).getByText(progress.recentActivity[0].pageUrl)).toBeDefined();
    host.emit({ ...progress, sequence: 7, visitedPages: 2, currentPages: [] });
    expect(value("확인한 페이지")).toBe("11");
    host.emit({ ...progress, sequence: 10, visitedPages: 13, currentPages: ["https://example.kr/b"] });
    await tick();
    expect(value("확인한 페이지")).toBe("12");
    expect(within(screen.getByRole("region", { name: "현재 확인 중" })).queryByText("https://example.kr/a")).toBeNull();
  });

  it("advances elapsed time without announcing each clock tick or page and never regresses on a delayed snapshot", async () => {
    const host = setup();
    await tick(0);
    const progress = { ...initialProgress("running"), sequence: 1, visitedPages: 3, elapsedSec: 63 };
    host.emit(progress);
    const notice = screen.getByRole("status").textContent;
    await tick(3000);
    expect(value("경과 시간")).toBe("01:06");
    host.emit({ ...progress, sequence: 2, visitedPages: 4, elapsedSec: 64 });
    expect(value("경과 시간")).toBe("01:06");
    expect(value("확인한 페이지")).toBe("4");
    expect(screen.getByRole("status").textContent).toBe(notice);
    expect(screen.getByRole("status").closest("[aria-busy='true']")).toBeNull();
    host.emit({ ...progress, sequence: 50, confirmedFindings: 99 }, "finding-confirmed", "other");
    expect(value("탐지")).toBe("0");
  });

  it("waits for host settlement before leaving progress even after a terminal worker event", async () => {
    const host = setup();
    await tick(0);
    host.emit({ ...initialProgress("succeeded"), sequence: 8, visitedPages: 6, confirmedFindings: 5 }, "session-finished");
    expect(screen.getByRole("heading", { name: "사이트 점검" })).toBeDefined();
    await tick();
    expect(screen.queryByRole("heading", { name: "결과 검토" })).toBeNull();
    host.setSession({ status: "succeeded", progress: { ...initialProgress("succeeded"), sequence: 9, visitedPages: 6, confirmedFindings: 5 } });
    await tick();
    expect(screen.getByRole("heading", { name: "결과 검토" })).toBeDefined();
  });

  it("traps and restores confirmation focus and stays disabled until cancellation settles", async () => {
    const host = setup();
    await tick(0);
    const trigger = screen.getByRole("button", { name: "점검 중지" });
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog");
    const buttons = within(dialog).getAllByRole("button");
    expect(document.activeElement).toBe(buttons[0]);
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(buttons[1]);
    fireEvent.keyDown(dialog, { key: "Escape" });
    await tick(20);
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger);
    fireEvent.click(within(screen.getByRole("dialog")).getAllByRole("button")[1]);
    await tick();
    expect((screen.getByRole("button", { name: /중지 처리/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("heading", { name: "점검 설정" })).toBeNull();
    host.setSession({ status: "cancelled", progress: { ...initialProgress("cancelled"), sequence: 1 } });
    await tick();
    expect(screen.getByRole("heading", { name: "점검 설정" })).toBeDefined();
  });

  it("keeps prior progress and cancellation available through lookup failure and recovers on the next poll", async () => {
    const host = setup();
    await tick(0);
    host.emit({ ...initialProgress("running"), sequence: 1, visitedPages: 4 });
    host.failLookup(true);
    await tick();
    expect(screen.getByRole("alert").textContent).not.toContain("private IPC error");
    expect(value("확인한 페이지")).toBe("4");
    expect((screen.getByRole("button", { name: "점검 중지" }) as HTMLButtonElement).disabled).toBe(false);
    host.failLookup(false);
    host.setSession({ progress: { ...initialProgress("running"), sequence: 2, visitedPages: 5 } });
    await tick();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(value("확인한 페이지")).toBe("5");
  });

  it("restores the stop control after cancellation failure and hides internal errors", async () => {
    const host = setup();
    await tick(0);
    host.failCancel(true);
    fireEvent.click(screen.getByRole("button", { name: "점검 중지" }));
    fireEvent.click(within(screen.getByRole("dialog")).getAllByRole("button")[1]);
    await tick(20);
    expect(screen.getByRole("alert").textContent).not.toContain("private IPC error");
    const trigger = screen.getByRole("button", { name: "점검 중지" });
    expect((trigger as HTMLButtonElement).disabled).toBe(false);
    expect(document.activeElement).toBe(trigger);
    host.failCancel(false);
    fireEvent.click(trigger);
    fireEvent.click(within(screen.getByRole("dialog")).getAllByRole("button")[1]);
    await tick(0);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("provides a setup recovery path for canonical failure without exposing worker errors", async () => {
    const host = setup();
    host.setSession({ status: "failed", error: "private worker error", progress: { ...initialProgress("failed"), sequence: 1 } });
    await tick();
    expect(screen.queryByRole("button", { name: "점검 중지" })).toBeNull();
    expect(screen.getByRole("status").textContent).not.toContain("private worker error");
    expect(screen.getByRole("alert").textContent).not.toContain("private worker error");
    fireEvent.click(screen.getByRole("button", { name: "새로 검사하기" }));
    expect(screen.getByRole("heading", { name: "점검 설정" })).toBeDefined();
  });

  it("opens preserved results after cancelled host settlement", async () => {
    const host = setup();
    await tick(0);
    fireEvent.click(screen.getByRole("button", { name: "점검 중지" }));
    expect(screen.getByRole("dialog").textContent).toContain("완료된 페이지의 결과는 유지됩니다");
    fireEvent.click(screen.getByRole("button", { name: "점검 중지 확인" }));
    host.setSession({ status: "cancelled", hasResult: true,
      progress: { ...initialProgress("cancelled"), sequence: 1, visitedPages: 3, confirmedFindings: 1 } });
    await tick();
    expect(screen.getByRole("heading", { name: "결과 검토" })).toBeDefined();
    expect(screen.queryByRole("heading", { name: "점검 설정" })).toBeNull();
  });

  it("offers preserved results after a failed host settlement", async () => {
    const host = setup();
    host.setSession({ status: "failed", hasResult: true,
      progress: { ...initialProgress("failed"), sequence: 1, visitedPages: 3 } });
    await tick();
    expect(screen.getByText(/미점검/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "보관된 일부 결과 검토" }));
    expect(screen.getByRole("heading", { name: "결과 검토" })).toBeDefined();
  });
});
