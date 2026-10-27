import { createHash } from "node:crypto";
import { fork, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validTextEmbeddingEvidence, validVisualEmbeddingEvidence, type TextEmbeddingEvidence, type VisualEmbeddingEvidence } from "@krds-detector/contracts";
import { ocrFailure, recordOcrFailure, type OcrFailurePhase, type OcrOperation } from "./ocr-diagnostics.js";
import type { OcrBackend, OcrCropRequest, OcrResult } from "./adapters.js";

/** One serial CPU engine per scan; deadlines terminate the entire worker. */
export class LocalOcrBackend implements OcrBackend {
  readonly name = "offline-korean-ocr-v2";
  private worker?: ChildProcess;
  private closed = false;
  private queue: Promise<unknown> = Promise.resolve();
  private closing?: Promise<void>;
  private stopping: Promise<void> = Promise.resolve();

  recognize(crop: OcrCropRequest, timeoutMs = 8000, signal?: AbortSignal): Promise<OcrResult> {
    if (crop.imageBytes.length === 0 || crop.imageBytes.length > 250_000 || crop.width * crop.height > 4_000_000) {
      if (signal?.aborted) return Promise.reject(new Error("OCR budget exhausted"));
      return Promise.reject(new Error("OCR image exceeds candidate bounds"));
    }
    return this.enqueue("recognize", { imageBytes: crop.imageBytes, variant: crop.variant }, (value) => {
      const data = value as { error?: string; text?: string; confidence?: number; backend?: string };
      if (!data || data.error || typeof data.text !== "string" || typeof data.confidence !== "number" || !Number.isFinite(data.confidence)) {
        throw new Error("OCR recognition failed");
      }
      return { sourceId: crop.sourceId, backend: data.backend ?? this.name, text: data.text,
        confidence: Math.min(1, Math.max(0, data.confidence)) };
    }, timeoutMs, signal);
  }

  analyzeText(text: string, timeoutMs = 8000, signal?: AbortSignal): Promise<TextEmbeddingEvidence> {
    if (!text.trim() || text.length > 4096 || /<\|/.test(text)) return Promise.resolve({ state: "unavailable", reason: "invalid-input" });
    return this.enqueue("analyze-text", { text }, (value) => {
      const evidence = (value as { embedding?: unknown } | null)?.embedding;
      if (!validTextEmbeddingEvidence(evidence)) throw new Error("OCR recognition failed");
      return evidence as TextEmbeddingEvidence;
    }, timeoutMs, signal);
  }

  analyzeImage(crop: OcrCropRequest, text: string, timeoutMs = 16000, signal?: AbortSignal): Promise<VisualEmbeddingEvidence> {
    if (!crop.imageBytes.length || crop.imageBytes.length > 250000 || crop.width * crop.height > 4000000
      || text.length > 4096 || /<\|/.test(text)) return Promise.resolve({ state: "unavailable", reason: "invalid-input" });
    const hash = createHash("sha256").update(crop.imageBytes).digest("hex");
    return this.enqueue("analyze-image", { visual: { imageBytes: crop.imageBytes, text } }, value => {
      const evidence = (value as { visualEmbedding?: unknown } | null)?.visualEmbedding;
      if (!validVisualEmbeddingEvidence(evidence)) throw new Error("Image comparison failed");
      const result = evidence as VisualEmbeddingEvidence;
      if (result.state === "available" && result.imageSha256 !== hash) throw new Error("Image comparison source mismatch");
      return result;
    }, timeoutMs, signal);
  }

  /**
   * Initializes the worker's shared engines once. Analysis calls then report
   * only their own elapsed time, and the first one costs no cold-start budget.
   */
  warm(timeoutMs = 8000, signal?: AbortSignal): Promise<void> {
    return this.enqueue("warm", { warm: true }, value => {
      if ((value as { warmed?: unknown } | null)?.warmed !== true) throw new Error("OCR warm-up failed");
    }, timeoutMs, signal);
  }

  private enqueue<T>(operation: OcrOperation, payload: object, parse: (value: unknown) => T, timeoutMs: number, signal?: AbortSignal): Promise<T> {
    const queuedAt = performance.now();
    const result = this.queue.then(() => this.run(operation, payload, parse, timeoutMs - (performance.now() - queuedAt), signal));
    this.queue = result.catch(() => undefined);
    return result;
  }

  private async run<T>(operation: OcrOperation, payload: object, parse: (value: unknown) => T, timeoutMs: number, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted || timeoutMs < 1) throw new Error("OCR budget exhausted");
    if (this.closed) throw new Error("OCR engine closed");
    try {
      this.worker ??= fork(fileURLToPath(new URL("./ocr-worker.mjs", import.meta.url)), [], {
        stdio: ["ignore", "pipe", "pipe", "ipc"], serialization: "advanced", execArgv: [],
      });
    } catch (cause) {
      recordOcrFailure(operation, "spawn", cause);
      throw cause;
    }
    const worker = this.worker;
    worker.stdout?.resume(); worker.stderr?.resume();
    return new Promise<T>((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error, data?: T): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        worker.off("message", message); worker.off("error", failed); worker.off("exit", exited);
        if (error) {
          const stopped = signal?.aborted ? this.close() : this.stopWorker();
          void stopped.then(() => reject(error), () => reject(error));
        } else resolve(data!);
      };
      const fail = (phase: OcrFailurePhase, message: string, cause?: unknown,
        exit?: { code: number | null; signal: string | null }): void => {
        if (!settled) finish(ocrFailure(operation, phase, message, cause, exit));
      };
      const abort = (): void => fail(signal?.aborted ? "cancelled" : "deadline", "OCR budget exhausted");
      const failed = (cause: Error): void => fail("worker-error", "OCR recognition failed", cause);
      const exited = (code: number | null, exitSignal: NodeJS.Signals | null): void =>
        fail("worker-exit", "OCR worker exited", undefined, { code, signal: exitSignal });
      const message = (value: unknown): void => {
        try { finish(undefined, parse(value)); }
        catch (cause) { fail("response-validation", "OCR recognition failed", cause); }
      };
      const timer = setTimeout(abort, timeoutMs);
      worker.once("message", message); worker.once("error", failed); worker.once("exit", exited);
      signal?.addEventListener("abort", abort, { once: true });
      try {
        worker.send(payload, cause => { if (cause) fail("ipc-send", "OCR recognition failed", cause); });
      } catch (cause) {
        // Preserve the existing synchronous-send rejection; do not normalize it.
        recordOcrFailure(operation, "ipc-send", cause);
        throw cause;
      }
    });
  }

  close(): Promise<void> {
    this.closed = true;
    if (this.closing) return this.closing;
    this.closing = this.stopWorker();
    return this.closing;
  }

  private stopWorker(): Promise<void> {
    const worker = this.worker;
    this.worker = undefined;
    if (worker) {
      const exited = new Promise<void>(resolve => {
        if (worker.exitCode !== null || worker.signalCode !== null) { resolve(); return; }
        worker.once("close", () => resolve()); worker.kill("SIGKILL");
      });
      this.stopping = Promise.all([this.stopping, exited]).then(() => undefined);
    }
    return this.stopping;
  }
}
