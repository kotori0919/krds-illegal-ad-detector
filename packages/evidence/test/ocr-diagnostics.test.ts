import { EventEmitter } from "node:events";
import { fork, type ChildProcess } from "node:child_process";
import { afterEach, expect, it, vi } from "vitest";
import { LocalOcrBackend } from "../src/ocr.js";
import { ocrFailure, recordOcrFailure } from "../src/ocr-diagnostics.js";

vi.mock("node:child_process", () => ({ fork: vi.fn() }));
afterEach(() => vi.restoreAllMocks());

// No browser, native engine, model, filesystem fixture or real child process.
class FixtureWorker extends EventEmitter {
  exitCode: number | null = null;
  signalCode: NodeJS.Signals | null = null;
  stdout = { resume: vi.fn() };
  stderr = { resume: vi.fn() };
  respond: (callback: (error: Error | null) => void) => void = () => {};
  send(_payload: object, callback: (error: Error | null) => void) {
    queueMicrotask(() => this.respond(callback));
  }
  kill() {
    this.signalCode = "SIGKILL";
    queueMicrotask(() => this.emit("close"));
    return true;
  }
}

function fixture() {
  const worker = new FixtureWorker();
  vi.mocked(fork).mockReturnValue(worker as unknown as ChildProcess);
  const output: string[] = [];
  vi.spyOn(process.stderr, "write").mockImplementation(chunk => { output.push(String(chunk)); return true; });
  return { worker, output, engine: new LocalOcrBackend() };
}

it("retains response-validation cause and legacy public message without logging the response", async () => {
  const { worker, output, engine } = fixture();
  worker.respond = () => worker.emit("message", { error: "private payload https://secret.example/?token=secret" });
  try {
    const failure = await engine.warm().catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe("OCR recognition failed");
    expect((failure as Error).cause).toBeInstanceOf(Error);
    expect(((failure as Error).cause as Error).message).toBe("OCR warm-up failed");
    expect(output).toHaveLength(1);
    expect(output[0]!.endsWith("\n")).toBe(true);
    expect(output[0]).toContain('"operation":"warm","phase":"response-validation"');
    expect(output.join("")).not.toMatch(/secret|private|payload|https/);
    expect(worker.listenerCount("message")).toBe(0);
    expect(worker.listenerCount("error")).toBe(0);
  } finally { await engine.close(); }
});

it.each(["ipc-send", "worker-error"] as const)("preserves original %s Error identity and logs only allowlisted code", async phase => {
  const { worker, output, engine } = fixture();
  const original = Object.assign(new Error("password=private"), { code: "ENOMEM" });
  worker.respond = callback => phase === "ipc-send" ? callback(original) : worker.emit("error", original);
  try {
    const failure = await engine.analyzeText("private OCR input").catch((error: unknown) => error);
    expect((failure as Error).message).toBe("OCR recognition failed");
    expect((failure as Error).cause).toBe(original);
    expect(output).toHaveLength(1);
    expect(output[0]).toContain(`"phase":"${phase}"`);
    expect(output[0]).toContain('"causeCode":"ENOMEM"');
    expect(output.join("")).not.toMatch(/password|private|OCR input/);
  } finally { await engine.close(); }
});

it("preserves synchronous spawn rejection and worker exit message", async () => {
  const { worker, output, engine } = fixture();
  const original = Object.assign(new Error("private executable path"), { code: "ENOENT" });
  vi.mocked(fork).mockImplementationOnce(() => { throw original; });
  try {
    await expect(engine.warm()).rejects.toBe(original);
    expect(output[0]).toContain('"phase":"spawn"');
    worker.respond = () => { worker.exitCode = 7; worker.emit("exit", 7, null); };
    await expect(engine.warm()).rejects.toThrow("OCR worker exited");
    expect(output[1]).toContain('"phase":"worker-exit"');
    expect(output[1]).toContain('"exitCode":7,"signal":null');
    expect(output.join("")).not.toContain("private");
  } finally { await engine.close(); }
});

it("does not log arbitrary names/codes/stacks or allow diagnostics to replace failures", () => {
  const { output } = fixture();
  recordOcrFailure("recognize", "worker-error", Object.assign(new Error("secret"), { name: "secret", code: "secret" }));
  expect(output[0]).toContain('"causeName":"OTHER","causeCode":"OTHER"');
  expect(output[0]).not.toContain("secret");
  expect(output[0]!.length).toBeLessThan(256);
  vi.mocked(process.stderr.write).mockImplementation(() => { throw new Error("closed log"); });
  expect(() => recordOcrFailure("warm", "spawn", new Error("secret"))).not.toThrow();
  const unusual = new Error();
  Object.defineProperty(unusual, "code", { get() { throw new Error("secret"); } });
  expect(() => recordOcrFailure("warm", "spawn", unusual)).not.toThrow();
});

it.each(["recognize", "analyze-image"] as const)("keeps %s rejection text while retaining its validation cause", async operation => {
  const { worker, output, engine } = fixture();
  worker.respond = () => worker.emit("message", null);
  const crop = { sourceId: "private-source", imageBytes: Buffer.from([0]), width: 1, height: 1, mediaType: "image/png" };
  try {
    const request = operation === "recognize" ? engine.recognize(crop) : engine.analyzeImage(crop, "private text");
    const failure = await request.catch((error: unknown) => error);
    expect((failure as Error).message).toBe("OCR recognition failed");
    expect(((failure as Error).cause as Error).message).toBe(operation === "recognize" ? "OCR recognition failed" : "Image comparison failed");
    expect(output[0]).toContain(`"operation":"${operation}","phase":"response-validation"`);
    expect(output.join("")).not.toContain("private");
  } finally { await engine.close(); }
});

it("keeps the deadline rejection while identifying its phase", async () => {
  vi.useFakeTimers();
  const { output, engine } = fixture();
  try {
    const pending = engine.warm(20).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(21);
    expect((await pending as Error).message).toBe("OCR budget exhausted");
    expect(output).toHaveLength(1);
    expect(output[0]).toContain('"operation":"warm","phase":"deadline"');
  } finally { await engine.close(); vi.useRealTimers(); }
});

it("captures changing error names once before allowlist checking and output", () => {
  const { output } = fixture();
  const original = new Error("private");
  let reads = 0;
  Object.defineProperty(original, "name", { get: () => ++reads === 1 ? "Error" : "token=private" });
  const failure = ocrFailure("warm", "worker-error", "OCR recognition failed", original);
  expect(failure.cause).toBe(original);
  expect(reads).toBe(1);
  expect(output).toHaveLength(1);
  expect(output[0]).toContain('"causeName":"Error"');
  expect(output[0]).not.toContain("private");
});

it("contains throwing name getters without replacing the original cause", () => {
  const { output } = fixture();
  const original = new Error("private");
  Object.defineProperty(original, "name", { get() { throw new Error("token=private"); } });
  const failure = ocrFailure("warm", "worker-error", "OCR recognition failed", original);
  expect(failure.message).toBe("OCR recognition failed");
  expect(failure.cause).toBe(original);
  expect(output).toHaveLength(0);
});

it("replaces oversized names with OTHER without logging their contents", () => {
  const { output } = fixture();
  recordOcrFailure("warm", "worker-error", Object.assign(new Error("private"), { name: "private".repeat(2048) }));
  expect(output).toHaveLength(1);
  expect(output[0]).toContain('"causeName":"OTHER"');
  expect(output[0]).not.toContain("private");
  expect(output[0]!.length).toBeLessThan(256);
});
