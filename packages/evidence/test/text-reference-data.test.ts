import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { referenceDigest, validateTextReferences, validateImageReferences } from "../src/text-reference-data.js";
import { LocalOcrBackend } from "../dist/ocr.js";

it("binds fixed text vectors to exact prompts, order, policy and model assets", async () => {
  const data = JSON.parse(await readFile("packages/evidence/src/text-embedding-model/text-references.json", "utf8"));
  expect(() => validateTextReferences(data)).not.toThrow();
  for (const mutate of [
    (row: typeof data) => { row.policySha256 = "0".repeat(64); },
    (row: typeof data) => { row.manifestSha256 = "0".repeat(64); },
    (row: typeof data) => { row.references.reverse(); row.vectorsSha256 = referenceDigest(row.references); },
    (row: typeof data) => { row.references[0].prompt += " altered"; row.vectorsSha256 = referenceDigest(row.references); },
    (row: typeof data) => { row.references[0].vector[0] = 2; row.vectorsSha256 = referenceDigest(row.references); },
    (row: typeof data) => { row.references[0].vector[0] += 0.00001; },
  ]) {
    const changed = structuredClone(data); mutate(changed);
    expect(() => validateTextReferences(changed)).toThrow("Text reference integrity failed");
  }
});

it("keeps actual OCR available when fixed reference data is corrupt", async () => {
  const { cp, mkdir, mkdtemp, rm, symlink, writeFile } = await import("node:fs/promises");
  const { resolve } = await import("node:path");
  const { pathToFileURL } = await import("node:url");
  await mkdir("artifacts", { recursive: true });
  const directory = await mkdtemp(resolve("artifacts/text-reference-corruption-"));
  await cp("packages/evidence/dist/ocr.js", `${directory}/ocr.mjs`);
  await cp("packages/evidence/dist/ocr-diagnostics.js", `${directory}/ocr-diagnostics.js`);
  await cp("packages/evidence/dist/ocr-worker.mjs", `${directory}/ocr-worker.mjs`);
  await symlink(resolve("packages/evidence/dist/ocr-data"), `${directory}/ocr-data`);
  await mkdir(`${directory}/text-embedding-data`);
  await writeFile(`${directory}/text-embedding-data/text-references.json`, "{}");
  const { LocalOcrBackend: IsolatedBackend } = await import(pathToFileURL(`${directory}/ocr.mjs`).href) as { LocalOcrBackend: typeof LocalOcrBackend };
  const engine = new IsolatedBackend();
  try {
    expect(await engine.analyzeText("카지노 첫충100% 입금 보너스")).toEqual({ state: "unavailable", reason: "model-error" });
    const imageBytes = await readFile("fixtures/ocr/banner.png");
    const result = await engine.recognize({ sourceId: "baseline", imageBytes, width: 800, height: 150, mediaType: "image/png" });
    expect(result.text.replace(/\s/g, "")).toContain("카지노가입보너스지급");
    expect(await engine.analyzeText("카지노 첫충100% 입금 보너스")).toEqual({ state: "unavailable", reason: "model-error" });
  } finally { await engine.close(); await rm(directory, { recursive: true, force: true }); }
}, 15000);

it("rejects image references from another precision and altered source/control vectors", async () => {
  const data = JSON.parse(await readFile("packages/evidence/src/text-embedding-model/image-references.json", "utf8"));
  expect(() => validateImageReferences(data)).not.toThrow();
  for (const mutate of [
    (row: typeof data) => { row.manifestSha256 = "0".repeat(64); },
    (row: typeof data) => { row.references[0].modelInputSha256 = "0".repeat(64); },
    (row: typeof data) => { row.references[1].kind = "positive"; row.referencesSha256 = referenceDigest(row.references); },
    (row: typeof data) => { row.references[0].vector[0] = 2; row.referencesSha256 = referenceDigest(row.references); },
  ]) {
    const changed = structuredClone(data); mutate(changed);
    expect(() => validateImageReferences(changed)).toThrow("Image reference integrity failed");
  }
});
