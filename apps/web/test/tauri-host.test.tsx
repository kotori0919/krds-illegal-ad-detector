// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { TauriHost } from "../src/host/tauri.js";
import type { ScanSession } from "@krds-detector/contracts";

afterEach(() => {
  cleanup();
  vi.unmock("@tauri-apps/api/core");
  vi.unmock("@tauri-apps/api/event");
  vi.resetModules();
});

function session(): ScanSession {
  return {
    id: "s1",
    entryUrl: "https://example.kr/",
    topic: "",
    status: "crawling",
    startedAt: "2026-10-02T00:00:00.000Z",
  };
}

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
  it("subscribes before invoking so immediate completion cannot be lost", async () => {
    const order: string[] = [];
    const invoke = vi.fn(async () => {
      order.push("invoke");
      return session();
    });
    const listen = vi.fn(async () => {
      order.push("listen");
      return vi.fn(async () => {});
    });
    vi.doMock("@tauri-apps/api/core", () => ({ invoke }));
    vi.doMock("@tauri-apps/api/event", () => ({ listen }));
    const { TauriHost: H } = await import("../src/host/tauri.js");
    await new H().startScan({ entryUrl: "https://example.kr/" });
    expect(order).toEqual(["listen", "invoke"]);
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
