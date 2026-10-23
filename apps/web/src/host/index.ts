/**
 * Host selector: Tauri IPC when running inside the desktop shell, BrowserHost
 * preview otherwise. The `__TAURI_INTERNALS__` probe is the documented
 * runtime marker; no Tauri API is imported unless the marker is present, so
 * the browser bundle stays free of native code paths.
 */
import type { HostBridge } from "@krds-detector/contracts";
import { BrowserHost } from "./browser.js";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export async function createHost(): Promise<HostBridge> {
  if (typeof window !== "undefined" && window.__TAURI_INTERNALS__) {
    // Static import impossible: @tauri-apps/api is an optional dependency
    // absent from the browser bundle; dynamic import keeps it out of web builds.
    const { TauriHost } = await import("./tauri.js");
    return new TauriHost();
  }
  return new BrowserHost();
}
