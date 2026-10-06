/** Windows 4-vCPU/8-GB acceptance benchmark against the real bundled worker. */
import { createServer } from "node:http";
import { spawn, execFile } from "node:child_process";
import { readFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir, homedir, cpus, totalmem, platform, release } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import { validateExtraResult, validateOfficialResultText } from "../packages/contracts/dist/result.js";
import { validateScanDetailBundle } from "../packages/contracts/dist/detail.js";
import { createLargeMunicipalSite } from "../fixtures/realistic/large-site.mjs";

const execFileAsync = promisify(execFile);
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const site = join(root, "site");
const worker = join(root, "scanner-worker-x86_64-pc-windows-gnu.mjs");
const browserPath = join(root, "ms-playwright");
const large = process.argv.includes("--large");
const generated = large ? await createLargeMunicipalSite(site) : undefined;
const truth = generated?.truth ?? JSON.parse(await readFile(join(site, "ground-truth.json"), "utf8"));
const budgetSec = large ? 1500 : 90;
const expected = new Set(truth.positive.map((item) => `${item.page}\0${item.selector}\0${item.technique}`));
const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://fixture.local");
  if (generated) {
    const body = generated.pages.get(`${url.pathname}${url.search}`);
    response.writeHead(body === undefined ? 404 : 200, { "content-type": "text/html; charset=utf-8" });
    response.end(body ?? "missing");
    return;
  }
  const name = url.pathname.slice(1) || "index.html";
  if (!/^[a-z-]+\.html$/.test(name)) {
    response.writeHead(404);
    response.end("missing");
    return;
  }
  void readFile(join(site, name)).then((body) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(body);
  }).catch(() => {
    response.writeHead(404);
    response.end("missing");
  });
});

const findingKey = (finding) => {
  const url = new URL(finding.url);
  const path = `${url.pathname}${url.search}`;
  const boundary = finding.location.lastIndexOf(">>>");
  const selector = boundary < 0 ? finding.location : finding.location.slice(boundary + 3).trim();
  return `${path}\0${selector}\0${finding.technique}`;
};

async function workingSetMiB() {
  const { stdout } = await execFileAsync("tasklist", ["/fo", "csv", "/nh"], { maxBuffer: 4_000_000 });
  let kib = 0;
  for (const line of stdout.split(/\r?\n/)) {
    const match = /^"([^"]+)","[^"]+","[^"]*","[^"]*","([\d,]+) K"/.exec(line);
    if (match && /^(node|chrome-headless-shell)\.exe$/i.test(match[1])) {
      kib += Number(match[2].replaceAll(",", ""));
    }
  }
  return Number((kib / 1024).toFixed(1));
}

