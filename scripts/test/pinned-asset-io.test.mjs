import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import fsPromises, { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mock, test } from "node:test";
import { publishPinnedFile, verifyPinnedFile } from "../lib/pinned-asset-io.mjs";

async function fixture(run, size = 4097) {
  const directory = await mkdtemp(join(tmpdir(), "krds-pinned-io-"));
  const file = join(directory, "source.bin");
  const destination = join(directory, "output.bin");
  const bytes = Buffer.alloc(size, 0x5a);
  const asset = { file, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), label: "synthetic" };
  try { await writeFile(file, bytes); await run({ directory, destination, bytes, asset }); }
  finally { await rm(directory, { recursive: true, force: true }); }
}

test("verifies a multi-buffer fixture without publishing any file", async () => {
  await fixture(async ({ directory, asset }) => {
    await verifyPinnedFile(asset);
    assert.deepEqual(await readdir(directory), ["source.bin"]);
  }, 2 * 1024 * 1024 + 17);
});

test("copies and hashes in one pass before replacing the destination", async () => {
  await fixture(async ({ directory, destination, bytes, asset }) => {
    await writeFile(destination, "previous output");
    await publishPinnedFile(asset, destination);
    assert.deepEqual(await readFile(destination), bytes);
    assert.deepEqual(await readFile(asset.file), bytes);
    assert.notEqual((await stat(destination)).ino, (await stat(asset.file)).ino);
    assert.deepEqual((await readdir(directory)).sort(), ["output.bin", "source.bin"]);
  });
});

test("verifies the temporary hardlink before publishing the same inode", async () => {
  await fixture(async ({ directory, destination, bytes, asset }) => {
    await publishPinnedFile(asset, destination, { preferHardlink: true });
    assert.deepEqual(await readFile(destination), bytes);
    const source = await stat(asset.file); const output = await stat(destination);
    assert.equal(output.dev, source.dev); assert.equal(output.ino, source.ino);
    assert.deepEqual((await readdir(directory)).sort(), ["output.bin", "source.bin"]);
  });
});

for (const preferHardlink of [false, true]) {
  test(`rejects same-size corruption and preserves old output (hardlink=${preferHardlink})`, async () => {
    await fixture(async ({ directory, destination, asset }) => {
      await writeFile(destination, "previous output");
      await writeFile(asset.file, Buffer.alloc(asset.bytes, 0x41));
      await assert.rejects(publishPinnedFile(asset, destination, { preferHardlink }), /checksum changed/);
      assert.equal(await readFile(destination, "utf8"), "previous output");
      assert.deepEqual((await readdir(directory)).sort(), ["output.bin", "source.bin"]);
    });
  });
}

test("rejects both truncated and oversized files against the pin", async () => {
  await fixture(async ({ destination, asset }) => {
    for (const size of [asset.bytes - 1, asset.bytes + 1]) {
      await writeFile(asset.file, Buffer.alloc(size));
      await assert.rejects(publishPinnedFile(asset, destination), /size changed/);
      await assert.rejects(stat(destination), { code: "ENOENT" });
    }
  });
});

test("propagates missing source without creating an output", async () => {
  await fixture(async ({ directory, destination, asset }) => {
    await rm(asset.file);
    await assert.rejects(publishPinnedFile(asset, destination), { code: "ENOENT" });
    assert.deepEqual(await readdir(directory), []);
  });
});

test("fails closed for invalid pins and non-file sources", async () => {
  await fixture(async ({ directory, destination, asset }) => {
    for (const invalid of [{ ...asset, bytes: -1 }, { ...asset, sha256: "untrusted receipt" }]) {
      await assert.rejects(publishPinnedFile(invalid, destination), /Invalid pinned asset/);
    }
    await assert.rejects(publishPinnedFile({ ...asset, file: directory }, destination), /size changed/);
    assert.deepEqual(await readdir(directory), ["source.bin"]);
  });
});

test("republishes an existing destination on the same inode without a temporary leak", async () => {
  await fixture(async ({ directory, destination, bytes, asset }) => {
    await publishPinnedFile(asset, destination, { preferHardlink: true });
    const before = await stat(destination);
    await publishPinnedFile(asset, destination, { preferHardlink: true });
    const after = await stat(destination);
    assert.equal(after.dev, before.dev); assert.equal(after.ino, before.ino);
    assert.equal(after.ino, (await stat(asset.file)).ino);
    assert.equal(after.nlink, 2);
    assert.deepEqual(await readFile(destination), bytes);
    assert.deepEqual((await readdir(directory)).sort(), ["output.bin", "source.bin"]);
  });
});

test("preserves the previous destination and cleans the temporary file on rename failure", async () => {
  await fixture(async ({ directory, destination, bytes, asset }) => {
    await writeFile(destination, "previous output");
    const failure = Object.assign(new Error("synthetic rename failure"), { code: "EACCES" });
    let attempts = 0;
    const rename = mock.method(fsPromises, "rename", async (source, target) => {
      assert.equal(target, destination);
      assert.deepEqual(await readFile(source), bytes); // Failure occurs after copy and verification.
      attempts++;
      throw failure;
    });
    syncBuiltinESMExports();
    try {
      await assert.rejects(publishPinnedFile(asset, destination), error => error === failure);
      assert.equal(attempts, 1);
      assert.equal(await readFile(destination, "utf8"), "previous output");
      assert.deepEqual(await readFile(asset.file), bytes);
      assert.deepEqual((await readdir(directory)).sort(), ["output.bin", "source.bin"]);
    } finally { rename.mock.restore(); syncBuiltinESMExports(); }
  });
});

test("forces EXDEV fallback while retaining full verification and failure cleanup", async () => {
  await fixture(async ({ directory, destination, bytes, asset }) => {
    let attempts = 0;
    const link = mock.method(fsPromises, "link", async (source) => {
      assert.equal(source, asset.file);
      attempts++;
      throw Object.assign(new Error("synthetic cross-device link"), { code: "EXDEV" });
    });
    syncBuiltinESMExports();
    try {
      await publishPinnedFile(asset, destination, { preferHardlink: true });
      assert.equal(attempts, 1);
      assert.notEqual((await stat(destination)).ino, (await stat(asset.file)).ino);
      assert.deepEqual(await readFile(destination), bytes);
      await writeFile(asset.file, Buffer.alloc(asset.bytes, 0x41));
      await assert.rejects(publishPinnedFile(asset, destination, { preferHardlink: true }), /checksum changed/);
      assert.equal(attempts, 2);
      assert.deepEqual(await readFile(destination), bytes);
      assert.deepEqual((await readdir(directory)).sort(), ["output.bin", "source.bin"]);
    } finally { link.mock.restore(); syncBuiltinESMExports(); }
  });
});
