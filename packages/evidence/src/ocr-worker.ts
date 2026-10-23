/** Isolated offline CPU OCR. Only candidate bytes enter this worker. */
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createWorker, PSM } from "tesseract.js";
import { createNeuralOcr } from "./neural-ocr.js";
import { createTextEmbedding, type TextEmbeddingEngine } from "./text-embedding.js";
import { analyzeAfterInit } from "./ocr-timing.js";

const embeddingDirectory = new URL("./text-embedding-data/", import.meta.url);
const engine = (async () => {
  const worker = await createWorker("kor+eng", 1, { cacheMethod: "none", gzip: true,
    langPath: fileURLToPath(new URL("./ocr-data", import.meta.url)), errorHandler: () => undefined });
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, user_defined_dpi: "150" });
  return worker;
})();
let neural: ReturnType<typeof createNeuralOcr> | undefined;
let embedding: Promise<TextEmbeddingEngine> | undefined;
// Parent loss must not leave a native inference process behind. Process kill
// avoids unsafe native-addon teardown inside a terminated JS worker thread.
process.on("disconnect", () => process.kill(process.pid, "SIGKILL"));

// One lazily created engine serves every message, so initialization is shared
// rather than repeated. Requests resolve it before their analysis clock starts.
const initializeEmbedding = (): Promise<TextEmbeddingEngine> =>
  (embedding ??= createTextEmbedding(embeddingDirectory));

type Input = { imageBytes: Uint8Array; variant?: "small-banner" | "neural-review" } | { text: string }
  | { visual: { imageBytes: Uint8Array; text: string } } | { warm: true };

process.on("message", async (input: Input) => {
  if ("warm" in input) {
    try {
      // Initialize the same engines the first real request would pay for, so
      // that request is charged only for analysis.
      await engine;
      await initializeEmbedding();
      process.send?.({ warmed: true });
    } catch { process.send?.({ error: "OCR initialization failed" }); }
    return;
  }
  if ("visual" in input) {
    const { imageBytes, text } = input.visual;
    try {
      const evidence = await analyzeAfterInit(initializeEmbedding,
        model => model.analyzeImage(imageBytes, text), model => model.warm());
      process.send?.({ visualEmbedding: evidence });
    } catch { process.send?.({ visualEmbedding: { state: "unavailable", reason: "model-error" } }); }
    return;
  }
  if ("text" in input) {
    try {
      const evidence = await analyzeAfterInit(initializeEmbedding, model => model.analyzeText(input.text));
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
