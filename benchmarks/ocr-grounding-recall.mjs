import { createServer } from "node:http";
import { performance } from "node:perf_hooks";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { scanSite } from "../packages/detection/dist/scan.js";
import { scanSite as beforeScan } from "../artifacts/ocr-grounding-20261021/baseline-runtime/scan.mjs";
import { validateScanDetailBundle } from "../packages/contracts/dist/index.js";
const base = "artifacts/ocr-grounding-20261021", previous = "artifacts/ocr-semantic-refinement-20261021", prior = "artifacts/ocr-gif-improvement-20261021", old = "artifacts/text-embedding-integration-20261021/holdout";
await mkdir(`${base}/runs`, {recursive:true});
const load = async (path, directory) => JSON.parse(await readFile(path,"utf8")).inputs.map(row => ({...row,path:`${directory}/${row.file}`}));
const mt = await load(`${old}/independent-manifest.json`,old), bt = await load(`${old}/manifest.json`,old);
const normals = await load(`${old}/text-sales-manifest.json`,old), fresh = await load(`${prior}/fresh/manifest.json`,`${prior}/fresh`), newFresh = await load(`${previous}/fresh/manifest.json`,`${previous}/fresh`), holdout = await load("artifacts/ocr-engine-comparison-20261021/fresh/manifest.json","artifacts/ocr-engine-comparison-20261021/fresh");
const latest = await load(`${base}/fresh/manifest.json`,`${base}/fresh`), derived = await load(`${base}/derived-banner-controls/manifest.json`,`${base}/derived-banner-controls`);
const verification = await load(`${base}/verification-normal/manifest.json`,`${base}/verification-normal`), verificationDerived = await load(`${base}/verification-normal/derived-manifest.json`,`${base}/verification-normal`);
const finalNormal = await load(`${base}/verification-normal/final-manifest.json`,`${base}/verification-normal`), finalDerived = await load(`${base}/verification-normal/final-derived-manifest.json`,`${base}/verification-normal`), finalLogos = await load(`${base}/verification-normal/logo-manifest.json`,`${base}/verification-normal`);
const original = await load("fixtures/real-banners/manifest.json","fixtures/real-banners");
const legacyRetail = JSON.parse(await readFile("artifacts/embeddinggemma2-eval-20261021/inputs.json","utf8"))
  .filter(row=>row.group==="additional-real-normal").map(row=>({...row,path:row.file,mediaType:"image/png"}));
const groups = {knownMt:mt.filter(x=>x.kind==="positive"),knownBlacktoon:[...original.filter(x=>x.kind==="positive").map((x,i)=>({...x,id:`original-${i+1}`})),...bt.filter(x=>x.kind==="positive")],
  knownNormal:[...mt.filter(x=>x.kind==="negative"),...normals],legacyResizedRetail:legacyRetail,
  priorPositive:fresh.filter(x=>x.kind==="positive"),priorNormal:fresh.filter(x=>x.kind==="negative"),
  newPositive:newFresh.filter(x=>x.kind==="positive"),
  newNormalPart1:newFresh.filter(x=>x.kind==="negative"&&x.mediaType!=="image/gif").slice(0,4),
  newNormalPart2:newFresh.filter(x=>x.kind==="negative"&&x.mediaType!=="image/gif").slice(4),
  newNormalGif:newFresh.filter(x=>x.kind==="negative"&&x.mediaType==="image/gif"),
  freshPositive:holdout.filter(x=>x.kind==="positive"),freshNormal:holdout.filter(x=>x.kind==="negative"),
  latestPositive:latest.filter(x=>x.kind==="positive"),latestNormal:latest.filter(x=>x.kind==="negative"),derivedPositive:derived.filter(x=>x.kind==="positive"),derivedNormal:derived.filter(x=>x.kind==="negative"),
  verificationNormal:verification,verificationDerivedNormal:verificationDerived,finalNormal,finalDerivedNormal:finalDerived,finalLogoControls:finalLogos,
  derivedGif:[{id:"brief-gray",path:"fixtures/ocr/brief-gray-offer.gif",kind:"positive",mediaType:"image/gif",expectedFrame:1},
    {id:"brief-late",path:"fixtures/ocr/brief-late-offer.gif",kind:"positive",mediaType:"image/gif",expectedFrame:4},
    {id:"bin-competition",path:`${prior}/gif-review/bin-competition.gif`,kind:"positive",mediaType:"image/gif",expectedFrame:1}]};
const development=process.argv.includes("--development");
const qualityOnly=process.argv.includes("--quality-only");
const verificationOnly=process.argv.includes("--verification-only"), timingOnly=process.argv.includes("--timing-only");
const timingGroups=["knownMt","latestPositive","latestNormal","verificationNormal"];
if(verificationOnly||timingOnly)for(const name of Object.keys(groups))if(!(verificationOnly?name.startsWith("verification"):timingGroups.includes(name)))delete groups[name];
if(development)for(const key of ["latestPositive","latestNormal","derivedPositive","derivedNormal","verificationNormal","verificationDerivedNormal","finalNormal","finalDerivedNormal","finalLogoControls"])delete groups[key];
const runsDirectory=development?"development-runs":verificationOnly?"verification-runs":timingOnly?"timing-runs":qualityOnly?"quality-runs":"runs";await mkdir(`${base}/${runsDirectory}`,{recursive:true});
const assets=new Map();
for(const group of Object.values(groups)) for(const item of group){const bytes=await readFile(item.path),sha256=createHash("sha256").update(bytes).digest("hex");if(item.sha256)assert.equal(sha256,item.sha256);if(item.inputSha256)assert.equal(sha256,item.inputSha256);item.inputSha256=sha256;
  if(!item.width||!item.height){if(bytes.subarray(1,4).toString()==="PNG"){item.width=bytes.readUInt32BE(16);item.height=bytes.readUInt32BE(20);}else if(bytes.subarray(0,3).toString()==="GIF"){item.width=bytes.readUInt16LE(6);item.height=bytes.readUInt16LE(8);}}
  assert.ok(item.width>0&&item.height>0,"Fixture must declare its actual dimensions before slow image loading");assert.ok(!assets.has(`/assets/${item.id}`),"Fixture IDs must be unique");
  assets.set(`/assets/${item.id}`,{bytes,mediaType:item.mediaType??(item.file?.endsWith(".jpg")?"image/jpeg":"image/png")});}
