/** Isolated offline CPU OCR. Only candidate bytes enter this worker. */
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createWorker, PSM } from "tesseract.js";
import { createNeuralOcr } from "./neural-ocr.js";
import { createTextEmbedding } from "./text-embedding.js";

const engine = (async () => {
  const worker = await createWorker("kor+eng", 1, { cacheMethod: "none", gzip: true,
    langPath: fileURLToPath(new URL("./ocr-data", import.meta.url)), errorHandler: () => undefined });
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, user_defined_dpi: "150" });
  return worker;
})();
let neural: ReturnType<typeof createNeuralOcr> | undefined;
let embedding: ReturnType<typeof createTextEmbedding> | undefined;
// Parent loss must not leave a native inference process behind. Process kill
// avoids unsafe native-addon teardown inside a terminated JS worker thread.
process.on("disconnect", () => process.kill(process.pid, "SIGKILL"));

process.on("message", async (input: { imageBytes: Uint8Array; variant?: "small-banner" | "neural-review" } | { text: string } | { visual: { imageBytes: Uint8Array; text: string } }) => {
  if ("visual" in input) {
    const started = performance.now();
    try {
      embedding ??= createTextEmbedding(new URL("./text-embedding-data/", import.meta.url));
      const evidence = await (await embedding).analyzeImage(input.visual.imageBytes, input.visual.text);
      if (evidence.state === "available") evidence.elapsedMs = performance.now() - started;
      process.send?.({ visualEmbedding: evidence });
    } catch { process.send?.({ visualEmbedding: { state: "unavailable", reason: "model-error" } }); }
    return;
  }
  if ("text" in input) {
    const started = performance.now();
    try {
      embedding ??= createTextEmbedding(new URL("./text-embedding-data/", import.meta.url));
      const evidence = await (await embedding).analyzeText(input.text);
      if (evidence.state === "available") evidence.elapsedMs = performance.now() - started;
      process.send?.({ embedding: evidence });
    } catch { process.send?.({ embedding: { state: "unavailable", reason: "model-error" } }); }
    return;
  }
  try {
    const worker = await engine;
    const bytes = Buffer.from(input.imageBytes);
    if (input.variant === "small-banner" || input.variant === "neural-review") {
      neural ??= createNeuralOcr(new URL("./ocr-data/", import.meta.url));
      const result = await (await neural).recognize(bytes, input.variant === "small-banner" ? 4 : undefined);
      process.send?.({ ...result, backend: input.variant === "small-banner" ? "ppocrv5-korean-mobile-4x-cpu-v2" : "ppocrv5-korean-mobile-cpu-v1" });
      return;
    }
    const { data } = await worker.recognize(bytes);
    if (data.confidence < 70 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
      neural ??= createNeuralOcr(new URL("./ocr-data/", import.meta.url));
      const result = await (await neural).recognize(bytes);
      process.send?.({ ...result, backend: "ppocrv5-korean-mobile-cpu-v1" });
    } else process.send?.({ text: data.text, confidence: data.confidence / 100, backend: "tesseract-cpu-kor-eng-v7" });
  } catch {
    process.send?.({ error: "OCR recognition failed" });
  }
});
// Startup failures are delivered on the same message channel, never as an
// unhandled promise that could crash the official scanner.
void engine.catch(() => process.send?.({ error: "OCR initialization failed" }));
