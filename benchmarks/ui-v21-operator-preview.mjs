/** Explicit offline operator test surface; never scans or serves source files. */
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { initialProgress, serializeOfficialResult } from "../packages/contracts/dist/index.js";

const output = "/tmp/illegal-ad-v21-operator";
await mkdir(output, { recursive: true });
const result = JSON.parse(await readFile("packages/evidence/test/fixtures/sample_result_617_sanitized.json", "utf8"));
const token = randomUUID();
const session = { id: "offline-617", entryUrl: result.meta.entry_url, status: "succeeded", hasResult: true,
  startedAt: result.meta.started_at, finishedAt: result.meta.finished_at, progress: initialProgress("succeeded") };
const script = `<script>window.__TAURI_INTERNALS__={transformCallback:()=>1,unregisterCallback:()=>{},invoke:async(command,args)=>{
const response=await fetch('/ipc',{method:'POST',headers:{'Content-Type':'application/json','X-Preview-Token':${JSON.stringify(token)}},body:JSON.stringify({command,args})});
if(!response.ok)throw new Error('Offline preview operation failed');return(await response.json()).value;}};</script>`;
const server = createServer((request, response) => {
  const pathname = new URL(request.url, "http://preview.invalid").pathname;
  if (request.method === "POST" && pathname === "/ipc") {
    if (request.headers["x-preview-token"] !== token) { response.writeHead(403); response.end(); return; }
    let size = 0; const chunks = [];
    request.on("data", (chunk) => { size += chunk.length; if (size > 24 * 1024 * 1024) request.destroy(); else chunks.push(chunk); });
    request.on("end", () => { void (async () => {
      const { command, args = {} } = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      let value;
      if (command === "plugin:event|listen") value = 1;
      else if (command === "plugin:event|unlisten") value = undefined;
      else if (command === "scan_start" || command === "scan_get_session") value = session;
      else if (command === "scan_get_result") value = result;
      else if (command.startsWith("scan_get_")) value = undefined;
      else if (command === "scan_export") {
        await writeFile(`${output}/result.json`, serializeOfficialResult(result)); value = { resultJson: `${output}/result.json` };
      } else if (command === "scan_export_workbook") {
        if (!Array.isArray(args.data) || args.data.length > 24 * 1024 * 1024 || args.sessionIds?.join() !== session.id) throw new Error("invalid report");
        await writeFile(`${output}/report.xlsx`, Buffer.from(args.data)); value = `${output}/report.xlsx`;
      } else throw new Error("unsupported offline operation");
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" }); response.end(JSON.stringify({ value }));
    })().catch(() => { response.writeHead(400); response.end(); }); }); return;
  }
  if (request.method !== "GET" || !/^[a-zA-Z0-9._/-]*$/.test(pathname) || pathname.split("/").includes("..")) { response.writeHead(404); response.end(); return; }
  const name = pathname.slice(1) || "index.html";
  void readFile(resolve("apps/web/dist", name)).then((bytes) => {
    if (name === "index.html") bytes = Buffer.from(bytes.toString().replace("<head>", `<head>${script}`).replace("<body>", '<body><aside style="padding:12px;background:#f4f5f6">617건 오프라인 회귀 자료입니다. 사이트에는 연결하지 않으며 저장은 로컬 검증 폴더에 합니다.</aside>'));
    response.writeHead(200, { "Content-Type": { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css" }[extname(name)] ?? "application/octet-stream" }); response.end(bytes);
  }).catch(() => { response.writeHead(404); response.end(); });
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const address = `http://127.0.0.1:${server.address().port}`;
await writeFile(`${output}/preview.json`, JSON.stringify({ pid: process.pid, address, output, mode: "explicit offline fixture; harness export, not Windows native Save As" }));
console.log(JSON.stringify({ address, output }));
