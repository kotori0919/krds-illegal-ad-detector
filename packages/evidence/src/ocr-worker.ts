/** Isolated offline CPU OCR. Only candidate bytes enter this worker. */
import { parentPort } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { createWorker, PSM } from "tesseract.js";

const engine = (async () => {
  const worker = await createWorker("kor+eng", 1, { cacheMethod: "none", gzip: true,
    langPath: fileURLToPath(new URL("./ocr-data", import.meta.url)), errorHandler: () => undefined });
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, user_defined_dpi: "150" });
  return worker;
})();

parentPort?.on("message", async (input: { imageBytes: Uint8Array }) => {
  try {
    const worker = await engine;
    const { data } = await worker.recognize(Buffer.from(input.imageBytes));
    parentPort?.postMessage({ text: data.text, confidence: data.confidence / 100 });
  } catch {
    parentPort?.postMessage({ error: "OCR recognition failed" });
  }
});
// Startup failures are delivered on the same message channel, never as an
// unhandled promise that could crash the official scanner.
void engine.catch(() => parentPort?.postMessage({ error: "OCR initialization failed" }));
