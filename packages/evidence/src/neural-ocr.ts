/**
 * PP-OCRv5 normalization and CTC decoding adapted from RapidAI/RapidOCR v3.10.0
 * and PaddleOCR (Apache-2.0). Axis-aligned components replace their OpenCV
 * rotated contours; this bounded implementation does not claim rotated-text parity.
 * https://github.com/RapidAI/RapidOCR/tree/v3.10.0/python/rapidocr
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import * as ort from "onnxruntime-node";
import { PNG } from "pngjs";

const MAX_BYTES = 250_000;
const MAX_PIXELS = 4_000_000;
const MAX_DETECTOR_SIDE = 2432;
const MAX_COMPONENTS = 1000;
const MAX_REGIONS = 64;
const MAX_RECOGNIZER_WIDTH = 2048;
const VOCABULARY_SIZE = 11947;
const DEADLINE_MS = 7000;
const DETECTOR_SHA256 = "4d97c44a20d30a81aad087d6a396b08f786c4635742afc391f6621f5c6ae78ae";
const RECOGNIZER_SHA256 = "cd6e2ea50f6943ca7271eb8c56a877a5a90720b7047fe9c41a2e541a25773c9b";
const VOCABULARY_SHA256 = "eff5b03c030036352d8741aae94a0a577d91bc5151e1f0f6857005169b4f07e5";
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

interface Region { x: number; y: number; width: number; height: number }
interface Pixels { width: number; height: number; data: Uint8Array }
interface Recognition { text: string; confidence: number }

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(value, high));
}

function decodePng(bytes: Uint8Array): Pixels {
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (buffer.length < 33 || buffer.length > MAX_BYTES || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)
    || buffer.readUInt32BE(8) !== 13 || buffer.toString("ascii", 12, 16) !== "IHDR") {
    throw new Error("Neural OCR requires a bounded PNG image");
  }
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  // Inspect IHDR before pngjs allocates decompressed pixels.
  if (width < 1 || height < 1 || width * height > MAX_PIXELS) {
    throw new Error("Neural OCR image exceeds pixel bounds");
  }
  let end = 8;
  let complete = false;
  while (end + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(end);
    if (length > buffer.length - end - 12) throw new Error("Neural OCR PNG chunk is truncated");
    const type = buffer.toString("ascii", end + 4, end + 8);
    end += length + 12;
    if (type === "IEND") {
      if (length !== 0) throw new Error("Neural OCR PNG end chunk is invalid");
      complete = true;
      break;
    }
  }
  if (!complete) throw new Error("Neural OCR PNG end chunk is missing");
  // Like the browser, decode the image datastream through IEND. Bounded
  // transport bytes after it stay in source provenance, never in OCR pixels.
  const image = PNG.sync.read(buffer.subarray(0, end), { checkCRC: true });
  if (image.width !== width || image.height !== height || image.data.length !== width * height * 4) {
    throw new Error("Neural OCR PNG dimensions do not match");
  }
  for (let offset = 0; offset < image.data.length; offset += 4) {
    const alpha = image.data[offset + 3] / 255;
    for (let channel = 0; channel < 3; channel++) {
      image.data[offset + channel] = Math.round(image.data[offset + channel] * alpha + 255 * (1 - alpha));
    }
    image.data[offset + 3] = 255;
  }
  return image;
}

/** Bilinear resize of rendered RGB pixels, then the models' BGR/CHW [-1,1] convention. */
function imageTensor(image: Pixels, region: Region, width: number, height: number,
  paddedWidth = width): ort.Tensor {
  const values = new Float32Array(3 * height * paddedWidth);
  const left = new Int32Array(width), right = new Int32Array(width), fractions = new Float64Array(width);
  for (let x = 0; x < width; x++) {
    const sourceX = clamp((x + 0.5) * region.width / width - 0.5, 0, region.width - 1) + region.x;
    left[x] = Math.floor(sourceX); right[x] = Math.min(image.width - 1, left[x] + 1); fractions[x] = sourceX - left[x];
  }
  for (let targetY = 0; targetY < height; targetY++) {
    const sourceY = clamp((targetY + 0.5) * region.height / height - 0.5, 0, region.height - 1) + region.y;
    const y0 = Math.floor(sourceY);
    const y1 = Math.min(image.height - 1, y0 + 1);
    const fractionY = sourceY - y0;
    for (let targetX = 0; targetX < width; targetX++) {
      const x0 = left[targetX];
      const x1 = right[targetX];
      const fractionX = fractions[targetX];
      for (let channel = 0; channel < 3; channel++) {
        const sourceChannel = 2 - channel;
        const topLeft = image.data[(y0 * image.width + x0) * 4 + sourceChannel];
        const topRight = image.data[(y0 * image.width + x1) * 4 + sourceChannel];
        const bottomLeft = image.data[(y1 * image.width + x0) * 4 + sourceChannel];
        const bottomRight = image.data[(y1 * image.width + x1) * 4 + sourceChannel];
        const top = topLeft * (1 - fractionX) + topRight * fractionX;
        const bottom = bottomLeft * (1 - fractionX) + bottomRight * fractionX;
        const pixel = Math.round(top * (1 - fractionY) + bottom * fractionY);
        values[channel * height * paddedWidth + targetY * paddedWidth + targetX] = pixel / 127.5 - 1;
      }
    }
  }
  return new ort.Tensor("float32", values, [1, 3, height, paddedWidth]);
}

