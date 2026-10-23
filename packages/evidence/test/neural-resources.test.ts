import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as ort from "onnxruntime-node";
import { expect, it, vi } from "vitest";
import { createNeuralOcr } from "../src/neural-ocr.js";

it("releases tensors after invalid native probabilities and recovers the queued engine", async () => {
  const tensors: ort.Tensor[] = [];
  let corrupt = true;
  const release = vi.fn(async () => {});
  // A corrupt native output cannot be induced with the pinned valid model;
  // retain its real tensor ownership behavior while replacing inference only.
  const create = vi.spyOn(ort.InferenceSession, "create").mockImplementation(async () => ({
    inputNames: ["x"], outputNames: ["map"], release,
    async run(feeds: Record<string, ort.Tensor>) {
      const input = feeds.x!;
      const height = input.dims[2]!, width = input.dims[3]!;
      const data = new Float32Array(height * width);
      if (corrupt) data[data.length - 1] = Number.NaN;
      const map = new ort.Tensor("float32", data, [1,1,height,width]);
      tensors.push(input,map);
      return {map};
    },
  }) as unknown as ort.InferenceSession);
  let engine: Awaited<ReturnType<typeof createNeuralOcr>> | undefined;
  try {
    engine = await createNeuralOcr(pathToFileURL(`${resolve("packages/evidence/dist/ocr-data")}/`));
    const bytes = await readFile("fixtures/real-banners/mt-888asia.png");
    await expect(engine.recognize(bytes,1)).rejects.toThrow("Neural OCR model output is invalid");
    expect(tensors).toHaveLength(2);
    for (const tensor of tensors) expect(() => tensor.data).toThrow("The tensor is disposed.");
    corrupt = false;
    expect(await engine.recognize(bytes,1)).toEqual({text:"",confidence:0});
    expect(tensors).toHaveLength(4);
    for (const tensor of tensors) expect(() => tensor.data).toThrow("The tensor is disposed.");
    await engine.close();
    expect(release).toHaveBeenCalledTimes(2);
  } finally { await engine?.close(); create.mockRestore(); }
});

it("ships a license with every redistributed OCR and embedding asset category", async () => {
  const categories = [
    { directory: "packages/evidence/dist/ocr-data", source: "packages/evidence/src/ocr-models",
      assets: ["ch_PP-OCRv5_det_mobile.onnx", "korean_PP-OCRv5_rec_mobile.onnx"],
      licenses: ["PaddleOCR-LICENSE.txt", "RapidOCR-LICENSE.txt"] },
    { directory: "packages/evidence/dist/ocr-data", source: "packages/evidence/src/ocr-models",
      assets: ["kor.traineddata.gz", "eng.traineddata.gz"], licenses: ["Tesseract-LICENSE.txt"] },
    { directory: "packages/evidence/dist/text-embedding-data", source: "packages/evidence/src/text-embedding-model",
      assets: ["onnx/model.onnx", "onnx/model.onnx_data", "onnx/vision_encoder_quantized.onnx", "tokenizer.json"],
      licenses: ["LICENSE.txt", "NOTICE.txt"] },
  ];
  for (const { directory, source, assets, licenses } of categories) {
    for (const asset of assets) expect((await stat(resolve(directory, asset))).size).toBeGreaterThan(0);
    for (const license of licenses) {
      const shipped = await readFile(resolve(directory, license), "utf8");
      expect(shipped).toBe(await readFile(resolve(source, license), "utf8"));
      expect(shipped).toContain("Apache License");
    }
  }
});
