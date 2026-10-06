/** Real worker-process smoke against the municipal-style served fixture. */
import { execFile } from "node:child_process";
import { Buffer } from "node:buffer";
import { promisify } from "node:util";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateOfficialResultText } from "../packages/contracts/dist/result.js";
import { validateScanDetailBundle } from "../packages/contracts/dist/detail.js";

const run = promisify(execFile);
const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "../fixtures/realistic");
const truth = JSON.parse(await readFile(join(root, "ground-truth.json"), "utf8"));
const temporary = await mkdtemp(join(tmpdir(), "illegal-ad-worker-"));
const server = createServer((request, response) => {
  const name = new URL(request.url ?? "/", "http://fixture.local").pathname.replace(/^\//, "") || "index.html";
  if (!/^[a-z-]+\.html$/.test(name)) {
    response.writeHead(404);
    response.end("missing");
    return;
  }
  void readFile(join(root, name)).then((body) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(body);
  }).catch(() => {
    response.writeHead(404);
    response.end("missing");
  });
});

const findingKey = (finding) => {
  const boundary = finding.location.lastIndexOf(">>>");
  const selector = boundary >= 0 ? finding.location.slice(boundary + 3).trim() : finding.location;
  return `${new URL(finding.url).pathname}\0${selector}\0${finding.technique}`;
};

try {
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const resultFile = join(temporary, "result.json");
  const detailFile = join(temporary, "detail.json");
  const { stdout, stderr } = await run(process.execPath, [
    resolve(fileURLToPath(new URL(".", import.meta.url)), "../packages/detection/dist/worker.js"),
    "--session", "l3-worker-smoke",
    "--entry-url", `${origin}/`,
    "--topic", "municipal-style-fixture",
    "--max-pages", "6",
    "--max-depth", "2",
    "--timeout-sec", "90",
    "--settle-ms", "1400",
    "--out-file", resultFile,
    "--detail-out-file", detailFile,
  ], { maxBuffer: 2_000_000 });
  if (stdout.length !== 0) throw new Error("worker wrote non-result bytes to stdout");

  const officialBytes = await readFile(resultFile);
  const text = officialBytes.toString("utf8");
  if (officialBytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) throw new Error("official result contains BOM");
  const verdict = validateOfficialResultText(text);
  if (!verdict.ok) throw new Error(`official result invalid: ${verdict.errors.join("; ")}`);
  const official = JSON.parse(text);
  const detail = JSON.parse(await readFile(detailFile, "utf8"));
  const detailVerdict = validateScanDetailBundle(detail, official);
  if (!detailVerdict.ok) throw new Error(`detail bundle invalid: ${detailVerdict.errors.join("; ")}`);

  const expected = truth.positive.map((item) => `${item.page}\0${item.selector}\0${item.technique}`).sort();
  const actual = official.findings.map(findingKey).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("worker finding set differs from ground truth");
  if (detail.coverage.checkedPages !== truth.expectedCheckedPages
    || detail.coverage.failedPages.length !== truth.expectedFailedPages) {
    throw new Error("worker coverage differs from ground truth");
  }
  const progress = stderr.split(/\r?\n/).filter((line) => line.startsWith("KRDSPROGRESS "))
    .map((line) => JSON.parse(line.slice("KRDSPROGRESS ".length)));
  const finished = progress.findLast((event) => event.kind === "session-finished");
  if (!finished || finished.progress.visitedPages !== truth.expectedCheckedPages
    || finished.progress.confirmedFindings !== expected.length) {
    throw new Error("worker terminal progress differs from validated output");
  }
  let jpegCount = 0;
  for (const item of detail.findings) {
    if (item.visual.state !== "available") throw new Error(`real evidence unavailable for ${item.findingId}`);
    const bytes = Buffer.from(item.visual.dataUrl.split(",")[1], "base64");
    if (!bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) throw new Error("evidence is not JPEG");
    jpegCount += 1;
  }
  console.log(JSON.stringify({
    fixture: "municipal-style L3 worker process",
    officialFindings: actual.length,
    detailFindings: detail.findings.length,
    jpegEvidence: jpegCount,
    checkedPages: detail.coverage.checkedPages,
    failedPages: detail.coverage.failedPages.length,
    progressEvents: progress.length,
    terminalVisitedPages: finished.progress.visitedPages,
    officialValidator: verdict.ok,
    detailValidator: detailVerdict.ok,
  }, null, 2));
} finally {
  if (server.listening) await new Promise((done) => server.close(done));
  await rm(temporary, { recursive: true, force: true });
}
