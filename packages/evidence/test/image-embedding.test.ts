import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { LocalOcrBackend } from "../dist/ocr.js";
import references from "../src/text-embedding-model/image-references.json" with { type: "json" };

it("distinguishes unreadable gambling banners from retail pixels without using the supplied transcript", async () => {
  const engine = new LocalOcrBackend();
  // The production defaults (8 s text, 16 s image) reserve time for one
  // inference over already-loaded models. Here the first calls also load a
  // 1.2 GiB ONNX encoder plus the vision session from disk, and this file
  // shares a 4-vCPU runner with another Vitest worker. Use an explicit,
  // generous budget for the verdict calls; the deliberate 10 ms budget and
  // the abort below keep asserting the production failure semantics.
  const verdictBudgetMs = 60_000;
  try {
    await engine.analyzeText("광고 문자 의미 비교", verdictBudgetMs);
    for (const [file, passed] of [["kci-smile.png", true], ["kci-boutique.png", true], ["lg-tv-reduced.png", false]] as const) {
      const imageBytes = await readFile(`fixtures/real-banners/${file}`);
      const sha = createHash("sha256").update(imageBytes).digest("hex");
      expect(references.references.some(row => row.sourceSha256 === sha || row.modelInputSha256 === sha)).toBe(false);
      const crop = { sourceId: file, imageBytes, width: imageBytes.readUInt32BE(16), height: imageBytes.readUInt32BE(20), mediaType: "image/png" };
      const result = await engine.analyzeImage(crop, "", verdictBudgetMs);
      expect(result).toMatchObject({ state: "available", policy: "image-ad-embedding-v3", imageSha256: sha, passed });
      if (result.state === "available") expect(result.shuffledMargin).toBeLessThan(0);
      if (file === "kci-boutique.png") {
        const perturbed = await engine.analyzeImage(crop, "공공안내 또는 카지노라는 임의 문구", verdictBudgetMs);
        expect(perturbed.state).toBe("available");
        if (result.state === "available" && perturbed.state === "available") {
          expect(Math.abs(perturbed.margin - result.margin)).toBeLessThanOrEqual(1e-5);
          expect(Math.abs(perturbed.shuffledMargin - result.shuffledMargin)).toBeLessThanOrEqual(1e-5);
        }
        // Interrupt the warmed native image pool, then let the next normal
        // banner prove that the worker can recover without changing its verdict.
        await expect(engine.analyzeImage(crop, "", 10)).rejects.toThrow("OCR budget exhausted");
      }
    }
    const imageBytes = await readFile("fixtures/real-banners/kci-smile.png");
    const crop = { sourceId: "cancel-image", imageBytes, width: imageBytes.readUInt32BE(16), height: imageBytes.readUInt32BE(20), mediaType: "image/png" };
    const controller = new AbortController();
    const pending = engine.analyzeImage(crop, "", 16000, controller.signal);
    const timer = setTimeout(() => controller.abort(), 200);
    try { await expect(pending).rejects.toThrow("OCR budget exhausted"); }
    finally { clearTimeout(timer); }
    await expect(engine.analyzeImage(crop, "")).rejects.toThrow("OCR engine closed");
  } finally { await engine.close(); }
  // Harness backstop only: the per-call budgets above are the real bound.
  // Model loading happens once per worker, so this leaves room for a cold
  // 1.2 GiB load on a shared 4-vCPU runner without much headroom beyond it.
}, 180_000);
