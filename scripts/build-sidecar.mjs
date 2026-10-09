import { build } from "esbuild";
import { join } from "node:path";
import process from "node:process";
import { root, run, stage, workerName } from "./build-support.mjs";
await build({ entryPoints: [join(root, "packages/detection/src/worker.ts")], bundle: true,
  platform: "node", target: "node22", format: "esm", external: ["playwright-core"], outfile: join(stage, workerName) });
await run(process.execPath, [join(root, "scripts/build-ocr-worker.mjs"), stage]);
