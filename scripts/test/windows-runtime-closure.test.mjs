/** The staged Windows runtime must carry the complete dependency closure. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import test from "node:test";
import { stageRuntimeClosure } from "../prepare-windows-runtime.mjs";

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

test("staged runtime closure satisfies every declared dependency", async (context) => {
  const destination = await mkdtemp(join(tmpdir(), "krds-runtime-closure-"));
  context.after(() => rm(destination, { recursive: true, force: true }));
  const instances = await stageRuntimeClosure(destination);
  const nodeModules = join(destination, "node_modules");
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
});
