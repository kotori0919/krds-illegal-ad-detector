import { createHash } from "node:crypto";
import { preprocessPng } from "./image-preprocess.js";
import { readFile } from "node:fs/promises";
import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";
import * as ort from "onnxruntime-node";
import { Tokenizer } from "@huggingface/tokenizers";
import type { TextEmbeddingEvidence, VisualEmbeddingEvidence } from "@krds-detector/contracts";
import policy from "./text-embedding-model/policy.json" with { type: "json" };
import manifest from "./text-embedding-model/manifest.json" with { type: "json" };
import { referenceDigest, validateTextReferences, validateImageReferences, type ImageReferenceData, type TextReferenceData } from "./text-reference-data.js";
import imagePolicy from "./text-embedding-model/image-references.json" with { type: "json" };

async function createEncoder(directory: URL) {
  const config = JSON.parse(await readFile(new URL("tokenizer_config.json", directory), "utf8"));
  const tokenizer = new Tokenizer(JSON.parse(await readFile(new URL("tokenizer.json", directory), "utf8")), config);
  const session = await ort.InferenceSession.create(fileURLToPath(new URL("onnx/model.onnx", directory)),
    { executionProviders: ["cpu"], intraOpNumThreads: 2, interOpNumThreads: 1 });
  const encode = async (texts: string[], image?: { features: ort.Tensor; count: number }): Promise<number[][]> => {
    const rows = texts.map(text => tokenizer.encode(policy.prefix + text + (image ? "\n" + config.boi_token + config.image_token.repeat(image.count) + config.eoi_token : "")).ids);
    if (rows.some(row => row.length > (image ? 544 : policy.maxTokens))) throw new Error("embedding input exceeds token bound");
    if (image) {
      const row = rows[0]!;
      const boi = row.indexOf(255999), eoi = row.indexOf(258882);
      if (rows.length !== 1 || boi < 0 || eoi !== boi + image.count + 1 || eoi !== row.length - 2
        || row.filter(id => id === 255999).length !== 1 || row.filter(id => id === 258882).length !== 1
        || row.filter(id => id === 258880).length !== image.count || !row.slice(boi + 1, eoi).every(id => id === 258880)
        || image.features.dims[0] !== image.count || image.features.dims[1] !== 512) throw new Error("image token contract invalid");
    }
    const width = Math.max(...rows.map(row => row.length));
    const ids = new BigInt64Array(rows.length * width), mask = new BigInt64Array(ids.length);
    rows.forEach((row, batch) => row.forEach((id, index) => {
      ids[batch * width + index] = BigInt(id); mask[batch * width + index] = 1n;
    }));
    const feeds: Record<string, ort.Tensor> = {
      input_ids: new ort.Tensor("int64", ids, [rows.length, width]),
      attention_mask: new ort.Tensor("int64", mask, [rows.length, width]),
    };
    for (const name of ["image_features", "video_features", "audio_features"]) {
      feeds[name] = name === "image_features" && image ? image.features : new ort.Tensor("float32", new Float32Array(0), [0, 512]);
    }
    const output = await session.run(feeds, ["sentence_embedding"]);
    try {
      const values = output.sentence_embedding!.data as Float32Array;
      if (values.length !== rows.length * 768) throw new Error("invalid embedding dimensions");
      return rows.map((_, batch) => {
        const vector = Array.from(values.slice(batch * 768, (batch + 1) * 768));
        const norm = Math.hypot(...vector);
        if (!Number.isFinite(norm) || norm < 1e-8) throw new Error("invalid embedding values");
        return vector.map(value => value / norm);
      });
    } finally {
      Object.values(output).forEach(tensor => tensor.dispose());
      Object.entries(feeds).filter(([name]) => name !== "image_features" || !image).forEach(([, tensor]) => tensor.dispose());
    }
  };
  return { tokenizer, encode, close: () => session.release() };
}

