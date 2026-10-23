import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import console from "node:console";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { validateOfficialResultText } from "../packages/contracts/dist/result.js";
import { root, stage, workerName } from "./build-support.mjs";

const packaged=process.argv.includes("--packaged");
const temporary=await mkdtemp(join(tmpdir(),"krds integration 사용자 "));
const requests=[];
const server=createServer((request,response)=>{
  requests.push(request.url);
  response.writeHead(200,{"content-type":"text/html; charset=utf-8"});
  response.end('<!doctype html><html lang="ko"><body><p>도서 대출 기간은 14일입니다</p><p id="concealed" style="display:none">카지노 첫충 보너스 지급 신규가입</p></body></html>');
});
try {
  await new Promise(done=>server.listen(0,"127.0.0.1",done));
  const output=join(temporary,"result.json");
  const executable=packaged?join(stage,"node.exe"):process.execPath;
  const worker=packaged?join(stage,workerName):join(root,"packages/detection/dist/worker.js");
  const {stdout}=await promisify(execFile)(executable,[worker,"--session","integration-smoke","--entry-url",`http://127.0.0.1:${server.address().port}/`,
    "--max-pages","1","--max-depth","0","--timeout-sec","30","--settle-ms","20","--out-file",output],{
      timeout:45_000,maxBuffer:1_000_000,
      env:packaged||process.platform==="win32"?{...process.env,PLAYWRIGHT_BROWSERS_PATH:join(stage,"ms-playwright")}:process.env,
    });
  assert.equal(stdout,"");
  const bytes=await readFile(output);
  assert.notEqual(bytes.subarray(0,3).toString("hex"),"efbbbf");
  assert.equal(validateOfficialResultText(bytes.toString("utf8")).ok,true);
  const result=JSON.parse(bytes.toString("utf8"));
  assert.ok(result.findings.some(finding=>finding.technique==="OFFSCREEN" && finding.evidence_text.includes("카지노")));
  assert.ok(result.findings.every(finding=>!finding.evidence_text.includes("14일")));
  assert.equal(requests.filter(path=>path==="/").length,1);
  console.log(JSON.stringify({state:"observed",worker:packaged?"packaged":"built",officialFindings:result.findings.length,requests:requests.length,fixture:"loopback-only",sandbox:"production scanner launch; fail closed"}));
} finally {
  server.closeAllConnections();
  await new Promise(done=>server.close(done));
  await rm(temporary,{recursive:true,force:true});
}
