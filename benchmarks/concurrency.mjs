/** Repeatable L1 fixture benchmark for worker counts 1–4. Build packages first. */
import { performance } from "node:perf_hooks";
import { scanSite } from "../packages/detection/dist/scan.js";
import { loadGroundTruth } from "../packages/synth-eval/dist/evaluate.js";
import { validateOfficialResultText } from "../packages/contracts/dist/result.js";

const cases = (await loadGroundTruth()).filter((item) => item.kind === "positive");
const expected = new Set(cases.flatMap((item) =>
  (item.techniques ?? []).map((technique) => `${item.page}\0${item.selector}\0${technique}`),
));
const identity = (finding) => {
  const url = new URL(finding.url);
  const frameBoundary = finding.location.lastIndexOf(">>>");
  const selector = frameBoundary >= 0 ? finding.location.slice(frameBoundary + 3).trim() : finding.location;
  return `${url.pathname}${url.search}\0${selector}\0${finding.technique}`;
};
const official = (finding) => `${finding.id}\0${identity(finding)}`;
const rows = [];

for (const concurrency of [1, 2, 3, 4]) {
  const cpuStart = process.cpuUsage();
  const start = performance.now();
  let peakNodeRss = 0;
  const sample = setInterval(() => {
    peakNodeRss = Math.max(peakNodeRss, process.memoryUsage().rss);
  }, 50);
  let output;
  try {
    output = await scanSite({
      entryUrl: "/",
      topic: "synthetic-eval",
      fixturePort: 4200 + concurrency,
      crawl: {
        concurrency,
        limits: { maxPages: 30, maxDepth: 4, timeoutSec: 300 },
        settleMs: 1800,
        perPageMs: 20000,
      },
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
    pagesPerSec: Number((output.pagesVisited / wallSec).toFixed(3)),
    peakNodeRssMiB: Number((peakNodeRss / 1048576).toFixed(1)),
    nodeCpuPercent: Number((((cpu.user + cpu.system) / 1e6 / wallSec) * 100).toFixed(1)),
    checkedPages: output.pagesVisited,
    failedPages: output.failedPages,
    tp,
    fp: got.size - tp,
    fn: expected.size - tp,
    validator: validateOfficialResultText(output.json).ok,
    findingSet: output.result.findings.map(official).sort(),
  });
}

const base = JSON.stringify(rows[0].findingSet);
const equal = rows.every((row) => JSON.stringify(row.findingSet) === base);
for (const row of rows) delete row.findingSet;
console.log(JSON.stringify({ environment: { platform: process.platform, arch: process.arch, node: process.version }, rows, findingSetsEqual: equal }, null, 2));
if (!equal || rows.some((row) => row.fp || row.fn || !row.validator || row.failedPages)) process.exitCode = 1;
