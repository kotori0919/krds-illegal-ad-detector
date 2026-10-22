/** Stage the pinned Windows runtime next to the Tauri worker resource. */
import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { spawn } from "node:child_process";
import console from "node:console";
import { createReadStream, createWriteStream, realpathSync } from "node:fs";
import { cp, lstat, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import process from "node:process";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { fileURLToPath, URL } from "node:url";
import { inventory, json, verifyFiles, writeJson } from "./build-support.mjs";
import { unzipSync } from "fflate";
import { clearBrowserValidationCache } from "./runtime-cache.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const stage = join(root, "src-tauri", "binaries");
const packageDir = join(root, "node_modules", "playwright-core");
const nodeVersion = "22.19.0";
const nodeFile = "win-x64/node.exe";
const nodeBase = `https://nodejs.org/dist/v${nodeVersion}/`;
// From the official v22.19.0 SHASUMS256.txt; keep the runtime pinned offline.
const nodeSha256 = "995a3fb3cefad590cd3f4b321532a4b9582fb9c6575320ed2e3e894caac3e362";
const lockPath = join(root, "scripts", "windows-runtime.lock.json");
const usqueSource = "https://github.com/Diniboy1123/usque/releases/download/v4.2.1/usque_4.2.1_windows_amd64.zip";
const usqueArchiveSha256 = "f6f7f0a1a2bc9bcc15cf563ec1f892d00690a92c086b23ed3211b802209099e7";
const usqueFiles = [
  { path: "usque.exe", size: 13038080, sha256: "122f2e40208e81bb814fcb4be4fbbbdc9246860f1f3784f72ae4512b97667e91" },
  { path: "usque-LICENSE.md", size: 1120, sha256: "b3e9fec720528afc8d92644ee0ec9b2659324970dea9d34d8c547c783124fd4b" },
];
const runtimeOnly = name => !["node.exe", "node-LICENSE", "usque.exe", "usque-LICENSE.md"].includes(name)
  && name !== "node_modules" && !name.startsWith("node_modules/")
  && name !== "ms-playwright" && !name.startsWith("ms-playwright/");
// The packaged worker keeps these packages external (scripts/build-ocr-worker.mjs)
// or ships them as pinned language data, so they must live beside it at runtime.
const runtimeRoots = ["tesseract.js", "@tesseract.js-data/kor", "@tesseract.js-data/eng", "onnxruntime-node", "pngjs"];

// npm/Node lookup order, independent of package entry points: the nearest
// <ancestor>/node_modules/<name>/package.json wins. require.resolve cannot be
// used here because a dependency may legitimately ship types only (for example
// serialize-error depends on type-fest), and it would also hide the nested
// layout that Node uses to keep conflicting versions apart.
async function locatePackage(name, fromDirectory) {
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

// Stage the whole declared runtime closure. Each installed instance is copied to
// the same path it occupies under the project's node_modules, so hoisted
// packages keep their existing stage/node_modules/<name> layout while nested
// duplicates stay nested and each importer resolves the version npm selected
// for it. Optional dependencies follow npm: stage them only when installed.
export async function stageRuntimeClosure(destination, roots = runtimeRoots, sourceRoot = root) {
  const sourceModules = join(sourceRoot, "node_modules");
  const staged = new Map();
  async function stage(name, fromDirectory, optional) {
    const found = await locatePackage(name, fromDirectory);
    if (!found) {
      if (optional) return;
      throw new Error(`Runtime dependency not found: ${name} (required by ${relative(sourceRoot, fromDirectory) || "."})`);
    }
    const installed = relative(sourceModules, found.directory);
    if (!installed || installed.startsWith("..") || isAbsolute(installed)) throw new Error(`Runtime dependency resolves outside node_modules: ${name}`);
    const path = installed.split("\\").join("/");
    if ((await lstat(found.directory)).isSymbolicLink()) throw new Error(`Resource symlink rejected: node_modules/${path}`);
    if (staged.has(path)) return;
    staged.set(path, { name, version: found.manifest.version, path });
    const target = join(destination, "node_modules", installed);
    await rm(target, { recursive: true, force: true });
    await cp(found.directory, target, { recursive: true, force: true });
    for (const dependency of Object.keys(found.manifest.dependencies ?? {})) await stage(dependency, found.directory, false);
    for (const dependency of Object.keys(found.manifest.optionalDependencies ?? {})) await stage(dependency, found.directory, true);
  }
  for (const name of roots) await stage(name, sourceRoot, false);
  return [...staged.values()].sort((a, b) => a.path.localeCompare(b.path, "en"));
}
async function verifyRuntime() {
  const lock = await json(lockPath);
  if (lock.schemaVersion !== 1) throw new Error("Unsupported runtime lock");
  if (lock.sources?.usque?.version !== "4.2.1" || lock.sources.usque.commit !== "6aa03fc97d12848dce34eedbd187fb1077b5d1ea"
    || lock.sources.usque.url !== usqueSource || lock.sources.usque.archiveSha256 !== usqueArchiveSha256) throw new Error("Pinned WARP provenance missing from runtime lock");
  for (const file of usqueFiles) if (!lock.files.some(item => JSON.stringify(item) === JSON.stringify(file))) throw new Error("Pinned WARP resource missing from runtime lock");
  // Verified staging bytes must also be selected at their installed Tauri paths.
  const config = await json(join(root, "src-tauri", "tauri.conf.json"));
  for (const file of usqueFiles) {
    const resource = `binaries/${file.path}`;
    if (config.bundle?.resources?.[resource] !== resource) throw new Error(`Pinned WARP resource must be bundled at ${resource}`);
  }
  await clearBrowserValidationCache(stage);
  await verifyFiles(stage, lock.files);
  const actual = await inventory(stage, runtimeOnly);
  if (JSON.stringify(actual) !== JSON.stringify(lock.files)) throw new Error("Runtime inventory has unexpected/missing files; prepare pinned resources again");
  console.log(JSON.stringify({ runtime: "verified", files: lock.files.length, nodeVersion }));
  process.exit(0);
}
const playwrightVersion = JSON.parse(await readFile(join(packageDir, "package.json"), "utf8")).version;
if (playwrightVersion !== "1.63.0") throw new Error(`Unsupported playwright-core version: ${playwrightVersion}`);
const browsers = JSON.parse(await readFile(join(packageDir, "browsers.json"), "utf8"));
const shell = browsers.browsers.find((item) => item.name === "chromium-headless-shell");
const ffmpegVersion = browsers.browsers.find((item) => item.name === "ffmpeg");
const winlddVersion = browsers.browsers.find((item) => item.name === "winldd");
if (!shell || !ffmpegVersion) throw new Error("playwright-core browser revisions missing");
if (winlddVersion?.revision !== "1007") throw new Error("Unsupported Windows dependency inspector revision");
const winlddSource = "https://cdn.playwright.dev/dbazure/download/playwright/builds/winldd/1007/winldd-win64.zip";
const winlddArchiveSha256 = "0069f0d11d4ad6df068a068c003d22fe7dbec192a47bba64b2e115e9c8ce41d8";

async function installWindowsInspector() {
  const directory = join(stage, "ms-playwright", "winldd-1007");
  // This inspector is required when Windows Playwright checks browser DLLs,
  // including after its 30-day host-validation cache expires.
  const response = await globalThis.fetch(winlddSource);
  if (!response.ok) throw new Error(`Windows inspector download failed: ${response.status}`);
  if (!response.body || Number(response.headers.get("content-length") ?? 0) > 1_000_000) throw new Error("Windows inspector download exceeds limit");
  const chunks = [];
  let bytes = 0;
  for await (const chunk of Readable.fromWeb(response.body)) {
    bytes += chunk.byteLength;
    if (bytes > 1_000_000) throw new Error("Windows inspector download exceeds limit");
    chunks.push(chunk);
  }
  const archive = Buffer.concat(chunks);
  if (archive.byteLength > 1_000_000 || createHash("sha256").update(archive).digest("hex") !== winlddArchiveSha256) throw new Error("Windows inspector archive mismatch");
  const files = unzipSync(archive);
  if (Object.keys(files).length !== 1 || !files["PrintDeps.exe"] || files["PrintDeps.exe"].byteLength > 1_000_000) throw new Error("Unexpected Windows inspector archive layout");
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "PrintDeps.exe"), files["PrintDeps.exe"]);
  await writeFile(join(directory, "INSTALLATION_COMPLETE"), "");
}

