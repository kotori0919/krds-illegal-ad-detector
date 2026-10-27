// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup } from "@testing-library/react";
import { TauriHost } from "../src/host/tauri.js";
import { initialProgress, type ScanEvent, type ScanSession } from "@krds-detector/contracts";

afterEach(() => {
  cleanup();
  vi.unmock("@tauri-apps/api/core");
  vi.unmock("@tauri-apps/api/event");
  vi.resetModules();
});

describe("WARP status boundary", () => {
  it("rejects extra status fields without exposing their contents", async () => {
    vi.doMock("@tauri-apps/api/core", () => ({ invoke: async () => ({ state: "ready", backend: "usque", version: "4.2.1", token: "private-fixture-value" }) }));
    const { TauriHost: H } = await import("../src/host/tauri.js");
    await expect(new H().getWarpStatus()).rejects.toThrow("Invalid WARP status");
  });
  it("keeps browser replay unsupported and rejects registration", async () => {
    const { BrowserHost } = await import("../src/host/browser.js");
    const host = new BrowserHost();
    expect(await host.getWarpStatus()).toEqual({ state: "unsupported" });
    await expect(host.registerWarp({ acceptTerms: true })).rejects.toThrow();
  });
});

function session(): ScanSession {
  return {
    id: "s1",
    entryUrl: "https://example.kr/",
    status: "running",
    startedAt: "2026-10-02T00:00:00.000Z",
    progress: initialProgress("running"),
  };
}

const completedEvent = (): ScanEvent => ({ kind: "session-finished", sessionId: "s1", at: "2026-10-25T00:00:00.000Z", progress: initialProgress("completed") });

/** Install a fake @tauri-apps/api pair; fails listen when told to. */
async function mockTauri(opts: { listenFails?: boolean; onListen?: () => void } = {}) {
  const invoke = vi.fn(async () => session());
  const unlisten = vi.fn(async () => {});
  const listen = vi.fn(async () => {
    opts.onListen?.();
    if (opts.listenFails) throw new Error("denied");
    return unlisten;
  });
  vi.doMock("@tauri-apps/api/core", () => ({ invoke }));
  vi.doMock("@tauri-apps/api/event", () => ({ listen }));
  const { TauriHost: H } = await import("../src/host/tauri.js");
  return { host: new H() as InstanceType<typeof TauriHost>, invoke, listen, unlisten };
}

