/** Host-only diagnostics. Never serialize a payload, raw error, stack or stderr. */
export type OcrOperation = "recognize" | "analyze-text" | "analyze-image" | "warm";
export type OcrFailurePhase = "spawn" | "worker-error" | "ipc-send" | "response-validation" | "worker-exit" | "deadline" | "cancelled";

const ERROR_NAMES = new Set(["Error", "TypeError", "RangeError", "SyntaxError", "SystemError"]);
const ERROR_CODES = new Set(["ENOMEM", "ENOENT", "EACCES", "EPERM", "EPIPE", "EAGAIN",
  "ERR_IPC_CHANNEL_CLOSED", "ERR_IPC_DISCONNECTED", "ERR_INVALID_ARG_TYPE"]);
const SIGNALS = new Set(["SIGKILL", "SIGTERM", "SIGSEGV", "SIGABRT", "SIGBUS", "SIGILL", "SIGTRAP"]);

export function recordOcrFailure(operation: OcrOperation, phase: OcrFailurePhase, cause?: unknown,
  exit?: { code: number | null; signal: string | null }): void {
  // Original cause stays on the rejected Error, in process only. Logs contain
  // a fixed vocabulary: even an exception message/name/code may contain input.
  try {
    const error = cause instanceof Error ? cause : undefined;
    const name = error?.name;
    const code = error && "code" in error ? error.code : undefined;
    const record = { version: 1, operation, phase,
      ...(cause === undefined ? {} : { causeName: typeof name === "string" && ERROR_NAMES.has(name) ? name : "OTHER",
        causeCode: typeof code === "string" && ERROR_CODES.has(code) ? code : "OTHER" }),
      ...(exit ? { exitCode: Number.isInteger(exit.code) && exit.code! >= 0 && exit.code! <= 255 ? exit.code : null,
        signal: exit.signal === null ? null : SIGNALS.has(exit.signal) ? exit.signal : "OTHER" } : {}) };
    // Broken/closed diagnostic output must not replace the original failure.
    process.stderr.write(`KRDSOCRDIAGNOSTIC ${JSON.stringify(record)}\n`);
  } catch { /* best effort, including unusual error property accessors */ }
}

export function ocrFailure(operation: OcrOperation, phase: OcrFailurePhase, message: string, cause?: unknown,
  exit?: { code: number | null; signal: string | null }): Error {
  recordOcrFailure(operation, phase, cause, exit);
  return cause === undefined ? new Error(message) : new Error(message, { cause });
}
