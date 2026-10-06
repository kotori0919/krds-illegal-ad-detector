/** Stage the pinned Windows runtime next to the Tauri worker resource. */
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import console from "node:console";
import { createReadStream, createWriteStream } from "node:fs";
import { cp, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import process from "node:process";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { fileURLToPath, URL } from "node:url";
import { createRequire } from "node:module";
import { dirname } from "node:path";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const stage = join(root, "src-tauri", "binaries");
const packageDir = join(root, "node_modules", "playwright-core");
const nodeVersion = "22.19.0";
const nodeFile = "win-x64/node.exe";
const nodeBase = `https://nodejs.org/dist/v${nodeVersion}/`;
// From the official v22.19.0 SHASUMS256.txt; keep the runtime pinned offline.
const nodeSha256 = "995a3fb3cefad590cd3f4b321532a4b9582fb9c6575320ed2e3e894caac3e362";
const playwrightVersion = JSON.parse(await readFile(join(packageDir, "package.json"), "utf8")).version;
if (playwrightVersion !== "1.63.0") throw new Error(`Unsupported playwright-core version: ${playwrightVersion}`);
const browsers = JSON.parse(await readFile(join(packageDir, "browsers.json"), "utf8"));
const shell = browsers.browsers.find((item) => item.name === "chromium-headless-shell");
const ffmpegVersion = browsers.browsers.find((item) => item.name === "ffmpeg");
if (!shell || !ffmpegVersion) throw new Error("playwright-core browser revisions missing");

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

await mkdir(stage, { recursive: true });
await downloadVerifiedNode();
const targetPackage = join(stage, "node_modules", "playwright-core");
await rm(targetPackage, { recursive: true, force: true });
await cp(packageDir, targetPackage, { recursive: true, force: true });
// OCR executes offline in its own worker. Stage its complete Node dependency
// closure, including WASM and pinned Korean/English traineddata packages.
const stagedPackages = new Set();
async function stagePackage(name, fromDir = root) {
  if (stagedPackages.has(name)) return;
  const require = createRequire(join(fromDir, "package.json"));
  let source = dirname(require.resolve(name));
  let manifest;
  while (source !== dirname(source)) {
    try {
      const candidate = JSON.parse(await readFile(join(source, "package.json"), "utf8"));
      if (candidate.name === name) { manifest = candidate; break; }
    } catch (error) { if (error.code !== "ENOENT") throw error; }
    source = dirname(source);
  }
  if (!manifest) throw new Error(`Runtime dependency not found: ${name}`);
  stagedPackages.add(name);
  const destination = join(stage, "node_modules", name);
  await rm(destination, { recursive: true, force: true });
  await cp(source, destination, { recursive: true, force: true });
  for (const dependency of Object.keys(manifest.dependencies ?? {})) await stagePackage(dependency, source);
}
await stagePackage("tesseract.js");
await stagePackage("@tesseract.js-data/kor");
await stagePackage("@tesseract.js-data/eng");
await installBrowser();
console.log(JSON.stringify({ nodeVersion, playwrightVersion,
  headlessShellRevision: shell.revision, ocrPackages: [...stagedPackages].sort(), stage }, null, 2));
