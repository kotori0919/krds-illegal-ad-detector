import { afterAll, beforeAll, expect, it } from "vitest";
import { build } from "esbuild";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

let directory: string;
let worker: string;
beforeAll(async () => {
  // Keep external playwright-core resolution identical to the packaged worker.
  directory = await mkdtemp(resolve("node_modules/worker-transport-fixture-"));
  worker = join(directory, "worker.mjs");
  await build({ entryPoints: [resolve("packages/detection/src/worker.ts")], bundle: true,
    platform: "node", target: "node22", format: "esm", external: ["playwright-core"], outfile: worker });
});
afterAll(async () => { if (directory) await rm(directory, { recursive: true, force: true }); });

async function run(entry: string, flags: string[]) {
  return await new Promise<{ stdout: string; stderr: string; code: number }>((resolve, reject) => {
    const child = execFile(process.execPath, [worker, "--session", "transport-fixture", "--entry-url", entry,
      "--timeout-sec", "5", ...flags], { timeout: 10000 }, (error, stdout, stderr) => {
      if (error && typeof error.code !== "number") reject(error);
      else resolve({ stdout, stderr, code: typeof error?.code === "number" ? error.code : 0 });
    });
    child.stdin?.end();
  });
}

it("records an ordinary native scan as direct and preserves public-only rejection without WARP registration", async () => {
  const result = await run("http://127.0.0.1/", ["--direct-reason", "operator", "--public-network-only"]);
  expect(result.code).toBe(1);
  expect(result.stderr).toContain('KRDSTRANSPORT {"kind":"direct","reason":"operator"}');
  expect(result.stderr).not.toContain("KRDSWARPERROR");
  expect(result.stderr).toMatch(/public|private|blocked|allowed/i);
  expect(result.stdout).toBe("");
});

it("keeps explicit WARP fail-closed when registration paths are absent", async () => {
  const result = await run("https://1.1.1.1/", ["--require-warp", "--public-network-only"]);
  expect(result.code).toBe(1);
  expect(result.stderr).toContain('KRDSWARPERROR {"code":"config-invalid"}');
  expect(result.stderr).not.toContain('KRDSTRANSPORT {"kind":"direct"');
  expect(result.stdout).toBe("");
});
