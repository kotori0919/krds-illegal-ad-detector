import { lstat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import console from "node:console";
import process from "node:process";
import { inventory, json, sha256, verifyFiles } from "./build-support.mjs";
const argument=process.argv[2];
if (!argument) throw new Error("Usage: npm run verify:artifact -- <manifest.json|installer.exe>");
const path=resolve(argument);
const directory=dirname(path);
const isManifest=path.endsWith(".json");
const manifest=await json(isManifest?path:join(directory,"manifest.json"));
if(manifest.schemaVersion!==1 || manifest.releaseStatus!=="candidate" || !manifest.source?.sourceSha256 || !manifest.signing) throw new Error("Unsupported or incomplete candidate manifest");
await verifyFiles(directory,manifest.files);
if(JSON.stringify(await inventory(directory,name=>name==="manifest.json"))!==JSON.stringify(manifest.files)) throw new Error("Unexpected candidate files");
if(!isManifest) {
  const expected=manifest.files.find(file=>resolve(directory,file.path)===path);
  if(!expected || (await lstat(path)).isSymbolicLink() || await sha256(path)!==expected.sha256) throw new Error("Artifact is not bound to the candidate manifest");
}
console.log(JSON.stringify({state:"verified",source:{commit:manifest.source.commit,sourceSha256:manifest.source.sourceSha256,dirty:manifest.source.dirty},target:manifest.target,appVersion:manifest.appVersion,
  files:manifest.files.length,signing:manifest.signing,notice:"Hashes check integrity; they do not authenticate a publisher"},null,2));
