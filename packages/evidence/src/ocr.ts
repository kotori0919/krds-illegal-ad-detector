import { Worker } from "node:worker_threads";
import type { OcrBackend, OcrCropRequest, OcrResult } from "./adapters.js";

/** One serial CPU engine per scan; deadlines terminate the entire worker. */
export class LocalOcrBackend implements OcrBackend {
  readonly name = "tesseract-cpu-kor-eng-v7";
  private worker?: Worker;
  private closed = false;
  private queue: Promise<unknown> = Promise.resolve();
  private closing?: Promise<void>;

  recognize(crop: OcrCropRequest, timeoutMs = 8000, signal?: AbortSignal): Promise<OcrResult> {
    const queuedAt = performance.now();
    const result = this.queue.then(() => this.run(crop, timeoutMs - (performance.now() - queuedAt), signal));
    this.queue = result.catch(() => undefined);
    return result;
  }

  private async run(crop: OcrCropRequest, timeoutMs: number, signal?: AbortSignal): Promise<OcrResult> {
    if (signal?.aborted || timeoutMs < 1) throw new Error("OCR budget exhausted");
    if (this.closed) throw new Error("OCR engine closed");
    if (crop.imageBytes.length === 0 || crop.imageBytes.length > 250_000
      || crop.width * crop.height > 4_000_000) throw new Error("OCR image exceeds candidate bounds");
    this.worker ??= new Worker(new URL("./ocr-worker.mjs", import.meta.url), { stdout: true, stderr: true });
    const worker = this.worker;
    // Tesseract diagnostics must never contaminate official JSON stdout.
    worker.stdout.resume();
    worker.stderr.resume();
    return new Promise<OcrResult>((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error, data?: { text: string; confidence: number }): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        worker.off("message", message);
        worker.off("error", failed);
        worker.off("exit", exited);
        if (error) { void this.close(); reject(error); }
        else resolve({ sourceId: crop.sourceId, backend: this.name, text: data!.text,
          confidence: Math.min(1, Math.max(0, data!.confidence)) });
      };
      const abort = (): void => finish(new Error("OCR budget exhausted"));
      const failed = (): void => finish(new Error("OCR recognition failed"));
      const exited = (): void => finish(new Error("OCR worker exited"));
      const message = (data: { error?: string; text: string; confidence: number }): void => {
        if (data.error || typeof data.text !== "string" || !Number.isFinite(data.confidence)) failed();
        else finish(undefined, data);
      };
      const timer = setTimeout(abort, timeoutMs);
      worker.once("message", message);
      worker.once("error", failed);
      worker.once("exit", exited);
      signal?.addEventListener("abort", abort, { once: true });
      worker.postMessage({ imageBytes: crop.imageBytes });
    });
  }

  close(): Promise<void> {
    this.closed = true;
    if (this.closing) return this.closing;
    const worker = this.worker;
    this.worker = undefined;
    this.closing = worker ? worker.terminate().then(() => undefined) : Promise.resolve();
    return this.closing;
  }
}
