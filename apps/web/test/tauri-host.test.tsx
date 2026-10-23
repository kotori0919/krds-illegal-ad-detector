// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup } from "@testing-library/react";
import { TauriHost } from "../src/host/tauri.js";
import { initialProgress, type ScanSession } from "@krds-detector/contracts";

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

describe("TauriHost evidence read retention", () => {
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
