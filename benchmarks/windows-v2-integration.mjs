/** Narrow packaged-runtime smoke: live non-ID detection, offline OCR, cancellation. */
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import process from "node:process";
import { setTimeout, clearTimeout } from "node:timers";

const runtime = resolve(process.argv[2] ?? "src-tauri/binaries");
const image = await readFile(resolve(process.argv[3] ?? "fixtures/ocr/banner.png"));
const temporary = await mkdtemp(join(tmpdir(), "illegal-ad-v2-integration-"));
const server = createServer((request, response) => {
  if (request.url === "/slow") return; // cancelled navigation closes the socket
  if (request.url === "/banner.png") {
    response.writeHead(200, { "content-type": "image/png", "content-length": image.length });
    response.end(image); return;
  }
  response.setHeader("content-type", "text/html; charset=utf-8");
  const next = request.url === "/cancel" ? '<a href="/slow">next</a>' : "";
  response.end('<p style="opacity:0">카지노 가입 보너스 지급</p><p>카\u200B지\u200B노 신규가입</p><img class="ad" src="/banner.png">' + next);
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;

function descendants(pid) {
  if (process.platform !== "win32") return [pid];
  const text = execFileSync("powershell.exe", ["-NoProfile", "-Command",
    "Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId | ConvertTo-Json -Compress"], { encoding: "utf8" });
  const all = JSON.parse(text);
  const found = new Set([pid]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of all) if (found.has(item.ParentProcessId) && !found.has(item.ProcessId)) { found.add(item.ProcessId); changed = true; }
  }
  return [...found];
}

async function run(cancel) {
  const prefix = join(temporary, cancel ? "cancelled" : "completed");
  const child = spawn(process.execPath, [join(runtime, "scanner-worker-x86_64-pc-windows-gnu.mjs"),
    "--session", cancel ? "cancel-smoke" : "ocr-smoke", "--entry-url", origin + (cancel ? "/cancel" : "/"),
    "--settle-ms", "20", "--concurrency", "1", "--timeout-sec", "30", "--max-pages", cancel ? "2" : "1",
    "--out-file", prefix + ".json", "--detail-out-file", prefix + "-detail.json", "--extra-out-file", prefix + "-extra.json"],
  { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
  let buffer = "";
  let sent = false;
  let tracked = [child.pid];
  child.stdout.resume();
  child.stderr.on("data", (part) => {
    buffer += part.toString();
    let index;
    while ((index = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, index); buffer = buffer.slice(index + 1);
      if (!line.startsWith("KRDSPROGRESS ")) continue;
      const event = JSON.parse(line.slice(13));
      if (cancel && !sent && event.kind === "page-started" && event.pageUrl.endsWith("/slow")) {
        sent = true;
        tracked = descendants(child.pid);
        child.stdin.end('{"type":"cancel"}\n');
      }
    }
  });
  const guard = setTimeout(() => child.kill(), 35_000);
  try {
    const exit = await new Promise((done, fail) => { child.once("error", fail); child.once("close", done); });
    assert.equal(exit, 0, "worker must settle and serialize all artifacts");
    const official = JSON.parse(await readFile(prefix + ".json", "utf8"));
    const detail = JSON.parse(await readFile(prefix + "-detail.json", "utf8"));
    const extra = JSON.parse(await readFile(prefix + "-extra.json", "utf8"));
    assert.equal(official.meta.topic, "TOPIC");
    assert.deepEqual(official.findings.map((finding) => [finding.technique, finding.evidence_text]), [["TRANSPARENT", "카지노 가입 보너스 지급"]]);
    assert.equal(extra.findings.filter((finding) => finding.extra_finding === "ZERO_WIDTH_OBFUSCATION").length, 1);
    assert.equal(detail.coverage.checkedPages, 1);
    assert.equal(detail.coverage.cancelled, cancel);
    assert.equal(detail.pageOutcomes.filter((page) => page.outcome === "checked").length, 1);
    const analysis = detail.imageAnalysis[0];
    if (analysis.ocr.state === "available") {
      assert.ok(analysis.ocr.text.replace(/\s/g, "").includes("카지노가입보너스지급"));
      assert.equal(analysis.decision.passed, true);
    } else {
      assert.equal(cancel, true, "completed scans must execute real OCR");
      assert.equal(analysis.ocr.reason, "budget", "interrupted OCR must be reported as incomplete");
      assert.equal(analysis.decision.passed, false);
    }
    if (cancel) {
      assert.equal(sent, true);
      assert.equal(detail.coverage.timedOut, false);
      for (const pid of tracked) {
        if (process.platform === "win32") {
          const found = execFileSync("tasklist.exe", ["/FI", `PID eq ${pid}`, "/NH", "/FO", "CSV"], { encoding: "utf8" });
          assert.ok(!found.includes(`"${pid}"`), `worker descendant ${pid} must be reaped`);
        }
      }
    }
    return { cancelled: cancel, findings: official.findings.length, extraFindings: extra.findings.length,
      coverage: detail.coverage, backend: analysis.ocr.backend, ocrText: analysis.ocr.text,
      confidence: analysis.ocr.confidence, trackedProcesses: tracked.length, passed: true };
  } finally { clearTimeout(guard); if (child.exitCode === null) child.kill(); }
}

try {
  const report = { platform: process.platform, node: process.version, runs: [await run(false), await run(true)] };
  console.log(JSON.stringify(report, null, 2));
  if (process.argv[4]) await writeFile(resolve(process.argv[4]), JSON.stringify(report));
} finally {
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
  await rm(temporary, { recursive: true, force: true });
}
