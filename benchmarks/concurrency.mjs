/** Repeatable L1/L2 fixture benchmark for worker counts 1–4. */
import { performance } from "node:perf_hooks";
import { createServer } from "node:http";
import { readFile, readdir, stat } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { scanSite } from "../packages/detection/dist/scan.js";
import { loadGroundTruth } from "../packages/synth-eval/dist/evaluate.js";
import { startFixtureServer } from "../packages/synth-eval/dist/serve.js";
import { validateOfficialResultText } from "../packages/contracts/dist/result.js";

const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
async function requireFreshBuild(packageName) {
  const sourceRoot = resolve(repoRoot, "packages", packageName, "src");
  const builtRoot = resolve(repoRoot, "packages", packageName, "dist");
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const sourcePath = resolve(directory, entry.name);
      if (entry.isDirectory()) { await visit(sourcePath); continue; }
      if (!entry.name.endsWith(".ts") || entry.name.endsWith(".d.ts")) continue;
      const builtPath = resolve(builtRoot, relative(sourceRoot, sourcePath).replace(/\.ts$/, ".js"));
      const [sourceInfo, builtInfo] = await Promise.all([stat(sourcePath), stat(builtPath).catch(() => undefined)]);
      if (!builtInfo || builtInfo.mtimeMs + 5 < sourceInfo.mtimeMs) {
        throw new Error(`stale ${packageName} benchmark artifact: run npm run build:scanner`);
      }
    }
  }
  await visit(sourceRoot);
}
for (const name of ["contracts", "synth-eval", "scanner", "detection"]) await requireFreshBuild(name);

const realistic = process.argv.includes("--realistic");
const fixtureRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../fixtures/realistic");
const truth = realistic ? JSON.parse(await readFile(resolve(fixtureRoot, "ground-truth.json"), "utf8")) : undefined;
const cases = realistic ? [] : (await loadGroundTruth()).filter((item) => item.kind === "positive");
const expected = realistic
  ? new Set(truth.positive.map((item) => `${item.page}\0${item.selector}\0${item.technique}`))
  : new Set(cases.flatMap((item) => (item.techniques ?? []).map((technique) => `${item.page}\0${item.selector}\0${technique}`)));
let server;
let origin = "";
let syntheticServer;
if (realistic) {
  server = createServer((request, response) => {
    const name = new URL(request.url ?? "/", "http://fixture.local").pathname.replace(/^\//, "") || "index.html";
    if (!/^[a-z-]+\.html$/.test(name)) { response.writeHead(404); response.end("missing"); return; }
    void readFile(resolve(fixtureRoot, name)).then((body) => {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(body);
    }).catch(() => { response.writeHead(404); response.end("missing"); });
  });
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  origin = `http://127.0.0.1:${server.address().port}`;
} else {
  syntheticServer = await startFixtureServer();
  origin = syntheticServer.url;
}
const identity = (finding) => {
  const url = new URL(finding.url);
  const frameBoundary = finding.location.lastIndexOf(">>>");
  const selector = frameBoundary >= 0 ? finding.location.slice(frameBoundary + 3).trim() : finding.location;
  return `${url.pathname}${url.search}\0${selector}\0${finding.technique}`;
};
const official = (finding, siteOrigin) => {
  const url = new URL(finding.url);
  return {
    id: finding.id,
    url: url.origin === siteOrigin ? `<site>${url.pathname}${url.search}` : url.href,
    location: finding.location.replaceAll(siteOrigin, "<site>"),
    technique: finding.technique,
    evidenceText: finding.evidence_text,
  };
};
const rows = [];

try {
for (const concurrency of [1, 2, 3, 4]) {
  const siteOrigin = origin;
  const cpuStart = process.cpuUsage();
  const start = performance.now();
  let peakNodeRss = 0;
  const sample = setInterval(() => {
    peakNodeRss = Math.max(peakNodeRss, process.memoryUsage().rss);
  }, 50);
  let output;
  try {
    output = await scanSite(realistic ? {
      entryUrl: `${origin}/`,
      crawl: { concurrency, limits: { maxPages: 6, maxDepth: 2, timeoutSec: 90 }, settleMs: 1400, perPageMs: 10000 },
    } : {
      entryUrl: `${origin}/`,
      crawl: { concurrency, limits: { maxPages: 30, maxDepth: 4, timeoutSec: 300 }, settleMs: 1800, perPageMs: 20000 },
    });
  } finally {
    clearInterval(sample);
  }
  const wallSec = (performance.now() - start) / 1000;
  const cpu = process.cpuUsage(cpuStart);
  const got = new Set(output.result.findings.map(identity));
  const tp = [...got].filter((item) => expected.has(item)).length;
  rows.push({
    concurrency,
    wallSec: Number(wallSec.toFixed(3)),
    pagesPerSec: Number((output.detailBundle.coverage.checkedPages / wallSec).toFixed(3)),
    peakNodeRssMiB: Number((peakNodeRss / 1048576).toFixed(1)),
    nodeCpuPercent: Number((((cpu.user + cpu.system) / 1e6 / wallSec) * 100).toFixed(1)),
    attemptedPages: output.pagesVisited,
    checkedPages: output.detailBundle.coverage.checkedPages,
    failedPages: output.failedPages,
    tp,
    fp: got.size - tp,
    fn: expected.size - tp,
    validator: validateOfficialResultText(output.json).ok,
    officialFindingSet: output.result.findings.map((finding) => official(finding, siteOrigin)),
  });
}
} finally {
  if (server) await new Promise((resolveClose) => server.close(() => resolveClose()));
  if (syntheticServer) await syntheticServer.close();
}

const base = JSON.stringify(rows[0].officialFindingSet);
const equal = rows.every((row) => JSON.stringify(row.officialFindingSet) === base);
console.log(JSON.stringify({ scenario: realistic ? "L2 realistic" : "L1 synthetic", environment: { platform: process.platform, arch: process.arch, node: process.version }, rows, findingSetsEqual: equal }, null, 2));
const expectedFailedPages = realistic ? truth.expectedFailedPages : 0;
if (!equal || rows.some((row) => row.fp || row.fn || !row.validator || row.failedPages !== expectedFailedPages)) process.exitCode = 1;