/** Explicit build preparation; identical four-prompt batches to the former scan path. */
export async function generateTextReferences(directory: URL): Promise<TextReferenceData> {
  const encoder = await createEncoder(directory);
  try {
    const vectors: number[][] = [];
    const prompts = [...policy.positivePrompts, ...policy.negativePrompts];
    for (let index = 0; index < prompts.length; index += 4) vectors.push(...await encoder.encode(prompts.slice(index, index + 4)));
    const references = prompts.map((prompt, index) => ({ prompt,
      kind: index < policy.positivePrompts.length ? "positive" as const : "negative" as const, vector: vectors[index]! }));
    const data: TextReferenceData = { format: "text-references-v1", dimensions: 768, batchSize: 4,
      policySha256: referenceDigest(policy), manifestSha256: referenceDigest(manifest), vectorsSha256: referenceDigest(references), references };
    validateTextReferences(data);
    return data;
  } finally { await encoder.close(); }
}

/** Build-only regeneration from the same frozen exemplar pixels and shuffle controls. */
export async function generateImageReferences(directory: URL, templates: ImageReferenceData): Promise<ImageReferenceData> {
  const encoder = await createEncoder(directory);
  let vision: ort.InferenceSession | undefined;
  try {
    vision = await ort.InferenceSession.create(fileURLToPath(new URL("onnx/vision_encoder_quantized.onnx", directory)),
      { executionProviders: ["cpu"], intraOpNumThreads: 2, interOpNumThreads: 1 });
    const references = [];
    for (const template of templates.references) {
      const source = await readFile(template.sourceFile);
      const bytes = await readFile(template.modelInputFile);
      if (createHash("sha256").update(source).digest("hex") !== template.sourceSha256
        || createHash("sha256").update(bytes).digest("hex") !== template.modelInputSha256) throw new Error("Image reference source changed");
      const prepared = preprocessPng(bytes, template.shuffled);
      const pixel = new ort.Tensor("float32", prepared.pixelValues, [1,2520,768]);
      const positions = new ort.Tensor("int64", prepared.positions, [1,2520,2]);
      let output: Record<string, ort.Tensor> | undefined;
      try {
        output = await vision.run({ pixel_values: pixel, pixel_position_ids: positions });
        const [vector] = await encoder.encode([""], { features: output.image_features!, count: prepared.softTokens });
        references.push({ ...template, vector: vector! });
      } finally { pixel.dispose(); positions.dispose(); if (output) Object.values(output).forEach(tensor => tensor.dispose()); }
    }
    const data = { ...templates, manifestSha256: referenceDigest(manifest), referencesSha256: referenceDigest(references), references };
    validateImageReferences(data);
    return data;
  } finally { await vision?.release(); await encoder.close(); }
}

async function loadTextReferences(directory: URL): Promise<number[][]> {
  const data: unknown = JSON.parse(await readFile(new URL("text-references.json", directory), "utf8"));
  validateTextReferences(data);
  return data.references.map(row => row.vector);
}

/** Shared CPU embedding engine. `warm` pays lazy session creation up front. */
export interface TextEmbeddingEngine {
  analyzeText(text: string): Promise<TextEmbeddingEvidence>;
  analyzeImage(bytes: Uint8Array, text: string): Promise<VisualEmbeddingEvidence>;
  warm(): Promise<void>;
}

