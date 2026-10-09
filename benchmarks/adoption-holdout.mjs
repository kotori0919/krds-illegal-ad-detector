/** Authored holdout; no detector policy or network bypass is defined here. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import console from "node:console";
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import process from "node:process";
import { setInterval, clearInterval } from "node:timers";
import { fileURLToPath } from "node:url";

const root=resolve(fileURLToPath(new URL("..",import.meta.url)));
const fixtureRoot=join(root,"packages/synth-eval/test/holdout");
const techniques=["HOMOGLYPH","JAMO","TRANSPARENT","OFFSCREEN"];

function linuxTreeRss(rootPid) {
  if(process.platform!=="linux") return undefined;
  const rows=execFileSync("ps",["-eo","pid=,ppid=,rss=,comm="],{encoding:"utf8"}).trim().split("\n").map(line=>line.trim().split(/\s+/));
  const owned=new Set([rootPid]);
  for(let round=0;round<32;round++) {
    const before=owned.size;
    for(const [pid,parent,,command] of rows) if(owned.has(Number(parent))&&command!=="ps") owned.add(Number(pid));
    if(before===owned.size) break;
  }
  return rows.reduce((sum,[pid,,rss])=>sum+(owned.has(Number(pid))?Number(rss)*1024:0),0);
}

export async function runHoldout({scanSite,chromium,resolveFrameLocation,outputPath,testSandboxException=false}) {
  const manifest=JSON.parse(await readFile(join(fixtureRoot,"manifest.json"),"utf8"));
  const rows=[];
  const failures=[];
  for(const concurrency of [1,3]) for(const site of manifest.sites) {
    const html=await readFile(join(fixtureRoot,site.file),"utf8");
    const server=createServer((_request,response)=>{response.writeHead(200,{"content-type":"text/html;charset=utf-8"});response.end(html);});
    await new Promise(done=>server.listen(0,"127.0.0.1",done));
    const entryUrl=`http://127.0.0.1:${server.address().port}/`;
    let peak=linuxTreeRss(process.pid);
    const sampler=setInterval(()=>{const rss=linuxTreeRss(process.pid);if(rss!==undefined)peak=Math.max(peak??0,rss);},100);
    const start=performance.now();
    let browser;
    try {
      const output=await scanSite({entryUrl,crawl:{concurrency,limits:{maxPages:1,maxDepth:0,timeoutSec:30},settleMs:20}});
      const scanWallSec=(performance.now()-start)/1000;
      const byTechnique=Object.fromEntries(techniques.map(technique=>[technique,{tp:0,fp:0,fn:0}]));
      const expected=new Set(site.expected.map(item=>`${item.selector}\0${item.technique}`));
      const found=new Set(output.result.findings.map(finding=>`${finding.location}\0${finding.technique}`));
      for(const item of expected) byTechnique[item.split("\0")[1]][found.has(item)?"tp":"fn"]++;
      for(const item of found) if(!expected.has(item)) byTechnique[item.split("\0")[1]].fp++;
      const locatorStart=performance.now();
      browser=await chromium.launch({chromiumSandbox:true});
      const page=await browser.newPage();
      await page.goto(entryUrl);
      let resolved=0;
      for(const finding of output.result.findings) {
        try {
          const element=await resolveFrameLocation(page,finding.location);
          const observed=await element.textContent();
          await element.dispose();
          if(observed?.includes(finding.evidence_text)) resolved++;
        } catch(error) { failures.push({site:site.id,code:"LOCATOR_RESOLUTION",message:error.message}); }
      }
      const row={site:site.id,templateId:site.templateId,creativeId:site.creativeId,concurrency,runState:rows.length?"subsequent":"first-in-process",
        byTechnique,checkedPages:output.detailBundle.coverage.checkedPages,failedPages:output.failedPages,
        timedOut:output.timedOut,locatorResolved:resolved,locatorTotal:output.result.findings.length,
        scanWallSec:Number(scanWallSec.toFixed(3)),locatorWallSec:Number(((performance.now()-locatorStart)/1000).toFixed(3)),
        peakTreeRssMiB:peak===undefined?null:Number((peak/1048576).toFixed(1)),officialFindingSet:[...found].sort()};
      rows.push(row);
    } finally {
      clearInterval(sampler);
      if(browser) await browser.close();
      server.closeAllConnections();
      await new Promise(done=>server.close(done));
    }
  }
  const summary=Object.fromEntries(techniques.map(technique=>{
    const total=rows.filter(row=>row.concurrency===1).reduce((sum,row)=>({tp:sum.tp+row.byTechnique[technique].tp,fp:sum.fp+row.byTechnique[technique].fp,fn:sum.fn+row.byTechnique[technique].fn}),{tp:0,fp:0,fn:0});
    return [technique,{...total,precision:total.tp+total.fp?total.tp/(total.tp+total.fp):null,recall:total.tp+total.fn?total.tp/(total.tp+total.fn):null}];
  }));
  const equivalent=manifest.sites.every(site=>{
    const pair=rows.filter(row=>row.site===site.id);
    return JSON.stringify(pair[0].officialFindingSet)===JSON.stringify(pair[1].officialFindingSet);
  });
  const report={schemaVersion:1,dataset:manifest.datasetVersion,environment:{platform:process.platform,node:process.version},testSandboxException,
    evidenceScope:"Actual canonical scan analysis/finalization and a separate controlled-fixture locator round trip; excludes native persistence/UI/save-dialog time",
    memoryMethod:process.platform==="linux"?"100ms ps process-tree summed RSS includes harness/browser/OCR; shared pages may be counted more than once; peaks can be missed":"NOT_RUN: Linux ps collector unavailable; no substitute process-only claim",
    independentSiteTemplateCreativeUnits:manifest.sites.length,metricsFromConcurrency:1,summary,
    normalPages:{checked:rows.filter(row=>row.concurrency===1&&manifest.sites.find(site=>site.id===row.site).expected.length===0).length,
      falsePositiveFindings:rows.filter(row=>row.concurrency===1&&manifest.sites.find(site=>site.id===row.site).expected.length===0).reduce((sum,row)=>sum+row.locatorTotal,0)},
    concurrencyScope:"Each authored site is one page; equivalence here does not exercise parallel scheduling or establish a throughput gain",equivalent,rows,failures,
    passed:equivalent&&failures.length===0&&rows.every(row=>row.checkedPages===1&&!row.failedPages&&!row.timedOut&&row.locatorResolved===row.locatorTotal)&&Object.values(summary).every(row=>row.fp===0&&row.fn===0)};
  if(outputPath) await writeFile(outputPath,JSON.stringify(report,null,2)+"\n");
  return report;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const [{scanSite},{chromium},{resolveFrameLocation}]=await Promise.all([import("../packages/detection/dist/scan.js"),import("playwright-core"),import("../packages/scanner/dist/frame-location.js")]);
  const report=await runHoldout({scanSite,chromium,resolveFrameLocation,outputPath:process.argv[2]});
  console.log(JSON.stringify(report,null,2));
  assert.equal(report.passed,true,"Holdout failed; do not tune against it without reclassifying as regression");
}
