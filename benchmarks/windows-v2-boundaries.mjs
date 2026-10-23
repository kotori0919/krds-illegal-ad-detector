/** Actual packaged-worker acceptance for capped single pass, frames and deadline. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { setTimeout, clearTimeout } from "node:timers";
import process from "node:process";
import { validateOfficialResultText, validateExtraResult } from "../packages/contracts/dist/result.js";
import { validateScanDetailBundle } from "../packages/contracts/dist/detail.js";

const runtime = resolve(process.argv[2] ?? "src-tauri/binaries");
const temporary = await mkdtemp(join(tmpdir(), "krds-v2-boundaries-"));
const siteRequests = new Map();
const frameRequests = new Map();
let frameOrigin;
const frame = createServer((request, response) => {
  frameRequests.set(request.url, (frameRequests.get(request.url) ?? 0) + 1);
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.end(request.url === "/outer"
    ? '<p id="outer-ad" style="display:none">카지노 첫충 보너스 지급</p><iframe src="/inner"></iframe>'
    : '<p id="inner-ad">Ｃ카지노 신규가입</p>');
});
const site = createServer((request, response) => {
  siteRequests.set(request.url, (siteRequests.get(request.url) ?? 0) + 1);
  if (request.url === "/slow") return;
  const pages = {
    "/": '<a href="/c">C</a><a href="/b">B</a><a href="/a">A</a>',
    "/a": `<p>Ｃ카지노 신규가입</p><iframe src="${frameOrigin}/outer"></iframe>`,
    "/b": '<p>Public service notice.</p>',
    "/c": '<p>Ｄ카지노 신규가입</p>',
    "/deadline": '<p>Ｃ카지노 신규가입</p><a href="/slow">Slow</a>',
  };
  const body = pages[request.url];
  response.setHeader("content-type", "text/html; charset=utf-8");
  setTimeout(() => response.end(body), request.url === "/a" ? 150 : 0);
});
await new Promise((done) => frame.listen(0, "127.0.0.1", done));
frameOrigin = `http://127.0.0.1:${frame.address().port}`;
await new Promise((done) => site.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${site.address().port}`;

async function run(concurrency, deadline = false) {
  siteRequests.clear(); frameRequests.clear();
  const prefix = join(temporary, deadline ? "deadline" : `c${concurrency}`);
  const start = performance.now();
  const child = spawn(process.execPath, [join(runtime, "scanner-worker-x86_64-pc-windows-gnu.mjs"),
    "--session", `boundary-${deadline ? "deadline" : concurrency}`, "--entry-url", origin + (deadline ? "/deadline" : "/"),
    "--concurrency", String(concurrency), "--settle-ms", "20", "--max-pages", deadline ? "2" : "3",
    "--max-depth", "1", "--timeout-sec", deadline ? "12" : "30",
    "--out-file", prefix + ".json", "--detail-out-file", prefix + "-detail.json", "--extra-out-file", prefix + "-extra.json"],
  { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  let stderr = "";
  child.stdout.resume();
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const guard = setTimeout(() => child.kill(), 35_000);
  try {
    const code = await new Promise((done, fail) => { child.once("error", fail); child.once("close", done); });
    assert.equal(code, 0, stderr.slice(-2000));
    const wallSec = (performance.now() - start) / 1000;
    const text = await readFile(prefix + ".json", "utf8");
    const official = JSON.parse(text);
    const detail = JSON.parse(await readFile(prefix + "-detail.json", "utf8"));
    const extra = JSON.parse(await readFile(prefix + "-extra.json", "utf8"));
    assert.equal(validateOfficialResultText(text).ok, true);
    assert.equal(validateExtraResult(extra).ok, true);
    assert.equal(validateScanDetailBundle(detail, official, extra).ok, true);
    assert.equal(detail.coverage.cancelled, false);
    if (deadline) {
      assert.equal(detail.coverage.timedOut, true);
      assert.equal(detail.coverage.checkedPages, 1);
      assert.equal(official.findings[0].evidence_text, "Ｃ카지노 신규가입");
      assert.equal(official.findings.length, 1);
      assert.equal(siteRequests.get("/deadline"), 1);
      assert.equal(siteRequests.get("/slow"), 1);
      assert.ok(wallSec < 20, "shared deadline must settle the hanging navigation");
    } else {
      assert.equal(detail.coverage.checkedPages, 3);
      assert.equal(detail.coverage.timedOut, false);
      assert.deepEqual([...siteRequests].sort(), [["/", 1], ["/a", 1], ["/b", 1]]);
      assert.deepEqual([...frameRequests].sort(), [["/inner", 1], ["/outer", 1]]);
      const outer = `iframe[src="${frameOrigin}/outer"]`;
      assert.deepEqual(official.findings.map((f) => [f.url, f.location, f.technique]).sort(), [
        [origin + "/a", "p", "HOMOGLYPH"],
        [frameOrigin + "/outer", outer + " >>> #outer-ad", "OFFSCREEN"],
        [frameOrigin + "/inner", outer + ` >>> iframe[src="${frameOrigin}/inner"] >>> #inner-ad`, "HOMOGLYPH"],
      ].sort());
    }
    return { concurrency, deadline, wallSec, findings: official.findings,
      coverage: detail.coverage, pageOutcomes: detail.pageOutcomes,
      siteRequests: [...siteRequests], frameRequests: [...frameRequests], passed: true };
  } finally { clearTimeout(guard); if (child.exitCode === null) child.kill(); }
}

try {
  const runs = [await run(1), await run(4), await run(1, true)];
  assert.deepEqual(runs[0].findings, runs[1].findings);
  assert.deepEqual(runs[0].pageOutcomes, runs[1].pageOutcomes);
  const report = { platform: process.platform, node: process.version, runs };
  console.log(JSON.stringify(report));
  if (process.argv[3]) await writeFile(resolve(process.argv[3]), JSON.stringify(report));
} finally {
  site.closeAllConnections(); frame.closeAllConnections();
  await Promise.all([new Promise((done) => site.close(done)), new Promise((done) => frame.close(done))]);
  await rm(temporary, { recursive: true, force: true });
}
