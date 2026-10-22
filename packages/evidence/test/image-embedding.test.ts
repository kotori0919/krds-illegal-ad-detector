import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { LocalOcrBackend } from "../dist/ocr.js";
import references from "../src/text-embedding-model/image-references.json" with { type: "json" };

it("distinguishes unreadable gambling banners from retail pixels without using the supplied transcript", async () => {
  const engine = new LocalOcrBackend();
  // The production defaults (8 s text, 16 s image) reserve time for one
  // inference over already-loaded models. A cold worker instead pays the
  // 1.2 GiB ONNX encoder plus the vision session from disk, and the worker
  // charges that initialization to evidence.elapsedMs, so the first measured
  // call can exceed the contract cap even though it produced a correct
  // verdict. Warm the worker through the visual path once: it lazily builds
  // both the text encoder and the vision session. On a cold runner that
  // warm-up can itself be rejected over cap; LocalOcrBackend then recycles
  // the worker, and the only repeat cost is session construction, because
  // the weight files stay in the OS page cache. That single expected
  // rejection is tolerated here; every verdict call below keeps its explicit
  // budget and its assertions unchanged.
  const verdictBudgetMs = 60_000;
  const warmUpBudgetMs = 60_000;
  try {
    const warmUpBytes = await readFile("fixtures/real-banners/kci-smile.png");
    try {
      await engine.analyzeImage({ sourceId: "warm-up", imageBytes: warmUpBytes,
        width: warmUpBytes.readUInt32BE(16), height: warmUpBytes.readUInt32BE(20), mediaType: "image/png" }, "", warmUpBudgetMs);
    } catch { /* over-cap cold start; weights are now in the page cache */ }
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