function probabilities(output: ort.Tensor | undefined, dimensions: readonly number[]): Float32Array {
  if (!output || output.type !== "float32" || !(output.data instanceof Float32Array)
    || output.dims.length !== dimensions.length || output.dims.some((value, index) => value !== dimensions[index])
    || output.data.length !== dimensions.reduce((product, value) => product * value, 1)) {
    throw new Error("Neural OCR model output has unexpected dimensions");
  }
  return output.data;
}

function checkProbability(value: number): void {
  // Native float32 softmax can overshoot 1 by one ULP on real banner pixels.
  // The bounded comparisons reject NaN and infinities as well.
  if (!(value >= -1e-6 && value <= 1 + 1e-6)) throw new Error("Neural OCR model output is invalid");
}

function textRegions(data: Float32Array, width: number, height: number, image: Pixels,
  checkDeadline: () => void): Region[] {
  const pixels = width * height;
  const mask = new Uint8Array(pixels);
  const seen = new Uint8Array(pixels);
  const queue = new Int32Array(pixels);
  const regions: Region[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const position = y * width + x;
      checkProbability(data[position]);
      if (data[position] <= 0.3) continue;
      mask[position] = 1;
      if (x + 1 < width) mask[position + 1] = 1;
      if (y + 1 < height) {
        mask[position + width] = 1;
        if (x + 1 < width) mask[position + width + 1] = 1;
      }
    }
  }
  let componentCount = 0;
  for (let position = 0; position < pixels; position++) {
    if (!mask[position] || seen[position]) continue;
    checkDeadline();
    if (++componentCount > MAX_COMPONENTS) break;
    let head = 0;
    let tail = 1;
    let minX = position % width;
    let maxX = minX;
    let minY = Math.floor(position / width);
    let maxY = minY;
    queue[0] = position;
    seen[position] = 1;
    while (head < tail) {
      if (head % 65536 === 0) checkDeadline();
      const current = queue[head++];
      const x = current % width;
      const y = Math.floor(current / width);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      for (let deltaY = -1; deltaY <= 1; deltaY++) {
        for (let deltaX = -1; deltaX <= 1; deltaX++) {
          const nextX = x + deltaX;
          const nextY = y + deltaY;
          if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
          const next = nextY * width + nextX;
          if (mask[next] && !seen[next]) { seen[next] = 1; queue[tail++] = next; }
        }
      }
    }
    const boxWidth = maxX - minX + 1;
    const boxHeight = maxY - minY + 1;
    if (Math.min(boxWidth, boxHeight) < 3) continue;
    let score = 0;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) score += data[y * width + x];
    }
    if (score / (boxWidth * boxHeight) < 0.5) continue;
    const expansion = boxWidth * boxHeight * 1.6 / (2 * (boxWidth + boxHeight));
    const left = clamp(Math.round((minX - expansion) / width * image.width), 0, image.width - 1);
    const right = clamp(Math.round((maxX + expansion) / width * image.width), 0, image.width - 1);
    const top = clamp(Math.round((minY - expansion) / height * image.height), 0, image.height - 1);
    const bottom = clamp(Math.round((maxY + expansion) / height * image.height), 0, image.height - 1);
    if (right - left > 3 && bottom - top > 3) {
      regions.push({ x: left, y: top, width: right - left, height: bottom - top });
    }
  }
  return regions.sort((a, b) => a.y - b.y || a.x - b.x).slice(0, MAX_REGIONS);
}

export function decodeText(data: Float32Array, steps: number, vocabulary: readonly string[]): Recognition {
  let previous = -1;
  let text = "";
  let confidence = 0;
  let characters = 0;
  for (let step = 0; step < steps; step++) {
    const offset = step * vocabulary.length;
    let best = 0;
    let probability = data[offset];
    checkProbability(probability);
    for (let index = 1; index < vocabulary.length; index++) {
      const value = data[offset + index];
      checkProbability(value);
      if (value > probability) { best = index; probability = value; }
    }
    if (best !== 0 && best !== previous) {
      text += vocabulary[best]; confidence += clamp(probability, 0, 1); characters++;
    }
    previous = best;
  }
  return { text, confidence: confidence / (characters || 1) };
}

async function verifiedModel(directory: URL, name: string, sha256: string): Promise<Uint8Array> {
  const bytes = await readFile(new URL(name, directory));
  if (createHash("sha256").update(bytes).digest("hex") !== sha256) throw new Error("Neural OCR model integrity failed");
  return bytes;
}

async function verifiedVocabulary(directory: URL): Promise<string[]> {
  const vocabulary: unknown = JSON.parse(await readFile(new URL("korean-vocabulary.json", directory), "utf8"));
  if (!Array.isArray(vocabulary) || vocabulary.length !== VOCABULARY_SIZE
    || vocabulary.some((value) => typeof value !== "string" || value.length < 1 || value.length > 16)
    || createHash("sha256").update(JSON.stringify(vocabulary)).digest("hex") !== VOCABULARY_SHA256) {
    throw new Error("Neural OCR vocabulary integrity failed");
  }
  return vocabulary;
}

