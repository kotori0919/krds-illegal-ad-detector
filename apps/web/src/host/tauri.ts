/**
 * TauriHost: native HostBridge for the desktop app (GOAL Phase 18).
 *
 * React code talks to HostBridge only — this adapter is the single place
 * where Tauri IPC (`@tauri-apps/api/core` invoke + event listen) enters the
 * web codebase. All Tauri commands are narrow and typed:
 * scanner lifecycle (start/cancel), session/result reads, and result export.
 * No arbitrary shell execution is exposed to the frontend.
 */
import {
  TAURI_HOST_CAPABILITIES,
  type ExportPaths,
  type ExtraResult,
  type HostBridge,
  type HostCapabilities,
  type OfficialResult,
  type ScanEvent,
  type ScanEventHandler,
  type ScanRequest,
  type ScanSession,
  type Unsubscribe,
} from "@krds-detector/contracts";

interface TauriInvoke {
  <T>(cmd: string, args?: Record<string, unknown>): Promise<T>;
}

interface TauriListen {
  (event: string, handler: (e: { payload: ScanEvent }) => void): Promise<Unsubscribe>;
}

async function loadTauri(): Promise<{ invoke: TauriInvoke; listen: TauriListen }> {
  const core = (await import("@tauri-apps/api/core")) as unknown as {
    invoke: TauriInvoke;
  };
  const event = (await import("@tauri-apps/api/event")) as unknown as {
    listen: TauriListen;
  };
  return { invoke: core.invoke, listen: event.listen };
}

export class TauriHost implements HostBridge {
  private invokePromise: Promise<TauriInvoke> | undefined;
  private handlers = new Set<ScanEventHandler>();
  private subscribed = false;

  private async invoke(): Promise<TauriInvoke> {
    if (!this.invokePromise) {
      this.invokePromise = loadTauri().then((t) => t.invoke);
    }
    return this.invokePromise;
  }

  private async ensureSubscribed(): Promise<void> {
    if (this.subscribed) return;
    // Subscription failure must surface: silent best-effort hides ACL
    // denials and loses completion events. Callers decide how to proceed.
    const { listen } = await loadTauri();
    await listen("scan-event", (e) => {
      for (const h of this.handlers) h(e.payload);
    });
    this.subscribed = true;
  }

  /** True once the scan-event subscription succeeded. */
  subscribedToEvents(): boolean {
    return this.subscribed;
  }

  async getCapabilities(): Promise<HostCapabilities> {
    return { ...TAURI_HOST_CAPABILITIES };
  }

  async startScan(request: ScanRequest): Promise<ScanSession> {
    await this.ensureSubscribed();
    const invoke = await this.invoke();
    return invoke<ScanSession>("scan_start", { request });
  }

  async cancelScan(sessionId: string): Promise<void> {
    const invoke = await this.invoke();
    await invoke<void>("scan_cancel", { sessionId });
  }

  onScanEvent(handler: ScanEventHandler): Unsubscribe {
    this.handlers.add(handler);
    void this.ensureSubscribed().catch(() => undefined);
    return () => {
      this.handlers.delete(handler);
    };
  }

  async getSession(sessionId: string): Promise<ScanSession | undefined> {
    const invoke = await this.invoke();
    return invoke<ScanSession | undefined>("scan_get_session", { sessionId });
  }

  async getOfficialResult(sessionId: string): Promise<OfficialResult | undefined> {
    const invoke = await this.invoke();
    return invoke<OfficialResult | undefined>("scan_get_result", { sessionId });
  }

  async getExtraResult(sessionId: string): Promise<ExtraResult | undefined> {
    const invoke = await this.invoke();
    return invoke<ExtraResult | undefined>("scan_get_extra_result", { sessionId });
  }

  async exportResult(sessionId: string, directory: string): Promise<ExportPaths> {
    const invoke = await this.invoke();
    return invoke<ExportPaths>("scan_export", { sessionId, directory });
  }
}
