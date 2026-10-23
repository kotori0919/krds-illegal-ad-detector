import { lstat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import console from "node:console";
import process from "node:process";
import { inventory, json, sha256, verifyFiles } from "./build-support.mjs";
import { installedExecutableIdentity } from "./nsis-identity.mjs";
const argument=process.argv[2];
if (!argument) throw new Error("Usage: npm run verify:artifact -- <manifest.json|installer.exe>");
const path=resolve(argument);
const directory=dirname(path);
const isManifest=path.endsWith(".json");
const manifest=await json(isManifest?path:join(directory,"manifest.json"));
if(manifest.schemaVersion!==1 || manifest.releaseStatus!=="candidate" || !manifest.source?.sourceSha256 || !manifest.signing) throw new Error("Unsupported or incomplete candidate manifest");
await verifyFiles(directory,manifest.files);
if (manifest.appVersion || manifest.lockfiles?.runtime) {
  const resourcePath=join(directory,"resources-manifest.json");
  if (!manifest.lockfiles?.runtime || await sha256(resourcePath)!==manifest.lockfiles.runtime) throw new Error("Runtime lock is not bound to this candidate");
  const runtime=await json(resourcePath);
  const required={
    "usque.exe":"122f2e40208e81bb814fcb4be4fbbbdc9246860f1f3784f72ae4512b97667e91",
    "usque-LICENSE.md":"b3e9fec720528afc8d92644ee0ec9b2659324970dea9d34d8c547c783124fd4b",
  };
  if(runtime.schemaVersion!==1 || runtime.sources?.usque?.version!=="4.2.1"
    || runtime.sources.usque.commit!=="6aa03fc97d12848dce34eedbd187fb1077b5d1ea"
    || runtime.sources.usque.url!=="https://github.com/Diniboy1123/usque/releases/download/v4.2.1/usque_4.2.1_windows_amd64.zip"
    || runtime.sources.usque.archiveSha256!=="f6f7f0a1a2bc9bcc15cf563ec1f892d00690a92c086b23ed3211b802209099e7"
    || Object.entries(required).some(([path,hash])=>!runtime.files?.some(file=>file.path===path && file.sha256===hash))) throw new Error("Pinned WARP resources missing from candidate runtime");
}
if(JSON.stringify(await inventory(directory,name=>name==="manifest.json"))!==JSON.stringify(manifest.files)) throw new Error("Unexpected candidate files");
if(manifest.installedExecutable){
  const identity=await installedExecutableIdentity(join(directory,"krds-detector.exe"),manifest.tools.tauri);
  if(JSON.stringify(identity)!==JSON.stringify(manifest.installedExecutable))throw new Error("Installed executable identity does not match this unsigned NSIS profile");
}else if(manifest.appVersion==="0.2.1")throw new Error("Current candidate requires installed executable identity");
if(!isManifest) {
  const expected=manifest.files.find(file=>resolve(directory,file.path)===path);
  if(!expected || (await lstat(path)).isSymbolicLink() || await sha256(path)!==expected.sha256) throw new Error("Artifact is not bound to the candidate manifest");
}
console.log(JSON.stringify({state:"verified",source:{commit:manifest.source.commit,sourceSha256:manifest.source.sourceSha256,dirty:manifest.source.dirty},target:manifest.target,appVersion:manifest.appVersion,
  files:manifest.files.length,signing:manifest.signing,notice:"Hashes check integrity; they do not authenticate a publisher"},null,2));
