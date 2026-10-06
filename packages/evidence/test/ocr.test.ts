import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { LocalOcrBackend } from "../dist/ocr.js";

it("recognizes Korean advertising text from actual image bytes offline", async () => {
  const engine = new LocalOcrBackend();
  try {
    const result = await engine.recognize({ sourceId: "banner", imageBytes: await readFile("fixtures/ocr/banner.png"),
      width: 800, height: 150, mediaType: "image/png" }, 8000);
    expect(result.text.replace(/\s/g, "")).toContain("카지노가입보너스지급");
    expect(result.confidence).toBeGreaterThan(0.8);
  } finally { await engine.close(); }
}, 12_000);

it("settles cancellation without starting recognition or leaving a worker alive", async () => {
  const engine = new LocalOcrBackend();
  const controller = new AbortController();
  controller.abort();
  try {
    await expect(engine.recognize({ sourceId: "cancelled", imageBytes: new Uint8Array(),
      width: 800, height: 150, mediaType: "image/png" }, 8000, controller.signal)).rejects.toThrow("OCR budget exhausted");
  } finally { await engine.close(); }
});

it("terminates an active OCR worker when cancellation interrupts startup", async () => {
  const engine = new LocalOcrBackend();
  const controller = new AbortController();
  const crop = { sourceId: "active", imageBytes: await readFile("fixtures/ocr/banner.png"),
    width: 800, height: 150, mediaType: "image/png" };
  const pending = engine.recognize(crop, 8000, controller.signal);
  await Promise.resolve();
  controller.abort();
  await expect(pending).rejects.toThrow("OCR budget exhausted");
  await engine.close();
  await expect(engine.recognize(crop)).rejects.toThrow("OCR engine closed");
});