const server=createServer((request,response)=>{const asset=assets.get(request.url);if(asset){response.writeHead(200,{"content-type":asset.mediaType,"content-length":asset.bytes.length});response.end(asset.bytes);return;}
  const group=groups[request.url.slice(1,-1)];if(!group){response.writeHead(404);response.end();return;}response.writeHead(200,{"content-type":"text/html;charset=utf-8"});response.end(`<!doctype html><meta charset="utf-8"><style>a,img{display:block}</style>${group.map(item=>`<a href="https://observed-offer.example/"><img class="banner" id="${item.id}" width="${item.width}" height="${item.height}" src="/assets/${item.id}"></a>`).join("")}`);});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const launch=chromium.launch.bind(chromium);if(process.env.KRDS_TEST_UNSANDBOXED==="1")chromium.launch=options=>launch({...options,chromiumSandbox:false});
const runs=[];await mkdir(`${base}/warmup-runs`,{recursive:true});
try{for(const repetition of development||qualityOnly||verificationOnly?[1]:[0,1,2,3,4,5])for(const name of repetition===0?["knownMt"]:development||repetition===1?Object.keys(groups):timingGroups)for(const after of repetition%2?[false,true]:[true,false]){
  const t=performance.now();let officialAtMs, committed;const run=await(after?scanSite:beforeScan)({entryUrl:`http://127.0.0.1:${server.address().port}/${name}/`,commitOfficial:json=>{committed=json;officialAtMs=performance.now()-t;},crawl:{concurrency:1,settleMs:20,limits:{maxPages:1,maxDepth:0,timeoutSec:180}}});
  const elapsedMs=performance.now()-t;assert.deepEqual(validateScanDetailBundle(run.detailBundle,run.result,run.extraResult),{ok:true,errors:[]});assert.equal(run.result.findings.length,0);assert.equal(run.json,committed);
  const rows=groups[name].map(item=>{const analyses=run.detailBundle.imageAnalysis.filter(row=>row.location===`#${item.id}`);return{id:item.id,kind:item.kind,inputSha256:item.inputSha256,detected:analyses.some(row=>row.decision.passed&&(item.expectedFrame===undefined||row.animationFrame?.index===item.expectedFrame)),subclass:item.subclass??item.cohort,expectedFrame:item.expectedFrame,expectedFrameRetained:item.expectedFrame===undefined?undefined:analyses.some(row=>row.animationFrame?.index===item.expectedFrame),analyses};});
  const receipt={repetition,name,after,elapsedMs,officialAtMs,postOfficialMs:elapsedMs-officialAtMs,detected:rows.filter(x=>x.detected).length,labelled:rows.length,rows,coverage:run.detailBundle.visualAnalysisCoverage,analysisIssues:run.detailBundle.analysisIssues};
  await writeFile(`${base}/${repetition===0?"warmup-runs":runsDirectory}/${name}-${repetition}-${after?"after":"before"}.json`,JSON.stringify({...receipt,official:run.result,extra:run.extraResult},null,2)+"\n");if(repetition!==0)runs.push(receipt);console.log(JSON.stringify({repetition,name,after,detected:receipt.detected,labelled:rows.length,elapsedMs,alternativeRecords:rows.reduce((n,r)=>n+r.analyses.filter(x=>x.ocrAlternatives?.length).length,0),retainedExpectedFrames:rows.filter(x=>x.expectedFrameRetained).map(x=>x.id)}));
  const minimumPositive={knownMt:10,knownBlacktoon:18,priorPositive:9,newPositive:6,freshPositive:6,latestPositive:4,derivedPositive:4}[name];
  if(after && minimumPositive!==undefined)assert.ok(receipt.detected>=minimumPositive,"Positive recall gate failed; do not continue timing");
  if(after && rows.every(row=>row.kind==="negative"))assert.equal(receipt.detected,0,"Normal precision gate failed; do not continue timing");
  assert.equal(rows.filter(x=>x.analyses.length>0&&x.analyses.every(a=>a.ocr.state==="available")).length,rows.length,"Every input must be acquired+OCRcompleted before counting negatives");
}await writeFile(`${base}/${development?"development-observed.json":verificationOnly?"verification-observed.json":timingOnly?"timing-observed.json":qualityOnly?"quality-observed.json":"observed.json"}`,JSON.stringify({runs,protocol:"frozen-protocol.json",note:"REAL_PIXELS_CONTROLLED_EXTERNAL_LINK_REPLAY; newactualGIF separate; derivedGIF separate; labelsfrozenbeforeOCR; no remoteWindows/liveblockedsite evidence"},null,2)+"\n");}
finally{chromium.launch=launch;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