async function runOne(concurrency, origin, baselineMiB) {
  const dir = await mkdtemp(join(tmpdir(), `krds-v2-c${concurrency}-`));
  const resultFile = join(dir, "result.json");
  const detailFile = join(dir, "detail.json");
  const extraFile = join(dir, "extra.json");
  let peakMiB = baselineMiB;
  let sampling = false;
  let stderr = "";
  let progressText = "";
  let firstPageStartedWallSec = null;
  let finalizingWallSec = null;
  const captures = [];
  const cpuSamples = [];
  const memorySamples = [];
  let cpuText = "";
  const cpu = spawn("typeperf", ["\\Processor(_Total)\\% Processor Time", "\\Memory\\Available MBytes", "-si", "1", "-sc", String(budgetSec + 30)],
    { stdio: ["ignore", "pipe", "ignore"] });
  cpu.once("error", () => undefined);
  cpu.stdout?.setEncoding("utf8");
  cpu.stdout?.on("data", (chunk) => {
    cpuText += chunk;
    const lines = cpuText.split(/\r?\n/);
    cpuText = lines.pop() ?? "";
    for (const line of lines) {
      const match = /,"(-?[0-9]+(?:\.[0-9]+)?)","([0-9]+(?:\.[0-9]+)?)"\s*$/.exec(line);
      if (match) {
        cpuSamples.push(Number(match[1]));
        memorySamples.push(totalmem() / 1024 ** 2 - Number(match[2]));
      }
    }
  });
  const sample = async () => {
    if (sampling) return;
    sampling = true;
    try { peakMiB = Math.max(peakMiB, await workingSetMiB()); }
    catch (error) { stderr += `\nMemory sample failed: ${String(error)}`; }
    finally { sampling = false; }
  };
  const timer = setInterval(() => { void sample(); }, 500);
  const start = performance.now();
  try {
    await sample();
    const child = spawn(process.execPath, ["--import", pathToFileURL(join(root, "benchmarks", "capture-probe.mjs")).href, worker,
      "--session", `windows-v2-c${concurrency}`,
      "--entry-url", `${origin}/`,
      "--topic", "municipal-style-fixture",
      "--max-pages", String(truth.expectedCheckedPages), "--max-depth", large ? "4" : "2", "--timeout-sec", String(budgetSec),
      "--settle-ms", large ? "1500" : "1400", "--concurrency", String(concurrency),
      "--out-file", resultFile, "--detail-out-file", detailFile, "--extra-out-file", extraFile,
    ], { env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: browserPath }, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.resume();
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      progressText += chunk;
      const lines = progressText.split(/\r?\n/);
      progressText = lines.pop() ?? "";
      for (const line of lines) {
        if (line.startsWith("KRDSCAPTURE ")) captures.push(JSON.parse(line.slice("KRDSCAPTURE ".length)));
        if (!line.startsWith("KRDSPROGRESS ")) continue;
        const event = JSON.parse(line.slice("KRDSPROGRESS ".length));
        const elapsed = Number(((performance.now() - start) / 1000).toFixed(3));
        if (event.kind === "page-started" && firstPageStartedWallSec === null) firstPageStartedWallSec = elapsed;
        if (event.progress.stage === "finalizing" && finalizingWallSec === null) finalizingWallSec = elapsed;
      }
    });
    const code = await new Promise((done, fail) => {
      child.once("error", fail);
      child.once("exit", done);
    });
    const wallSec = Number(((performance.now() - start) / 1000).toFixed(3));
    cpu.kill();
    if (code !== 0) throw new Error(`worker C${concurrency} exited ${code}: ${stderr.slice(-1600)}`);
    const officialText = await readFile(resultFile, "utf8");
    const official = JSON.parse(officialText);
    const detail = JSON.parse(await readFile(detailFile, "utf8"));
    const extra = JSON.parse(await readFile(extraFile, "utf8"));
    const validator = {
      official: validateOfficialResultText(officialText).ok,
      detail: validateScanDetailBundle(detail, official).ok,
      extra: validateExtraResult(extra).ok,
    };
    const actual = new Set(official.findings.map(findingKey));
    const tp = [...actual].filter((key) => expected.has(key)).length;
    const fp = [...actual].filter((key) => !expected.has(key)).length;
    const fn = [...expected].filter((key) => !actual.has(key)).length;
    return {
      concurrency, wallSec,
      firstPageStartedWallSec,
      finalizationTailSec: finalizingWallSec === null ? null : Number((wallSec - finalizingWallSec).toFixed(3)),
      capture: { calls: captures.length, failed: captures.filter((capture) => !capture.ok).length,
        sumMs: Number(captures.reduce((sum, capture) => sum + capture.durationMs, 0).toFixed(1)),
        maxMs: captures.length ? Number(Math.max(...captures.map((capture) => capture.durationMs)).toFixed(1)) : 0 },
      pagesPerSec: Number((detail.coverage.checkedPages / wallSec).toFixed(3)),
      baselineMiB, peakMiB: Number(peakMiB.toFixed(1)),
      peakAboveBaselineMiB: Number((peakMiB - baselineMiB).toFixed(1)),
      cpuAvgPct: cpuSamples.length > 0
        ? Number((cpuSamples.reduce((sum, value) => sum + value, 0) / cpuSamples.length).toFixed(1)) : null,
      cpuPeakPct: cpuSamples.length > 0 ? Number(Math.max(...cpuSamples).toFixed(1)) : null,
      cpuSamples: cpuSamples.length,
      peakGuestUsedMiB: memorySamples.length > 0 ? Number(Math.max(...memorySamples).toFixed(1)) : null,
      timedOut: detail.coverage.timedOut,
      checkedPages: detail.coverage.checkedPages,
      failedPages: detail.coverage.failedPages.length,
      tp, fp, fn, validator,
      findingSet: official.findings,
      failedPageSet: detail.coverage.failedPages.map((page) => [page.url, page.status, page.reason]).sort(),
    };
  } finally {
    clearInterval(timer);
    cpu.kill();
    await rm(dir, { recursive: true, force: true });
  }
}

const results = [];
try {
  await new Promise((done) => server.listen(4124, "127.0.0.1", done));
  const origin = "http://127.0.0.1:4124";
  for (const concurrency of [1, 2, 3, 4]) {
    const baselineMiB = await workingSetMiB();
    const result = await runOne(concurrency, origin, baselineMiB);
    results.push(result);
    console.log(`C${concurrency} ${result.wallSec}s ${result.pagesPerSec}p/s `
      + `peak+${result.peakAboveBaselineMiB}MiB cpu=${result.cpuAvgPct ?? "NA"}% `
      + `guestPeak=${result.peakGuestUsedMiB ?? "NA"}MiB ${result.checkedPages}/${result.failedPages} pages `
      + `TP/FP/FN=${result.tp}/${result.fp}/${result.fn} valid=${Object.values(result.validator).every(Boolean)}`);
  }
  const same = results.every((item) => JSON.stringify(item.findingSet) === JSON.stringify(results[0].findingSet)
    && JSON.stringify(item.failedPageSet) === JSON.stringify(results[0].failedPageSet));
  const scenarioPassed = same && results.every((item) => item.checkedPages === truth.expectedCheckedPages
    && item.failedPages === truth.expectedFailedPages && !item.timedOut
    && item.capture.calls > 0
    && item.tp === expected.size && item.fp === 0 && item.fn === 0 && Object.values(item.validator).every(Boolean));
  const report = { scenario: large ? "municipal-generated-200" : "municipal-six-page", budgetSec,
    workerSha256: createHash("sha256").update(await readFile(worker)).digest("hex"),
    targetMet: results.every((item) => item.wallSec <= 1200),
    machine: { os: platform(), release: release(), node: process.version,
    logicalCpus: cpus().length, totalMemoryGiB: Number((totalmem() / 1024 ** 3).toFixed(1)) },
    same, scenarioPassed, results };
  const reportPath = join(homedir(), "Documents", large ? "windows-v2-large-bench.json" : "windows-v2-bench.json");
  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`FindingSet equal=${same}; scenario passed=${scenarioPassed}; report=${reportPath}`);
  if (!scenarioPassed) process.exitCode = 1;
} finally {
  await new Promise((done) => server.close(done));
}
