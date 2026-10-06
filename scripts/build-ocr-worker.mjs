/** Bundle the CPU worker and copy pinned offline language assets beside it. */
import { build } from "esbuild";
import { cp, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve, join } from "node:path";
import { fileURLToPath, URL } from "node:url";
import process from "node:process";

const root = fileURLToPath(new URL("..", import.meta.url));
const target = resolve(process.argv[2] ?? "packages/evidence/dist");
const require = createRequire(import.meta.url);
await mkdir(join(target, "ocr-data"), { recursive: true });
await build({ entryPoints: [join(root, "packages/evidence/src/ocr-worker.ts")], bundle: true,
  platform: "node", format: "esm", external: ["tesseract.js"], outfile: join(target, "ocr-worker.mjs") });
for (const code of ["kor", "eng"]) {
  await cp(require.resolve(`@tesseract.js-data/${code}/4.0.0_best_int/${code}.traineddata.gz`),
    join(target, "ocr-data", `${code}.traineddata.gz`));
}
