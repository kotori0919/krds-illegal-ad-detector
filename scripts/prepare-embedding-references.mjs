/** Regenerate fixed prompt vectors only when the pinned policy/model changes. */
import { build } from "esbuild";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import console from "node:console";
import process from "node:process";

const source = "packages/evidence/src/text-embedding-model";
const manifest = JSON.parse(await readFile(`${source}/manifest.json`, "utf8"));
const directory = resolve("packages/evidence/.model-cache", manifest.model);
for (const file of manifest.files) {
  const path = `${directory}/${file.path}`;
  if ((await stat(path)).size !== file.bytes) throw new Error(`Pinned model size mismatch: ${file.path}`);
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  if (hash.digest("hex") !== file.sha256) throw new Error(`Pinned model checksum mismatch: ${file.path}`);
}
await mkdir("artifacts/embedding-reference-generator", { recursive: true });
const outfile = resolve("artifacts/embedding-reference-generator/generator.mjs");
await build({ entryPoints: ["packages/evidence/src/text-embedding.ts"], bundle: true, platform: "node", format: "esm",
  external: ["onnxruntime-node", "pngjs", "@huggingface/tokenizers"], outfile });
const { generateTextReferences, generateImageReferences } = await import(pathToFileURL(outfile).href);
const references = await generateTextReferences(pathToFileURL(`${directory}/`));
await writeFile(`${source}/text-references.json`, JSON.stringify(references) + "\n");
console.log(JSON.stringify({ vectors: references.references.length, vectorsSha256: references.vectorsSha256,
  policySha256: references.policySha256, manifestSha256: references.manifestSha256 }));

const templates = JSON.parse(await readFile(`${source}/image-references.json`, "utf8"));
const images = await generateImageReferences(pathToFileURL(`${directory}/`), templates);
await writeFile(`${source}/image-references.json`, JSON.stringify(images) + "\n");
console.log(JSON.stringify({ imageVectors: images.references.length, referencesSha256: images.referencesSha256 }));
// ORT sessions are released; exit also handles native runtime teardown on this host.
process.exit(0);
