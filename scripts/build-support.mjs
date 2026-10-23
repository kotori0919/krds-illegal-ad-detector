import { createHash } from "node:crypto";
import { createReadStream, existsSync, realpathSync } from "node:fs";
import { lstat, readdir, readFile, writeFile } from "node:fs/promises";
import { spawn, execFileSync } from "node:child_process";
import { delimiter, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const stage = join(root, "src-tauri", "binaries");
export const workerName = "scanner-worker-x86_64-pc-windows-gnu.mjs";
export async function sha256(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
export async function inventory(directory, exclude = () => false) {
  const files = [];
  async function walk(current) {
    for (const entry of (await readdir(current, { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name, "en"))) {
      const path = join(current, entry.name);
      const name = relative(directory, path).split("\\").join("/");
      if (exclude(name)) continue;
      if (entry.isSymbolicLink()) throw new Error(`Resource symlink rejected: ${name}`);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) files.push({ path: name, size: (await lstat(path)).size, sha256: await sha256(path) });
      else throw new Error(`Unsupported resource: ${name}`);
    }
  }
  await walk(directory);
  return files;
}
export async function verifyFiles(directory, files) {
  if (!Array.isArray(files) || !files.length) throw new Error("Empty resource inventory");
  const seen = new Set();
  for (const file of files) {
    if (!file.path || file.path.includes("\\") || file.path.startsWith("/") || /^[A-Za-z]:/.test(file.path)
      || file.path.split("/").some(part => !part || part === "." || part === "..") || seen.has(file.path)
      || !/^[a-f0-9]{64}$/.test(file.sha256) || !Number.isSafeInteger(file.size) || file.size < 0) {
      throw new Error("Invalid resource inventory entry");
    }
    seen.add(file.path);
    let parent = directory;
    for (const part of file.path.split("/")) {
      parent = join(parent, part);
      if ((await lstat(parent)).isSymbolicLink()) throw new Error(`Resource symlink rejected: ${file.path}`);
    }
    if ((await lstat(parent)).size !== file.size || await sha256(parent) !== file.sha256) throw new Error(`Resource mismatch: ${file.path}`);
  }
}
export async function json(path) { return JSON.parse(await readFile(path, "utf8")); }
export async function writeJson(path, value) { await writeFile(path, JSON.stringify(value, null, 2) + "\n"); }
export function run(command, args, options = {}) {
  return new Promise((done, fail) => {
    const child = spawn(command, args, { cwd: root, stdio: "inherit", ...options });
    child.once("error", fail);
    child.once("exit", (code, signal) => code === 0 ? done() : fail(new Error(`${command} exited ${code ?? signal}`)));
  });
}
export function npm(args) {
  const candidates = [process.env.npm_execpath,
    join(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"),
    resolve(dirname(process.execPath), "../lib/node_modules/npm/bin/npm-cli.js")];
  for (const directory of (process.env.PATH ?? "").split(delimiter)) {
    const executable = join(directory, process.platform === "win32" ? "npm.cmd" : "npm");
    if (!existsSync(executable)) continue;
    const actual = realpathSync(executable);
    if (actual.endsWith("npm-cli.js")) candidates.push(actual);
    candidates.push(join(dirname(actual), "node_modules/npm/bin/npm-cli.js"));
  }
  const cli = candidates.find(path => path && existsSync(path));
  if (!cli) throw new Error("npm CLI unavailable; install the supported Node distribution with npm or set npm_execpath to npm-cli.js");
  return run(process.execPath, [cli, ...args]);
}
export async function sourceIdentity() {
  const paths = [...new Set(execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: root, encoding: "utf8" }).split("\0").filter(path =>
    /^(apps\/|packages\/|scripts\/|src-tauri\/|package(-lock)?\.json$|rust-toolchain\.toml$)/.test(path)
    && !/\/(dist|target|binaries|gen)\//.test(path) && !path.endsWith(".tsbuildinfo")))].sort();
  const hash = createHash("sha256");
  const sourceFiles = [];
  for (const path of paths) {
    const digest = await sha256(join(root, path));
    hash.update(path + "\0");
    hash.update(digest);
    sourceFiles.push({ path, sha256: digest });
  }
  return { commit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
    sourceSha256: hash.digest("hex"), files: paths.length, sourceFiles,
    dirty: execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim().length > 0 };
}
