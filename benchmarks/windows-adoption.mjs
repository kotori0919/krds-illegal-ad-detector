/** Installed Windows adoption path. Real Tauri IPC/worker/files; no IPC replay. */
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { performance } from "node:perf_hooks";
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { chromium } from "playwright-core";
import { validateOfficialResultText } from "../packages/contracts/dist/result.js";

if(process.platform!=="win32")throw Error("Run on the authorized Windows test machine");
const executable=resolve(process.argv[2]);
const output=resolve(process.argv[3]);
await mkdir(output,{recursive:true});
const image=await readFile(new URL("../fixtures/ocr/banner.png",import.meta.url));
let requests=0;
const fixture=createServer((request,response)=>{
  requests++;
  if(request.url==="/banner.png"){response.writeHead(200,{"content-type":"image/png"});response.end(image);return;}
  if(request.url==="/missing"){globalThis.setTimeout(()=>{response.writeHead(404);response.end("missing");},3000);return;}
  response.setHeader("content-type","text/html; charset=utf-8");
  response.end('<!doctype html><html lang="ko"><p>도서 대출 기간은 14일입니다.</p><p id="hidden" style="opacity:0">카지노 첫충 보너스 지급</p><p id="latin">ＣＡＳＩＮＯ 신규가입 보너스</p><img class="ad" src="/banner.png"><a href="/missing">확인할 수 없는 페이지</a></html>');
});
await new Promise(done=>fixture.listen(0,"127.0.0.1",done));
const entry=`http://127.0.0.1:${fixture.address().port}/`;
const pause=ms=>new Promise(done=>globalThis.setTimeout(done,ms));
let app,browser,page;
async function launch(){
  app=spawn(executable,[],{stdio:"ignore",env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:"--remote-debugging-port=9222 --remote-debugging-address=127.0.0.1"}});
  for(let i=0;i<120;i++){try{if((await globalThis.fetch("http://127.0.0.1:9222/json/version")).ok)break;}catch{/* WebView is still starting. */}await pause(250);}
  browser=await chromium.connectOverCDP("http://127.0.0.1:9222");
  page=browser.contexts()[0].pages()[0];page.setDefaultTimeout(20000);
  await page.getByLabel("점검할 웹사이트",{exact:true}).waitFor();
}
async function close(){
  await browser?.close();browser=undefined;
  if(app?.exitCode===null){
    execFileSync("powershell.exe",["-NoProfile","-Command",`$p=Get-Process -Id ${app.pid} -ErrorAction Stop; $p.CloseMainWindow() | Out-Null`]);
    for(let i=0;i<80&&app.exitCode===null;i++)await pause(100);
    assert.notEqual(app.exitCode,null,"normal close must settle process and release storage lock");
  }
}
const invoke=(command,args={})=>page.evaluate(({command,args})=>window.__TAURI_INTERNALS__.invoke(command,args),{command,args});
const report={scope:"installed native Windows UI + worker + filesystem + restart, no fabricated IPC responses",checks:[]};
try{
  report.appSha256=createHash("sha256").update(await readFile(executable)).digest("hex");
  report.build=JSON.parse(await readFile(join(dirname(executable),"binaries/build-manifest.json"),"utf8"));
  await launch();
  await page.evaluate(async()=>{
    const api=window.__TAURI_INTERNALS__;window.adoptionEvents=[];
    const handler=api.transformCallback(event=>window.adoptionEvents.push(event.payload));
    await api.invoke("plugin:event|listen",{event:"scan-event",target:{kind:"Any"},handler});
  });
  await page.getByLabel("점검할 웹사이트",{exact:true}).fill(entry);
  await page.locator("summary").first().click();
  await page.getByLabel("직접 설정",{exact:true}).check();
  await page.getByLabel("최대 페이지 수",{exact:true}).fill("2");
  await page.getByLabel("탐색 깊이",{exact:true}).fill("1");
  await page.getByLabel("제한 시간(초)",{exact:true}).fill("60");
  const uiStarted=performance.now();
  await page.getByRole("button",{name:"점검 시작",exact:true}).click();
  let renderers=[];
  for(let attempt=0;attempt<10&&!renderers.length;attempt++){
    await pause(150);
    const bytes=execFileSync("powershell.exe",["-NoProfile","-File",resolve("benchmarks/windows-sandbox-probe.ps1"),"-RuntimeRoot",join(dirname(executable),"binaries")],{encoding:"utf8"});
    renderers=JSON.parse(bytes.replace(/^\uFEFF/,"").trim());
  }
  assert.ok(renderers.length>0,"must observe a real scanner renderer");
  assert.ok(renderers.every(row=>!row.noSandbox&&row.integrityRid>=0&&row.integrityRid<=4096),"renderer must run at low/untrusted Windows integrity without no-sandbox");
  report.sandbox={productionLaunch:true,renderers};
  await page.getByRole("heading",{name:"점검 결과",exact:true}).waitFor({timeout:90000});
  report.uiStartToExportableMs=performance.now()-uiStarted;
  const id=await page.evaluate(()=>window.adoptionEvents.at(-1).sessionId);
  report.caseId=id;
  const result=await invoke("scan_get_result",{sessionId:id});
  assert.equal(validateOfficialResultText(JSON.stringify(result)).ok,true);
  assert.ok(result.findings.some(f=>f.technique==="HOMOGLYPH"));
  assert.ok(result.findings.some(f=>f.technique==="TRANSPARENT"));
  assert.ok(result.findings.every(f=>!f.evidence_text.includes("14일")));
  const coverage=await invoke("scan_get_coverage",{sessionId:id});
  assert.equal(coverage.coverage.checkedPages,1);assert.equal(coverage.coverage.failedPages.length,1);
  const summary=await invoke("scan_get_evidence_summary",{sessionId:id});
  const analyses=await invoke("scan_get_image_analysis",{sessionId:id,query:{limit:24}});
  assert.ok(analyses.items.some(a=>a.ocr.state==="available"),"offline bundled OCR must run");
  const opened=await invoke("case_open",{caseId:id});
  const original=await readFile(join(opened.directory,"result.json"));
  report.officialSha256=createHash("sha256").update(original).digest("hex");
  assert.equal(report.officialSha256,opened.manifest.officialSha256);
  report.findings=result.findings.length;report.coverage=coverage.coverage;report.optionalIssues=opened.manifest.issues;
  report.checks.push("real single scan / contrasting library negative / failed-page coverage / bundled OCR / durable original");
  await page.getByRole("button",{name:"근거 보기",exact:true}).first().click();
  await page.getByLabel("검토 메모",{exact:true}).fill("인수 검증 메모 =1+1");
  await page.getByLabel("담당자의 판단",{exact:true}).selectOption("needs-more-evidence");
  await page.getByRole("button",{name:"검토 완료로 표시",exact:true}).click();
  await page.getByText(/검토 기록 저장됨/).waitFor();
  const review=await invoke("case_open",{caseId:id});
  assert.ok(review.review.records.some(r=>r.note==="인수 검증 메모 =1+1"&&r.judgment==="needs-more-evidence"&&r.state==="reviewed"));
  await page.screenshot({path:join(output,"native-case-review.png"),fullPage:true});
  await close();
  const before=requests;
  await launch();
  await page.getByRole("button",{name:new RegExp(`^케이스 다시 열기.*${entry.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}`)}).click();
  await page.getByRole("button",{name:"근거 보기",exact:true}).first().click();
  assert.equal(await page.getByLabel("검토 메모",{exact:true}).inputValue(),"인수 검증 메모 =1+1");
  assert.equal(await page.getByLabel("담당자의 판단",{exact:true}).inputValue(),"needs-more-evidence");
  await page.getByRole("button",{name:"검토 완료 취소",exact:true}).waitFor();
  assert.equal(requests,before,"reopening must not recrawl");
  report.checks.push("normal close / fresh process / memo+judgment+reading restored / no recrawl");
  await invoke("scan_export",{sessionId:id,directory:output});
  assert.deepEqual(await readFile(join(output,"result.json")),original);
  assert.deepEqual(await readFile(join(opened.directory,"result.json")),original);
  report.summary={graphAvailable:summary.graphAvailable,assets:JSON.parse(await readFile(join(opened.directory,"evidence.json"),"utf8")).assets};
  // Exercise the real save chooser through Windows input; no fabricated native result.
  await page.getByRole("button",{name:"엑셀 보고서 저장",exact:true}).click();
  await pause(1000);
  const workbook=join(output,"native-review.xlsx");
  const encoded=Buffer.from(`$w=New-Object -ComObject WScript.Shell; $w.AppActivate(${app.pid}) | Out-Null; Start-Sleep -Milliseconds 300; $w.SendKeys('^a'); $w.SendKeys('${workbook.replace(/'/g,"''")}'); $w.SendKeys('{ENTER}')`,"utf16le").toString("base64");
  execFileSync("powershell.exe",["-NoProfile","-EncodedCommand",encoded]);
  await page.getByText(/엑셀 보고서 저장 완료:/).waitFor();
  report.workbookBytes=(await readFile(workbook)).length;
  report.checks.push("real native JSON export byte identity / real workbook save chooser");
  await page.screenshot({path:join(output,"native-case-reopened.png"),fullPage:true});
  report.passed=true;
}catch(error){report.passed=false;report.error=String(error);process.exitCode=1;}
finally{
  await close().catch(error=>{report.closeError=String(error);process.exitCode=1;});
  fixture.closeAllConnections();await new Promise(done=>fixture.close(done));
  await writeFile(join(output,"native-adoption.json"),JSON.stringify(report,null,2));
  process.stdout.write(JSON.stringify({passed:report.passed,error:report.error,checks:report.checks,findings:report.findings,workbookBytes:report.workbookBytes})+"\n");
}
