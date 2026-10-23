import { expect, it, vi } from "vitest";
import { analyzeAfterInit } from "../src/ocr-timing.js";

// A cold engine pays hundreds of milliseconds to seconds of initialization.
// The contract cap measures analysis only, so the clock must start afterwards.
it("starts the analysis clock only after initialization and warm-up resolve", async () => {
  let clock = 0;
  const now = vi.spyOn(performance, "now").mockImplementation(() => clock);
  try {
    const evidence = await analyzeAfterInit(
      async () => { clock += 5_000; return { analyze: async () => { clock += 40; return { state: "available" as const, elapsedMs: 0 }; } }; },
      engine => engine.analyze(),
      async () => { clock += 6_000; },
    );
    // 11 s of startup/warm-up happened before the measured analysis.
    expect(evidence.elapsedMs).toBe(40);
  } finally { now.mockRestore(); }
});

it("leaves unavailable evidence without an elapsed measurement", async () => {
  const evidence = await analyzeAfterInit(async () => undefined, async () => ({ state: "unavailable" as const, reason: "model-error" as const }));
  expect(evidence).toEqual({ state: "unavailable", reason: "model-error" });
});