async function installUsque() {
  try { await verifyFiles(stage, usqueFiles); return; } catch { /* Prepare only; never download during a scan. */ }
  const response = await globalThis.fetch(usqueSource);
  if (!response.ok || !response.body || Number(response.headers.get("content-length") ?? 0) > 16_000_000) throw new Error("WARP archive download failed");
  const chunks = []; let bytes = 0;
  for await (const chunk of Readable.fromWeb(response.body)) {
    bytes += chunk.byteLength;
    if (bytes > 16_000_000) throw new Error("WARP archive exceeds limit");
    chunks.push(chunk);
  }
  const archive = Buffer.concat(chunks);
  if (createHash("sha256").update(archive).digest("hex") !== usqueArchiveSha256) throw new Error("WARP archive mismatch");
  const files = unzipSync(archive);
  if (Object.keys(files).sort().join(",") !== "LICENSE.md,README.md,usque.exe") throw new Error("Unexpected WARP archive layout");
  for (const file of usqueFiles) {
    const data = files[file.path === "usque.exe" ? "usque.exe" : "LICENSE.md"];
    if (data?.byteLength !== file.size || createHash("sha256").update(data).digest("hex") !== file.sha256) throw new Error("WARP resource mismatch");
  }
  for (const file of usqueFiles) await writeFile(join(stage,file.path),files[file.path === "usque.exe" ? "usque.exe" : "LICENSE.md"]);
  await verifyFiles(stage,usqueFiles);
}