/** Runs only inside the killable OCR child; assets are pinned at build time. */
export async function createTextEmbedding(directory: URL): Promise<TextEmbeddingEngine> {
  const references = await loadTextReferences(directory);
  const { tokenizer, encode } = await createEncoder(directory);
  const classify = (vector: number[], positives = references.slice(0, policy.positivePrompts.length), negatives = references.slice(policy.positivePrompts.length)) => {
    const similarity = (reference: number[]) => Math.max(-1, Math.min(1, reference.reduce((sum, value, index) => sum + value * vector[index]!, 0)));
    const positiveSimilarity = Math.max(...positives.map(similarity));
    const negativeSimilarity = Math.max(...negatives.map(similarity));
    return { positiveSimilarity, negativeSimilarity, margin: positiveSimilarity - negativeSimilarity };
  };
  const analyzeText = async (text: string): Promise<TextEmbeddingEvidence> => {
    // Reserved modality syntax would address absent media features in the graph.
    // Reject the evidence rather than rewriting the observed OCR text.
    if (!text.trim() || text.length > policy.maxCharacters || /<\|/.test(text)
      || tokenizer.encode(policy.prefix + text).ids.length > policy.maxTokens) return { state: "unavailable", reason: "invalid-input" };
    const [vector] = await encode([text]);
    const { positiveSimilarity, negativeSimilarity, margin } = classify(vector!);
    return { state: "available", policy: "text-ad-embedding-v3", model: "embeddinggemma-2-text-f32",
      revision: "daa72c51243991dfcaf9f9137d2c573d8f7790c0", positiveSimilarity, negativeSimilarity,
      margin, threshold: 0, passed: margin >= policy.threshold, elapsedMs: 0 };
  };
  let vision: Promise<ort.InferenceSession> | undefined;
  let imageReferences: { positives: number[][]; negatives: number[][] } | undefined;
  // Session creation is initialization, not analysis. Callers may therefore
  // pay it before their own bounded analysis clock starts.
  const visionSession = async (): Promise<ort.InferenceSession> => {
    vision ??= ort.InferenceSession.create(fileURLToPath(new URL("onnx/vision_encoder_quantized.onnx", directory)), { executionProviders: ["cpu"], intraOpNumThreads: Math.min(6, availableParallelism()), interOpNumThreads: 1 });
    return vision;
  };
  const analyzeImage = async (bytes: Uint8Array, text: string): Promise<VisualEmbeddingEvidence> => {
    const rawIds = tokenizer.encode(policy.prefix + text).ids;
    if (text.length > 4096 || /<\|/.test(text) || rawIds.length > 256 || rawIds.some(id => [255999,258880,258882,256000,258881,258883,258884].includes(id))) return { state: "unavailable", reason: "invalid-input" };
    // This path is for the bounded small PNGs whose OCR lost context. It is
    // separate from text review, so numeric OCR is never presented as words.
    const source = Buffer.from(bytes);
    if (source.length < 33 || source.length > 250000 || !source.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || source.readUInt32BE(20) > 96 || source.readUInt32BE(16) < source.readUInt32BE(20) * 3) return { state: "unavailable", reason: "invalid-input" };
    const engine = await visionSession();
    if (!imageReferences) {
      validateImageReferences(imagePolicy);
      imageReferences = { positives: imagePolicy.references.filter(reference => reference.kind === "positive").map(reference => reference.vector),
        negatives: imagePolicy.references.filter(reference => reference.kind === "negative").map(reference => reference.vector) };
      if (!imageReferences.positives.length || !imageReferences.negatives.length) throw new Error("image reference classes missing");
    }
    const scores = [];
    for (const shuffled of [false, true]) {
      const prepared = preprocessPng(source, shuffled);
      // Keep every real 16px patch; omit only the trailing -1-position padding.
      const patches = prepared.softTokens * 9;
      const pixel = new ort.Tensor("float32", prepared.pixelValues.subarray(0, patches * 768), [1,patches,768]);
      const positions = new ort.Tensor("int64", prepared.positions.subarray(0, patches * 2), [1,patches,2]);
      let output: Record<string, ort.Tensor> | undefined;
      try {
        output = await engine.run({ pixel_values: pixel, pixel_position_ids: positions });
        // Compare image-only queries with image-only exemplars. The actual OCR
        // remains separate evidence and cannot supply guessed missing words.
        const [vector] = await encode([""], { features: output.image_features!, count: prepared.softTokens });
        scores.push(classify(vector!, imageReferences.positives, imageReferences.negatives));
      } finally { pixel.dispose(); positions.dispose(); if (output) Object.values(output).forEach(tensor => tensor.dispose()); }
    }
    const real = scores[0]!, shuffled = scores[1]!;
    return { state: "available", policy: "image-ad-embedding-v3", model: "embeddinggemma-2-image-text-f32-vision-int8", revision: "daa72c51243991dfcaf9f9137d2c573d8f7790c0",
      imageSha256: createHash("sha256").update(source).digest("hex"), ...real,
      shuffledPositiveSimilarity: shuffled.positiveSimilarity, shuffledNegativeSimilarity: shuffled.negativeSimilarity, shuffledMargin: shuffled.margin,
      threshold: 0, control: "pixel-shuffle-v1", seed: 1701, passed: real.margin >= 0 && shuffled.margin < 0, elapsedMs: 0 };
  };
  return { analyzeText, analyzeImage, warm: async (): Promise<void> => { await visionSession(); } };
}
