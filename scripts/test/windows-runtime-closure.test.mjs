/** The staged Windows runtime must carry the complete dependency closure. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { lstat, mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import test from "node:test";
import { pruneStagedOnnxRuntime, stageRuntimeClosure } from "../prepare-windows-runtime.mjs";

// Mirrors Node's own lookup so the assertions do not depend on the helper under test.
async function findStaged(name, fromDirectory) {
  for (let directory = fromDirectory; ; directory = dirname(directory)) {
    const candidate = join(directory, "node_modules", name);
    try {
      const manifest = JSON.parse(await readFile(join(candidate, "package.json"), "utf8"));
      if (manifest.name === name) return { directory: candidate, manifest };
    } catch (error) {
      if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw error;
    }
    if (directory === dirname(directory)) return null;
  }
}

async function stagedPackages(nodeModules) {
  const packages = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const path = join(directory, entry.name);
      if (entry.name === "node_modules" || entry.name.startsWith("@")) { await walk(path); continue; }
      try {
        packages.push({ directory: path, manifest: JSON.parse(await readFile(join(path, "package.json"), "utf8")) });
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      const nested = join(path, "node_modules");
      try { await readdir(nested); await walk(nested); } catch (error) { if (error.code !== "ENOENT") throw error; }
    }
  }
  await walk(nodeModules);
  return packages;
}

// Independent measurement so the pruned byte report is cross-checked, not restated.
async function treeBytes(directory) {
  let bytes = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    bytes += entry.isDirectory() ? await treeBytes(path) : (await stat(path)).size;
  }
  return bytes;
}

test("staged runtime closure satisfies every declared dependency", async (context) => {
  const destination = await mkdtemp(join(tmpdir(), "krds-runtime-closure-"));
  context.after(() => rm(destination, { recursive: true, force: true }));
  const instances = await stageRuntimeClosure(destination);
  const nodeModules = join(destination, "node_modules");
  const onnxRuntime = join(nodeModules, "onnxruntime-node");
  const beforePrune = await treeBytes(onnxRuntime);
  // Preparation prunes the staged tree before it is inventoried, so every
  // assertion below inspects the layout the installer would actually ship.
  const pruned = await pruneStagedOnnxRuntime(destination);
  const staged = await stagedPackages(nodeModules);
  await context.test("every staged package is a declared runtime root or dependency", async () => {
    assert.equal(staged.length, instances.length);
    assert.deepEqual(staged.map(({ manifest }) => manifest.name).sort(), instances.map(({ name }) => name).sort());
  });
  await context.test("declared dependencies are present at a resolvable path", async () => {
    let edges = 0;
    for (const { directory, manifest } of staged) {
      const declared = { ...(manifest.dependencies ?? {}), ...(manifest.optionalDependencies ?? {}) };
      for (const name of Object.keys(declared)) {
        const found = await findStaged(name, directory);
        assert.ok(found, `${manifest.name} requires ${name}, which is missing from the staged tree`);
        edges += 1;
      }
    }
    assert.ok(edges > 0, "no dependency edges were inspected");
  });
  await context.test("packages that ship JavaScript still resolve", async () => {
    for (const { directory, manifest } of staged) {
      try {
        createRequire(join(directory, "package.json")).resolve(manifest.name);
      } catch (error) {
        if (error.code !== "MODULE_NOT_FOUND") throw error;
        // Type-only packages (type-fest) legitimately ship no entry point; they
        // are still staged for the closure, so reject only missing code.
        const entries = await readdir(directory);
        assert.ok(!entries.some(name => /\.(js|mjs|cjs)$/.test(name)), `${manifest.name} ships JavaScript but does not resolve: ${error.code}`);
      }
    }
  });
  // Regression: serialize-error declares the types-only package type-fest. It was
  // staged until preparation switched to a package.json lookup; require.resolve
  // aborts on type-fest because npm ships it without a JavaScript entry point.
  await context.test("types-only dependency of serialize-error is staged", async () => {
    const serializeError = await findStaged("serialize-error", nodeModules);
    assert.ok(serializeError, "serialize-error is missing from the staged tree");
    const manifest = JSON.parse(await readFile(join(serializeError.directory, "package.json"), "utf8"));
    assert.equal(manifest.dependencies?.["type-fest"], "^0.20.2");
    const typeFest = await findStaged("type-fest", serializeError.directory);
    assert.ok(typeFest, "type-fest is missing from the staged tree");
    assert.equal(createRequire(join(serializeError.directory, "package.json")).resolve("type-fest/package.json"),
      join(typeFest.directory, "package.json"));
  });
  // Regression: npm nests conflicting versions. node-fetch keeps its own
  // whatwg-url@5/tr46@0.0.3, which must stay nested rather than overwrite the
  // hoisted packages other importers resolve.
  await context.test("nested duplicates keep their own versions", async () => {
    const nodeFetch = await findStaged("node-fetch", nodeModules);
    assert.ok(nodeFetch);
    const nested = await findStaged("whatwg-url", nodeFetch.directory);
    assert.ok(nested);
    assert.equal(relative(nodeModules, nested.directory), join("node-fetch", "node_modules", "whatwg-url"));
    assert.equal(nested.manifest.version, "5.0.0");
    const tr46 = await findStaged("tr46", nested.directory);
    assert.ok(tr46);
    assert.equal(tr46.manifest.version, "0.0.3");
  });
  // The packaged worker is win32-x64 only (Tauri target), and the loader picks
  // its native payload as ../bin/napi-v<ABI>/${process.platform}/${process.arch}.
  // Every other platform/arch payload is unreachable installer weight.
  await context.test("only the win32-x64 onnxruntime payload is staged", async () => {
    assert.deepEqual(await readdir(join(onnxRuntime, "bin")), ["napi-v6"]);
    assert.deepEqual(await readdir(join(onnxRuntime, "bin", "napi-v6")), ["win32"]);
    assert.deepEqual(await readdir(join(onnxRuntime, "bin", "napi-v6", "win32")), ["x64"]);
    // Derive the expected file from the loader's own expression instead of
    // restating the destination constant.
    const loader = await readFile(join(onnxRuntime, "dist", "binding.js"), "utf8");
    const specifier = loader.match(/\.\.\/bin\/napi-v\d+\/\$\{process\.platform\}\/\$\{process\.arch\}\/onnxruntime_binding\.node/)?.[0];
    assert.ok(specifier, "onnxruntime-node dist loader must resolve a per-platform native binding");
    const binding = join(onnxRuntime, "dist", specifier
      .replace("${process.platform}", "win32").replace("${process.arch}", "x64"));
    assert.equal(binding, join(onnxRuntime, "bin", "napi-v6", "win32", "x64", "onnxruntime_binding.node"));
    assert.ok((await stat(binding)).size > 0, "the win32-x64 native binding must survive pruning");
    // The binding's PE import table requires onnxruntime.dll beside it.
    assert.ok((await stat(join(onnxRuntime, "bin", "napi-v6", "win32", "x64", "onnxruntime.dll"))).size > 0,
      "onnxruntime.dll must survive pruning");
    // Resolution metadata must survive: Node finds the package by package.json.
    assert.equal(createRequire(join(onnxRuntime, "package.json")).resolve("onnxruntime-node"),
      join(onnxRuntime, "dist", "index.js"));
  });
  await context.test("pruned payloads are gone and fully accounted for", async () => {
    const expected = [
      "node_modules/onnxruntime-node/bin/napi-v6/darwin",
      "node_modules/onnxruntime-node/bin/napi-v6/linux",
      "node_modules/onnxruntime-node/bin/napi-v6/win32/arm64",
      "node_modules/onnxruntime-node/script",
    ];
    assert.deepEqual([...pruned.removed].sort(), expected);
    for (const path of expected) await assert.rejects(lstat(join(destination, path)), { code: "ENOENT" });
    assert.deepEqual((await readdir(onnxRuntime)).sort(), ["README.md", "bin", "dist", "lib", "package.json"]);
    // Byte/file accounting must match an independent measurement of the tree.
    const afterPrune = await treeBytes(onnxRuntime);
    assert.equal(pruned.bytes, beforePrune - afterPrune);
    assert.ok(pruned.files > 0);
    assert.ok(pruned.bytes > 200 * 1024 * 1024, `expected the foreign payloads to dominate, removed ${pruned.bytes} bytes`);
    assert.ok(afterPrune < beforePrune / 4, `expected win32-x64 payload to be a fraction of the package, got ${afterPrune}`);
  });
});