describe("TauriHost subscription lifecycle", () => {
  it("shares a pending subscription across handler registration and scan starts", async () => {
    let finish!: () => void;
    const registered = new Promise<void>((resolve) => { finish = resolve; });
    const callbacks: Array<(event: { payload: ScanEvent }) => void> = [];
    const listen = vi.fn(async (_event: string, callback: (event: { payload: ScanEvent }) => void) => {
      callbacks.push(callback);
      await registered;
      return vi.fn();
    });
    const invoke = vi.fn(async () => session());
    vi.doMock("@tauri-apps/api/core", () => ({ invoke }));
    vi.doMock("@tauri-apps/api/event", () => ({ listen }));
    const { TauriHost: H } = await import("../src/host/tauri.js");
    const host = new H();
    const handler = vi.fn();
    const stop = host.onScanEvent(handler);
    await act(async () => {});
    const start = host.startScan({ entryUrl: "https://example.kr/" });
    const batch = host.startBatchScan({ entryUrl: "https://example.kr/", kind: "site" });
    await act(async () => {});
    expect(invoke).not.toHaveBeenCalled();
    finish();
    await Promise.all([start, batch]);
    const event = completedEvent();
    for (const callback of callbacks) callback({ payload: event });
    expect(listen).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(event);
    stop();
    for (const callback of callbacks) callback({ payload: event });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("shares subscription failure, prevents scan invokes and allows a fresh retry", async () => {
    let fail!: (error: Error) => void;
    const failed = new Promise<never>((_resolve, reject) => { fail = reject; });
    let deliver!: (event: { payload: ScanEvent }) => void;
    const listen = vi.fn().mockImplementationOnce(() => failed).mockImplementation(async (_name, callback) => { deliver = callback; return vi.fn(); });
    const invoke = vi.fn(async () => session());
    vi.doMock("@tauri-apps/api/core", () => ({ invoke }));
    vi.doMock("@tauri-apps/api/event", () => ({ listen }));
    const { TauriHost: H } = await import("../src/host/tauri.js");
    const host = new H();
    const handler = vi.fn();
    host.onScanEvent(handler);
    await act(async () => {});
    const starts = [host.startScan({ entryUrl: "https://example.kr/" }), host.startScan({ entryUrl: "https://example.kr/" })];
    const settled = Promise.allSettled(starts);
    await act(async () => {});
    fail(new Error("subscription unavailable"));
    expect((await settled).map((result) => result.status)).toEqual(["rejected", "rejected"]);
    expect(invoke).not.toHaveBeenCalled();
    expect(host.subscribedToEvents()).toBe(false);
    await host.startScan({ entryUrl: "https://example.kr/" });
    expect(host.subscribedToEvents()).toBe(true);
    expect(listen).toHaveBeenCalledTimes(2);
    expect(invoke).toHaveBeenCalledTimes(1);
    const event = completedEvent();
    deliver({ payload: event });
    expect(handler).toHaveBeenCalledExactlyOnceWith(event);
  });

  it("subscribes before invoking so immediate completion cannot be lost", async () => {
    const order: string[] = [];
    let deliver!: (event: { payload: ScanEvent }) => void;
    const event = completedEvent();
    const invoke = vi.fn(async () => {
      order.push("invoke");
      deliver({ payload: event });
      return session();
    });
    const listen = vi.fn(async (_name: string, callback: typeof deliver) => {
      order.push("listen");
      deliver = callback;
      return vi.fn(async () => {});
    });
    vi.doMock("@tauri-apps/api/core", () => ({ invoke }));
    vi.doMock("@tauri-apps/api/event", () => ({ listen }));
    const { TauriHost: H } = await import("../src/host/tauri.js");
    const host = new H();
    const handler = vi.fn();
    host.onScanEvent(handler);
    await host.startScan({ entryUrl: "https://example.kr/" });
    expect(order).toEqual(["listen", "invoke"]);
    expect(handler).toHaveBeenCalledExactlyOnceWith(event);
  });

  it("surfaces a denied subscription instead of hiding it", async () => {
    const { host } = await mockTauri({ listenFails: true });
    await expect(host.startScan({ entryUrl: "https://example.kr/" })).rejects.toThrow(
      /denied/,
    );
  });

  it("repeated start reuses one subscription without duplicate scans", async () => {
    const { host, invoke, listen } = await mockTauri();
    await host.startScan({ entryUrl: "https://example.kr/" });
    await host.startScan({ entryUrl: "https://example.kr/" });
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(listen).toHaveBeenCalledTimes(1);
  });
  it("subscribes asynchronously after handler registration", async () => {
    const { host, listen } = await mockTauri();
    host.onScanEvent(() => {});
    // onScanEvent fires ensureSubscribed without awaiting; flush first.
    await act(async () => {});
    expect(listen).toHaveBeenCalledTimes(1);
  });
});

describe("TauriHost evidence read retention", () => {
  it("does not retain an oversized response or displace useful cached evidence", async () => {
    const invoke = vi.fn(async (_command: string, args: { assetId: string }) => ({ assetId: args.assetId, mimeType: "image/jpeg",
      dataUrl: args.assetId === "large" ? "A".repeat(9 * 1024 * 1024) : "data:image/jpeg;base64,YQ==" }));
    vi.doMock("@tauri-apps/api/core", () => ({ invoke }));
    vi.doMock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));
    const { TauriHost: H } = await import("../src/host/tauri.js");
    const host = new H();
    const active = await host.getEvidenceAsset("s1", "small");
    expect((await host.getEvidenceAsset("s1", "large"))?.dataUrl.length).toBe(9 * 1024 * 1024);
    expect(await host.getEvidenceAsset("s1", "small")).toEqual(active);
    expect(invoke).toHaveBeenCalledTimes(2);
    await host.getEvidenceAsset("s1", "large");
    expect(invoke).toHaveBeenCalledTimes(3);
  });

  it("bounds completed image retention and reloads evicted bytes without changing active evidence", async () => {
    const dataUrl = `data:image/jpeg;base64,${"A".repeat(512 * 1024)}`;
    const invoke = vi.fn(async (_command: string, args: { assetId: string }) => ({ assetId: args.assetId, mimeType: "image/jpeg", dataUrl }));
    vi.doMock("@tauri-apps/api/core", () => ({ invoke }));
    vi.doMock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));
    const { TauriHost: H } = await import("../src/host/tauri.js");
    const host = new H();
    const active = await host.getEvidenceAsset("s1", "asset-0");
    for (let i = 1; i <= 40; i++) await host.getEvidenceAsset("s1", `asset-${i}`);
    const calls = invoke.mock.calls.length;
    await host.getEvidenceAsset("s1", "asset-40");
    expect(invoke).toHaveBeenCalledTimes(calls);
    expect(await host.getEvidenceAsset("s1", "asset-0")).toEqual(active);
    expect(invoke).toHaveBeenCalledTimes(calls + 1);
    expect(active?.dataUrl).toBe(dataUrl);
  });

  it("bounds metadata entries, retaining recently read records", async () => {
    const invoke = vi.fn(async (_command: string, args: { findingId: string }) => ({ findingId: args.findingId }));
    vi.doMock("@tauri-apps/api/core", () => ({ invoke }));
    vi.doMock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));
    const { TauriHost: H } = await import("../src/host/tauri.js");
    const host = new H();
    await host.getFindingDetail("s1", "kept");
    await host.getFindingDetail("s1", "oldest");
    for (let i = 0; i < 127; i++) {
      await host.getFindingDetail("s1", "kept");
      await host.getFindingDetail("s1", `finding-${i}`);
    }
    const calls = invoke.mock.calls.length;
    await host.getFindingDetail("s1", "kept");
    expect(invoke).toHaveBeenCalledTimes(calls);
    await host.getFindingDetail("s1", "oldest");
    expect(invoke).toHaveBeenCalledTimes(calls + 1);
  });

  it("does not let an invalidated read remove or account for its replacement", async () => {
    let fail!: (error: Error) => void;
    let complete!: (value: unknown) => void;
    const invoke = vi.fn().mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject; }))
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
    vi.doMock("@tauri-apps/api/core", () => ({ invoke }));
    vi.doMock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));
    const { TauriHost: H } = await import("../src/host/tauri.js");
    const host = new H();
    const first = host.getEvidenceAsset("s1", "asset");
    const rejected = expect(first).rejects.toThrow("stale read");
    await act(async () => {});
    await host.deleteCase("00000000-0000-4000-8000-000000000001");
    const replacement = host.getEvidenceAsset("s1", "asset");
    await act(async () => {});
    fail(new Error("stale read"));
    await rejected;
    const duplicate = host.getEvidenceAsset("s1", "asset");
    expect(duplicate).toBe(replacement);
    complete({ assetId: "asset", mimeType: "image/jpeg", dataUrl: "data:image/jpeg;base64,YQ==" });
    expect(await duplicate).toEqual(await replacement);
    expect(invoke).toHaveBeenCalledTimes(3);
  });

  it("reuses in-flight and completed asset reads within one session while isolating another session", async () => {
    let complete!: (value: unknown) => void;
    const invoke = vi.fn(() => new Promise((resolve) => { complete = resolve; }));
    vi.doMock("@tauri-apps/api/core", () => ({ invoke }));
    vi.doMock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));
    const { TauriHost: H } = await import("../src/host/tauri.js");
    const host = new H();
    const first = host.getEvidenceAsset("s1", "asset");
    const second = host.getEvidenceAsset("s1", "asset");
    await act(async () => {});
    const asset = { assetId: "asset", mimeType: "image/jpeg", dataUrl: "data:image/jpeg;base64,YQ==" };
    complete(asset);
    expect(await first).toEqual(asset);
    expect(await second).toEqual(asset);
    expect(await host.getEvidenceAsset("s1", "asset")).toEqual(asset);
    expect(invoke).toHaveBeenCalledTimes(1);
    const other = host.getEvidenceAsset("s2", "asset");
    await act(async () => {});
    complete(undefined);
    expect(await other).toBeUndefined();
  });

  it("does not retain an incomplete or failed read, so finalized evidence and retries become available", async () => {
    const asset = { assetId: "asset", mimeType: "image/jpeg", dataUrl: "data:image/jpeg;base64,YQ==" };
    const invoke = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("transient read failure")).mockResolvedValue(asset);
    vi.doMock("@tauri-apps/api/core", () => ({ invoke }));
    vi.doMock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));
    const { TauriHost: H } = await import("../src/host/tauri.js");
    const host = new H();
    expect(await host.getEvidenceAsset("s1", "asset")).toBeUndefined();
    await expect(host.getEvidenceAsset("s1", "asset")).rejects.toThrow("transient read failure");
    expect(await host.getEvidenceAsset("s1", "asset")).toEqual(asset);
  });
});
