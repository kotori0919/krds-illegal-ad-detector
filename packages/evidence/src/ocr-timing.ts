/**
 * Bounded analysis timing.
 *
 * The contract caps `elapsedMs` at 8 s (text) and 16 s (visual). That cap is a
 * budget for analysis, so one-time engine/model initialization must never be
 * charged to it: the clock starts only after every engine, tokenizer session
 * and reference table the request needs has resolved.
 */
export async function analyzeAfterInit<E, T extends { state: string; elapsedMs?: number }>(
  initialize: () => Promise<E>,
  analyze: (engine: E) => Promise<T>,
  warm?: (engine: E) => Promise<unknown>,
): Promise<T> {
  const engine = await initialize();
  await warm?.(engine);
  const started = performance.now();
  const evidence = await analyze(engine);
  if (evidence.state === "available") evidence.elapsedMs = performance.now() - started;
  return evidence;
}
