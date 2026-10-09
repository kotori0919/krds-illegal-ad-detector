import { lstat, rm } from "node:fs/promises";
import { join, relative } from "node:path";
import { root } from "./build-support.mjs";

// An allowlist, never caller-controlled paths; never remove runtime downloads or cases.
const generated = ["apps/web/dist", ...["contracts", "synth-eval", "scanner", "detection", "evidence"].map(name => `packages/${name}/dist`)];
for (const name of generated) {
  const path = join(root, name);
  if (relative(root, path).split("\\").join("/") !== name || name.includes("..")) throw new Error("Unsafe clean target");
  let parent = root;
  try {
    for (const segment of name.split("/")) {
      parent = join(parent, segment);
      if ((await lstat(parent)).isSymbolicLink()) throw new Error(`Clean refuses symlink: ${name}`);
    }
    await rm(path, { recursive: true, force: true });
  } catch (error) { if (error.code !== "ENOENT") throw error; }
}
