import { createServer } from "node:http";
import { performance } from "node:perf_hooks";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { scanSite } from "../packages/detection/dist/scan.js";
import { scanSite as beforeScan } from "../artifacts/ocr-gif-improvement-20261021/baseline-runtime/scan.mjs";
import { validateScanDetailBundle } from "../packages/contracts/dist/index.js";
const base = "artifacts/ocr-gif-improvement-20261021", old = "artifacts/text-embedding-integration-20261021/holdout";
await mkdir(`${base}/runs`, {recursive:true});
const load = async (path, directory) => JSON.parse(await readFile(path,"utf8")).inputs.map(row => ({...row,path:`${directory}/${row.file}`}));
const mt = await load(`${old}/independent-manifest.json`,old), bt = await load(`${old}/manifest.json`,old);
const normals = await load(`${old}/text-sales-manifest.json`,old), fresh = await load(`${base}/fresh/manifest.json`,`${base}/fresh`);
const original = await load("fixtures/real-banners/manifest.json","fixtures/real-banners");
const groups = {knownMt:mt.filter(x=>x.kind==="positive"),knownBlacktoon:[...original.filter(x=>x.kind==="positive").map((x,i)=>({...x,id:`original-${i+1}`})),...bt.filter(x=>x.kind==="positive")],
  knownNormal:[...mt.filter(x=>x.kind==="negative"),...normals],freshPositive:fresh.filter(x=>x.kind==="positive"),freshNormal:fresh.filter(x=>x.kind==="negative"),
  derivedGif:[{id:"brief-gray",path:"fixtures/ocr/brief-gray-offer.gif",kind:"positive",mediaType:"image/gif",expectedFrame:1},
    {id:"brief-late",path:"fixtures/ocr/brief-late-offer.gif",kind:"positive",mediaType:"image/gif",expectedFrame:4},
    {id:"bin-competition",path:`${base}/gif-review/bin-competition.gif`,kind:"positive",mediaType:"image/gif",expectedFrame:1}]};
const normalGifDiagnostic=process.argv.includes("--normal-gif-diagnostic");
if(normalGifDiagnostic){for(const key of Object.keys(groups))delete groups[key];groups.normalDerivedGif=JSON.parse(await readFile(`${base}/derived-normal-gifs/manifest.json`,"utf8")).inputs;await mkdir(`${base}/normal-gif-runs`,{recursive:true});}
const runsDirectory=normalGifDiagnostic?"normal-gif-runs":"runs";
const assets=new Map();
for(const group of Object.values(groups)) for(const item of group){const bytes=await readFile(item.path),sha256=createHash("sha256").update(bytes).digest("hex");if(item.sha256)assert.equal(sha256,item.sha256);if(item.inputSha256)assert.equal(sha256,item.inputSha256);item.inputSha256=sha256;assets.set(`/assets/${item.id}`,{bytes,mediaType:item.mediaType??(item.file?.endsWith(".jpg")?"image/jpeg":"image/png")});}
const server=createServer((request,response)=>{const asset=assets.get(request.url);if(asset){response.writeHead(200,{"content-type":asset.mediaType,"content-length":asset.bytes.length});response.end(asset.bytes);return;}
  const group=groups[request.url.slice(1,-1)];if(!group){response.writeHead(404);response.end();return;}response.writeHead(200,{"content-type":"text/html;charset=utf-8"});response.end(`<!doctype html><meta charset="utf-8"><style>a,img{display:block}</style>${group.map(item=>`<a href="https://observed-offer.example/"><img class="banner" id="${item.id}" src="/assets/${item.id}"></a>`).join("")}`);});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const launch=chromium.launch.bind(chromium);if(process.env.KRDS_TEST_UNSANDBOXED==="1")chromium.launch=options=>launch({...options,chromiumSandbox:false});
const runs=[];
try{for(const repetition of [1,2,3])for(const name of Object.keys(groups))for(const after of repetition%2?[false,true]:[true,false]){
  const t=performance.now();let officialAtMs;const run=await(after?scanSite:beforeScan)({entryUrl:`http://127.0.0.1:${server.address().port}/${name}/`,commitOfficial:()=>{officialAtMs=performance.now()-t;},crawl:{concurrency:1,settleMs:20,limits:{maxPages:1,maxDepth:0,timeoutSec:180}}});
  const elapsedMs=performance.now()-t;assert.deepEqual(validateScanDetailBundle(run.detailBundle,run.result,run.extraResult),{ok:true,errors:[]});assert.equal(run.result.findings.length,0);
  const rows=groups[name].map(item=>{const analyses=run.detailBundle.imageAnalysis.filter(row=>row.location===`#${item.id}`);return{id:item.id,kind:item.kind,inputSha256:item.inputSha256,detected:analyses.some(row=>row.decision.passed),expectedFrame:item.expectedFrame,expectedFrameRetained:item.expectedFrame===undefined?undefined:analyses.some(row=>row.animationFrame?.index===item.expectedFrame),analyses};});
  assert.equal(rows.filter(x=>x.analyses.some(a=>a.ocr.state==="available")).length,rows.length,"Every input must be acquired+OCRcompleted before counting negatives");
  const receipt={repetition,name,after,elapsedMs,officialAtMs,postOfficialMs:elapsedMs-officialAtMs,detected:rows.filter(x=>x.detected).length,labelled:rows.length,rows,coverage:run.detailBundle.visualAnalysisCoverage,analysisIssues:run.detailBundle.analysisIssues};
  await writeFile(`${base}/${runsDirectory}/${name}-${repetition}-${after?"after":"before"}.json`,JSON.stringify({...receipt,official:run.result,extra:run.extraResult},null,2)+"\n");runs.push(receipt);console.log(JSON.stringify({repetition,name,after,detected:receipt.detected,labelled:rows.length,elapsedMs,alternativeRecords:rows.reduce((n,r)=>n+r.analyses.filter(x=>x.ocrAlternatives?.length).length,0),retainedExpectedFrames:rows.filter(x=>x.expectedFrameRetained).map(x=>x.id)}));
}await writeFile(`${base}/${normalGifDiagnostic?"normal-gif-observed.json":"observed.json"}`,JSON.stringify({runs,protocol:"frozen-protocol.json",note:"REAL_PIXELS_CONTROLLED_EXTERNAL_LINK_REPLAY; derivedGIF quality separate from actualads; no remoteWindows/liveblockedsite evidence"},null,2)+"\n");}
finally{chromium.launch=launch;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