async function downloadVerifiedNode() {
  const target = join(stage, "node.exe");
  const hashFile = async (path) => {
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(path)) hash.update(chunk);
    return hash.digest("hex");
  };
  let nodeIsCurrent = false;
  try {
    nodeIsCurrent = (await hashFile(target)) === nodeSha256;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (!nodeIsCurrent) {
    const response = await globalThis.fetch(`${nodeBase}${nodeFile}`);
    if (!response.ok || !response.body) throw new Error(`Node download failed: ${response.status}`);
    const temporary = `${target}.download`;
    try {
      await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary));
      if ((await hashFile(temporary)) !== nodeSha256) throw new Error("Node executable SHA-256 mismatch");
      await rename(temporary, target);
    } finally {
      await rm(temporary, { force: true });
    }
  }
  const licensePath = join(stage, "node-LICENSE");
  try {
    if ((await stat(licensePath)).size > 0) return;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const license = await globalThis.fetch(`https://raw.githubusercontent.com/nodejs/node/v${nodeVersion}/LICENSE`);
  if (!license.ok) throw new Error(`Node license download failed: ${license.status}`);
  await writeFile(licensePath, await license.text());
}

async function installBrowser() {
  const browserRoot = join(stage, "ms-playwright");
  const shellDir = join(browserRoot, `chromium_headless_shell-${shell.revision}`);
  const executable = join(shellDir,
    "chrome-headless-shell-win64", "chrome-headless-shell.exe");
  const ffmpegDir = join(browserRoot, `ffmpeg-${ffmpegVersion.revision}`);
  const ffmpeg = join(ffmpegDir, "ffmpeg-win64.exe");
  const installed = async () => {
    try {
      return (await stat(executable)).size > 0
        && (await stat(ffmpeg)).size > 0
        && (await stat(join(shellDir, "INSTALLATION_COMPLETE"))).isFile()
        && (await stat(join(ffmpegDir, "INSTALLATION_COMPLETE"))).isFile();
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      return false;
    }
  };
  if (await installed()) return;
  await new Promise((done, fail) => {
    const child = spawn(process.execPath, [join(packageDir, "cli.js"), "install", "--no-progress", "chromium-headless-shell"], {
      cwd: root,
      env: {
        ...process.env,
        PLAYWRIGHT_HOST_PLATFORM_OVERRIDE: "win64",
        PLAYWRIGHT_BROWSERS_PATH: browserRoot,
      },
      stdio: "inherit",
    });
    child.once("error", fail);
    child.once("exit", (code) => code === 0 ? done() : fail(new Error(`Playwright browser install exited ${code}`)));
  });
  if (!(await installed())) throw new Error(`Windows browser installation incomplete: ${basename(executable)}`);
}