export async function createNeuralOcr(modelDirectory: URL): Promise<{
  recognize(bytes: Uint8Array, maximumUpscale?: number): Promise<Recognition>;
  close(): Promise<void>;
}> {
  if (modelDirectory.protocol !== "file:" || !modelDirectory.pathname.endsWith("/")) {
    throw new Error("Neural OCR requires a local model directory");
  }
  const [detectorBytes, recognizerBytes, vocabulary] = await Promise.all([
    verifiedModel(modelDirectory, "ch_PP-OCRv5_det_mobile.onnx", DETECTOR_SHA256),
    verifiedModel(modelDirectory, "korean_PP-OCRv5_rec_mobile.onnx", RECOGNIZER_SHA256),
    verifiedVocabulary(modelDirectory),
  ]);
  const options: ort.InferenceSession.SessionOptions = {
    executionProviders: ["cpu"], intraOpNumThreads: 1, interOpNumThreads: 1,
    executionMode: "sequential", graphOptimizationLevel: "all", enableCpuMemArena: false, logSeverityLevel: 3,
  };
  const detector = await ort.InferenceSession.create(detectorBytes, options);
  let recognizer: ort.InferenceSession;
  try { recognizer = await ort.InferenceSession.create(recognizerBytes, options); }
  catch (error) { await detector.release(); throw error; }
  let closed = false;
  let queue: Promise<unknown> = Promise.resolve();
  let closing: Promise<void> | undefined;

  async function recognize(bytes: Uint8Array, queuedAt: number, maximumUpscale: number): Promise<Recognition> {
    const checkDeadline = (): void => {
      if (closed) throw new Error("Neural OCR engine closed");
      if (performance.now() - queuedAt >= DEADLINE_MS) throw new Error("Neural OCR budget exhausted");
    };
    checkDeadline();
    const image = decodePng(bytes);
    let ratio = Math.min(maximumUpscale, Math.max(1, 736 / Math.min(image.width, image.height)));
    ratio = Math.min(ratio, MAX_DETECTOR_SIDE / Math.max(image.width, image.height));
    const width = Math.max(32, Math.round(image.width * ratio / 32) * 32);
    const height = Math.max(32, Math.round(image.height * ratio / 32) * 32);
    const wholeImage = { x: 0, y: 0, width: image.width, height: image.height };
    const input = imageTensor(image, wholeImage, width, height);
    let detected: Record<string, ort.Tensor> | undefined;
    let regions: Region[];
    try {
      checkDeadline();
      detected = await detector.run({ [detector.inputNames[0]]: input });
      checkDeadline();
      const map = probabilities(detected[detector.outputNames[0]], [1, 1, height, width]);
      regions = textRegions(map, width, height, image, checkDeadline);
    } finally { input.dispose(); if (detected) Object.values(detected).forEach(tensor => tensor.dispose()); }
    const lines: Recognition[] = [];
    for (const region of regions) {
      checkDeadline();
      const resizedWidth = Math.ceil(48 * region.width / region.height);
      const paddedWidth = Math.max(320, resizedWidth);
      if (paddedWidth > MAX_RECOGNIZER_WIDTH) continue;
      const lineInput = imageTensor(image, region, resizedWidth, 48, paddedWidth);
      let recognized: Record<string, ort.Tensor> | undefined;
      try {
        recognized = await recognizer.run({ [recognizer.inputNames[0]]: lineInput });
        checkDeadline();
        const output = recognized[recognizer.outputNames[0]];
        const steps = output?.dims[1];
        if (!Number.isInteger(steps) || steps < 1 || steps > MAX_RECOGNIZER_WIDTH / 4) throw new Error("Neural OCR recognition exceeds output bounds");
        const data = probabilities(output, [1, steps, VOCABULARY_SIZE]);
        const line = decodeText(data, steps, vocabulary);
        if (line.text && line.confidence >= 0.5) lines.push(line);
      } finally { lineInput.dispose(); if (recognized) Object.values(recognized).forEach(tensor => tensor.dispose()); }
    }
    checkDeadline();
    return { text: lines.map((line) => line.text).join("\n"),
      confidence: lines.reduce((sum, line) => sum + line.confidence, 0) / (lines.length || 1) };
  }

  return {
    recognize(bytes, maximumUpscale = Number.POSITIVE_INFINITY) {
      if (closed) return Promise.reject(new Error("Neural OCR engine closed"));
      if (bytes.length > MAX_BYTES) return Promise.reject(new Error("Neural OCR image exceeds byte bounds"));
      const queuedAt = performance.now();
      const snapshot = Uint8Array.from(bytes);
      const result = queue.then(() => recognize(snapshot, queuedAt, maximumUpscale));
      queue = result.catch(() => undefined);
      return result;
    },
    close() {
      closed = true;
      closing ??= queue.then(async () => {
        await Promise.all([detector.release(), recognizer.release()]);
      });
      return closing;
    },
  };
}
