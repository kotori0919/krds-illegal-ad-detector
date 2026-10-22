import { createHash } from "node:crypto";
import policy from "./text-embedding-model/policy.json" with { type: "json" };
import manifest from "./text-embedding-model/manifest.json" with { type: "json" };

export interface TextReferenceData {
  format: "text-references-v1";
  policySha256: string;
  manifestSha256: string;
  vectorsSha256: string;
  dimensions: 768;
  batchSize: 4;
  references: { kind: "positive" | "negative"; prompt: string; vector: number[] }[];
}

export const referenceDigest = (value: unknown): string => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function validateTextReferences(value: unknown): asserts value is TextReferenceData {
  const data = value as TextReferenceData | null;
  const prompts = [...policy.positivePrompts, ...policy.negativePrompts];
  if (!data || data.format !== "text-references-v1" || data.dimensions !== 768 || data.batchSize !== 4
    || data.policySha256 !== referenceDigest(policy) || data.manifestSha256 !== referenceDigest(manifest)
    || !Array.isArray(data.references) || data.references.length !== prompts.length
    || data.vectorsSha256 !== referenceDigest(data.references)
    || data.references.some((row, index) => !row || row.prompt !== prompts[index]
      || row.kind !== (index < policy.positivePrompts.length ? "positive" : "negative")
      || !Array.isArray(row.vector) || row.vector.length !== 768
      || row.vector.some(value => !Number.isFinite(value)) || Math.abs(Math.hypot(...row.vector) - 1) > 1e-5)) {
    throw new Error("Text reference integrity failed; regenerate with the pinned model and policy");
  }
}

export interface ImageReferenceData {
  policy: string;
  revision: string;
  seed: number;
  threshold: number;
  manifestSha256: string;
  referencesSha256: string;
  references: {
    id: string; kind: string; sourceFile: string; sourceSha256: string;
    modelInputFile: string; modelInputSha256: string; transform: string; shuffled: boolean; vector: number[];
  }[];
}

export function validateImageReferences(value: unknown): asserts value is ImageReferenceData {
  const data = value as ImageReferenceData | null;
  if (!data || data.policy !== "image-ad-embedding-v3" || data.revision !== manifest.revision
    || data.seed !== 1701 || data.threshold !== 0 || data.manifestSha256 !== referenceDigest(manifest)
    || !Array.isArray(data.references) || data.references.length !== 52
    || data.references.filter(row => row.kind === "positive").length !== 15
    || data.referencesSha256 !== referenceDigest(data.references)
    || data.references.some(row => !row || !["positive", "negative"].includes(row.kind)
      || !/^[a-f0-9]{64}$/.test(row.sourceSha256) || !/^[a-f0-9]{64}$/.test(row.modelInputSha256)
      || typeof row.shuffled !== "boolean" || (row.shuffled && row.kind !== "negative")
      || !Array.isArray(row.vector) || row.vector.length !== 768
      || row.vector.some(value => !Number.isFinite(value)) || Math.abs(Math.hypot(...row.vector) - 1) > 1e-5)) {
    throw new Error("Image reference integrity failed; regenerate with the pinned model and pixels");
  }
}
