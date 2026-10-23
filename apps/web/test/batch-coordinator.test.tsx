import { expect, it, vi } from "vitest";
import { initialProgress, SCAN_POLICY, type ScanSession } from "@krds-detector/contracts";
import type { ImportedTarget } from "@krds-detector/contracts";
import { BatchCoordinator } from "../src/batch-coordinator.js";
import { BrowserHost } from "../src/host/browser.js";

const targets: ImportedTarget[] = [
  { label: "First", entryUrl: "https://first.invalid/", kind: "site" },
  { label: "Second", entryUrl: "https://second.invalid/", kind: "site" },
];
function hostForTest(): BrowserHost {
  const host = new BrowserHost();
  host.startBatchScan = (request) => host.startScan(request);
  return host;
}

it("waits through native host finalization grace before admitting the next target", async () => {
  vi.useFakeTimers();
  try {
    const host = hostForTest();
    const started: string[] = [];
    const start = host.startBatchScan.bind(host);
    let active: ScanSession | undefined;
    host.startBatchScan = async (request) => {
      started.push(request.entryUrl);
      if (started.length > 1) return start(request);
      active = { id: "finalizing", entryUrl: request.entryUrl, startedAt: new Date().toISOString(),
        status: "running", hasResult: false, progress: initialProgress("running") };
      return active;
    };
    const read = host.getSession.bind(host);
    host.getSession = async (id) => id === "finalizing" ? active : read(id);
    host.cancelScan = async () => { throw new Error("native watchdog has not expired"); };
    const workerSec = 60;
    const coordinator = new BatchCoordinator(host, targets, { timeoutSec: workerSec }, 1000);
    const running = coordinator.start();
    // Finalization is still inside the native grace, beyond the former 45 s UI limit.
    await vi.advanceTimersByTimeAsync((workerSec + SCAN_POLICY.deadline.hostGraceSec - 10) * 1000);
    expect(started).toEqual([targets[0]!.entryUrl]);
    expect(coordinator.snapshot().phase).toBe("running");
    active = { ...active!, status: "succeeded" };
    await vi.advanceTimersByTimeAsync(10_000);
    await running;
    expect(started).toEqual(targets.map((target) => target.entryUrl));
    expect(coordinator.snapshot().phase).toBe("complete");
  } finally { vi.useRealTimers(); }
});

it("pause preserves the first independent result and resumes only the remaining target", async () => {
  const host = hostForTest(); const coordinator = new BatchCoordinator(host, targets, {}, 1);
  const unsubscribe = coordinator.subscribe((state) => {
    if (state.phase === "running" && state.targets[0]?.status === "partial" && !state.pauseRequested) coordinator.pause();
  });
  await coordinator.start();
  const first = coordinator.snapshot().targets[0]!.session!;
  const json = JSON.stringify(await host.getOfficialResult(first.id));
  expect(coordinator.snapshot().phase).toBe("paused");
  expect(coordinator.snapshot().targets[1]?.status).toBe("pending");
  // Remove the pause consumer before resuming, as the operator does.
  unsubscribe();
  await coordinator.start();
  const sessions = coordinator.snapshot().targets.map((target) => target.session!);
  expect(sessions[0]!.id).toBe(first.id);
  expect(sessions[0]!.id).not.toBe(sessions[1]!.id);
  expect((await host.getOfficialResult(sessions[0]!.id))?.meta.entry_url).toBe(targets[0]!.entryUrl);
  expect((await host.getOfficialResult(sessions[1]!.id))?.meta.entry_url).toBe(targets[1]!.entryUrl);
  expect(JSON.stringify(await host.getOfficialResult(first.id))).toBe(json);
});

it("stop during the second site preserves the completed first result and retains the cancelled session", async () => {
  const host = hostForTest(); const original = host.getSession.bind(host);
  let secondId = "";
  host.getSession = async (id) => {
    const session = await original(id);
    return id === secondId && session?.status === "succeeded" ? { ...session, status: "running" } : session;
  };
  const coordinator = new BatchCoordinator(host, targets, {}, 1);
  let stop: Promise<void> | undefined;
  coordinator.subscribe((state) => {
    const second = state.targets[1];
    if (second?.status === "running" && second.session && !stop) {
      secondId = second.session.id; stop = coordinator.stop();
    }
  });
  await coordinator.start(); await stop;
  const state = coordinator.snapshot();
  expect(state.phase).toBe("stopped");
  expect(state.targets[0]?.session?.hasResult).toBe(true);
  expect((await host.getOfficialResult(state.targets[0]!.session!.id))?.meta.entry_url).toBe(targets[0]!.entryUrl);
  expect(state.targets[1]?.status).toBe("cancelled");
});

it("an unreadable active session stops admission rather than starting another site", async () => {
  const host = hostForTest(); host.getSession = async () => undefined;
  const coordinator = new BatchCoordinator(host, targets, {}, 1);
  await coordinator.start();
  expect(coordinator.snapshot().phase).toBe("stopped");
  expect(coordinator.snapshot().targets[0]?.status).toBe("failed");
  expect(coordinator.snapshot().targets[1]?.status).toBe("pending");
  expect(coordinator.snapshot().targets[0]?.canRetry).toBe(false);
});
