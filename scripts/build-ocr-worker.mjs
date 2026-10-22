/** Bundle the CPU worker and copy pinned offline language assets beside it. */
import { build } from "esbuild";
import { cp, mkdir, readFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { createRequire } from "node:module";
import { resolve, join } from "node:path";
import { fileURLToPath, URL } from "node:url";
import process from "node:process";
import { downloadPinnedAsset } from "./lib/model-download.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const target = resolve(process.argv[2] ?? "packages/evidence/dist");
const require = createRequire(import.meta.url);
await mkdir(join(target, "ocr-data"), { recursive: true });
await build({ entryPoints: [join(root, "packages/evidence/src/ocr-worker.ts")], bundle: true,
  platform: "node", format: "esm", external: ["tesseract.js", "onnxruntime-node", "pngjs"], outfile: join(target, "ocr-worker.mjs") });
for (const code of ["kor", "eng"]) {
  await cp(require.resolve(`@tesseract.js-data/${code}/4.0.0_best_int/${code}.traineddata.gz`),
    join(target, "ocr-data", `${code}.traineddata.gz`));
}
// Weights are a pinned build input. Inspections never fetch models or code.
const modelRoot = join(root, "packages/evidence/src/ocr-models");
const manifest = JSON.parse(await readFile(join(modelRoot, "manifest.json"), "utf8"));
const modelCache = join(root, "packages/evidence/.model-cache");
await mkdir(modelCache, { recursive: true });
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
for (const model of manifest.models) {
  const file = join(modelCache, model.file);
  let bytes;
  try { bytes = await readFile(file); } catch (error) { if (error.code !== "ENOENT") throw error; }
  if (bytes && (bytes.length !== model.bytes || digest(bytes) !== model.sha256)) throw new Error(`Pinned OCR model changed: ${model.file}`);
  if (!bytes) await downloadPinnedAsset(
    { file, url: model.url, bytes: model.bytes, sha256: model.sha256, label: `ocr-data/${model.file}` });
  await cp(file, join(target, "ocr-data", model.file));
}
const vocabulary = await readFile(join(modelRoot, manifest.vocabulary.file));
if (digest(vocabulary) !== manifest.vocabulary.sha256) throw new Error("OCR vocabulary checksum failed");
for (const name of [manifest.vocabulary.file, "manifest.json", "Tesseract-LICENSE.txt", "RapidOCR-LICENSE.txt", "PaddleOCR-LICENSE.txt"]) {
  await cp(join(modelRoot, name), join(target, "ocr-data", name));
}

// The text backbone is ~1 GB. Stream validation/downloads and hardlink
// immutable build assets on the same filesystem instead of duplicating RAM
// and disk for every staging directory. EXDEV falls back to a regular copy.
const { createReadStream } = await import("node:fs");
const { stat, link } = await import("node:fs/promises");
const embeddingRoot = join(root, "packages/evidence/src/text-embedding-model");
const embeddingManifest = JSON.parse(await readFile(join(embeddingRoot, "manifest.json"), "utf8"));
const validatorBundle = await build({ entryPoints: [join(root, "packages/evidence/src/text-reference-data.ts")],
  bundle: true, platform: "node", format: "esm", write: false });
const { validateTextReferences, validateImageReferences } = await import(`data:text/javascript;base64,${Buffer.from(validatorBundle.outputFiles[0].text).toString("base64")}`);
validateTextReferences(JSON.parse(await readFile(join(embeddingRoot, "text-references.json"), "utf8")));
validateImageReferences(JSON.parse(await readFile(join(embeddingRoot, "image-references.json"), "utf8")));
const embeddingCache = join(modelCache, embeddingManifest.model);
const embeddingTarget = join(target, "text-embedding-data");
for (const asset of embeddingManifest.files) {
  const file = join(embeddingCache, asset.path);
  const destination = join(embeddingTarget, asset.path);
  await mkdir(join(file, ".."), { recursive: true });
  await mkdir(join(destination, ".."), { recursive: true });
  const verify = async path => {
    if ((await stat(path)).size !== asset.bytes) throw new Error(`Pinned text model size changed: ${asset.path}`);
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(path)) hash.update(chunk);
    if (hash.digest("hex") !== asset.sha256) throw new Error(`Pinned text model checksum changed: ${asset.path}`);
  };
  try { await verify(file); }
  catch (error) {
    if (error.code !== "ENOENT") throw error;
    await downloadPinnedAsset(
      { file, url: asset.source, bytes: asset.bytes, sha256: asset.sha256, label: `text-embedding-data/${asset.path}` });
  }
  await rm(destination, { force: true });
  try { await link(file, destination); }
  catch (error) { if (error.code !== "EXDEV") throw error; await cp(file, destination); }
}
for (const name of ["manifest.json", "policy.json", "text-references.json", "image-references.json", "LICENSE.txt", "NOTICE.txt"]) {
  await cp(join(embeddingRoot, name), join(embeddingTarget, name));
}
// tsc re-serializes imported JSON into text-embedding-model/ for dist/text-embedding.js.
// Its bytes differ from the source assets, so compare canonical contents and reject a
// stale or foreign copy instead of shipping two different reference files.
const compiledRoot = join(target, "text-embedding-model");
let compiled = true;
try { await stat(compiledRoot); } catch (error) { if (error.code !== "ENOENT") throw error; compiled = false; }
if (compiled) for (const name of ["manifest.json", "policy.json", "image-references.json"]) {
  const built = JSON.parse(await readFile(join(compiledRoot, name), "utf8"));
  const source = JSON.parse(await readFile(join(embeddingRoot, name), "utf8"));
  if (digest(JSON.stringify(built)) !== digest(JSON.stringify(source)))
    throw new Error(`Compiled reference asset diverged from source: text-embedding-model/${name}; rerun tsc`);
}