async function main() {
  if (process.argv.includes("--verify")) return verifyRuntime();
  await mkdir(stage, { recursive: true });
  await installUsque();
  await downloadVerifiedNode();
  // Rebuild the package tree from scratch: packages left over from an older
  // closure must never leak into the installer or into the reviewed lock.
  await rm(join(stage, "node_modules"), { recursive: true, force: true });
  await cp(packageDir, join(stage, "node_modules", "playwright-core"), { recursive: true, force: true });
  // OCR executes offline in its own worker. Stage its complete Node dependency
  // closure, including WASM and pinned Korean/English traineddata packages.
  const stagedPackages = await stageRuntimeClosure(stage);
  await installBrowser();
  await installWindowsInspector();
  // Playwright's cache ownership links contain absolute preparation-machine paths;
  // they are not runtime inputs and must never enter an installer or its lock.
  await rm(join(stage, "ms-playwright", ".links"), { recursive: true, force: true });
  // Host-validation markers are cache state, not proof of target Windows acceptance.
  await clearBrowserValidationCache(stage);
  const files = await inventory(stage, runtimeOnly);
  if (process.argv.includes("--update-lock")) {
    await writeJson(lockPath, { schemaVersion: 1, nodeVersion, playwrightVersion,
      sources: { node: `${nodeBase}${nodeFile}`, nodeChecksums: `${nodeBase}SHASUMS256.txt`,
        browser: `https://cdn.playwright.dev/builds/cft/${shell.browserVersion}/win64/chrome-headless-shell-win64.zip`,
        ffmpeg: `https://cdn.playwright.dev/dbazure/download/playwright/builds/ffmpeg/${ffmpegVersion.revision}/ffmpeg-win64.zip`,
        winldd: { url: winlddSource, archiveSha256: winlddArchiveSha256 },
        usque: { version: "4.2.1", commit: "6aa03fc97d12848dce34eedbd187fb1077b5d1ea", url: usqueSource, archiveSha256: usqueArchiveSha256 },
        packages: "package-lock.json resolved URLs/integrity (Tesseract includes WASM and language data)" }, files });
  } else {
    const lock = await json(lockPath);
    if (lock.schemaVersion !== 1 || JSON.stringify(files) !== JSON.stringify(lock.files)) throw new Error("Prepared runtime differs from reviewed lock; inspect sources before explicit --update-lock");
  }
  console.log(JSON.stringify({ nodeVersion, playwrightVersion,
    headlessShellRevision: shell.revision, ocrPackages: stagedPackages.map(({ name }) => name).sort(), stage }, null, 2));
}

// Importing this module (for tests) must not stage, download or verify anything.
const invoked = process.argv[1] && realpathSync(resolve(process.argv[1]));
if (invoked && invoked === realpathSync(fileURLToPath(import.meta.url))) await main();
