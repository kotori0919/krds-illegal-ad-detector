import { execFileSync } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { inventory, json, root, writeJson } from "./build-support.mjs";

const output=resolve(process.argv[2]??join(root,"artifacts/supply-chain"));
await mkdir(output,{recursive:true});
if(!process.env.npm_execpath) throw new Error("Run supply-chain generation through npm");
const npmSbom=execFileSync(process.execPath,[process.env.npm_execpath,"sbom","--sbom-format=cyclonedx","--package-lock-only","--omit=dev"],{cwd:root,maxBuffer:30_000_000});
await writeFile(join(output,"sbom-npm.cdx.json"),npmSbom);
const target=process.env.KRDS_WINDOWS_TARGET??(process.platform==="win32"?"x86_64-pc-windows-msvc":"x86_64-pc-windows-gnullvm");
const cargo=JSON.parse(execFileSync("cargo",["metadata","--locked","--offline","--filter-platform",target,"--format-version=1","--manifest-path",join(root,"src-tauri/Cargo.toml")],{cwd:root,maxBuffer:30_000_000,encoding:"utf8"}));
await writeJson(join(output,"cargo-license-inventory.json"),{schemaVersion:1,
  scope:"locked dependency graph; includes platform/build inputs, not a claim all crates are shipped",packages:cargo.packages.map(pkg=>({name:pkg.name,version:pkg.version,source:pkg.source,license:pkg.license??null})).sort((a,b)=>a.name.localeCompare(b.name,"en"))});
const notices=["# Third-party source and license inventory", "", "First-party project license: owner decision required; no license selected by this build.",
  "This inventory includes locked production dependencies and Cargo build/platform inputs. The resources manifest identifies the bytes actually packaged.", ""];
const missing=[];
async function appendNotices(name,version,directory,license) {
  const candidates=(await readdir(directory)).filter(file=>/^(licen[sc]e|copying|notice)([.-]|$)/i.test(file));
  notices.push(`## ${name}@${version}`,`Declared license: ${license??"UNDECLARED"}`,"");
  for(const file of candidates) {
    try { notices.push(`### ${file}`,await readFile(join(directory,file),"utf8"),""); }
    catch(error) { if(error.code!=="EISDIR") throw error; }
  }
  if(!license || !candidates.length) missing.push({name,version,reason:!license?"undeclared-license":"no-root-notice-file"});
}
const lock=await json(join(root,"package-lock.json"));
for(const [path,pkg] of Object.entries(lock.packages)) {
  if(!path.startsWith("node_modules/") || pkg.dev || pkg.link) continue;
  const directory=join(root,path);
  let installed;
  try { installed=await json(join(directory,"package.json")); }
  catch(error) { if(error.code==="ENOENT" && pkg.optional) continue; throw error; }
  await appendNotices(installed.name,installed.version,directory,installed.license);
}
for(const pkg of cargo.packages) if(pkg.source) await appendNotices(pkg.name,pkg.version,dirname(pkg.manifest_path),pkg.license);
await writeFile(join(output,"THIRD_PARTY_NOTICES.md"),notices.join("\n"));
await writeJson(join(output,"license-review.json"),{schemaVersion:1,firstParty:"OWNER_DECISION_REQUIRED",missing,
  note:"Missing root notice files require review; this is an inventory, not legal clearance"});
// Include generated supply-chain files in the same integrity manifest.
let manifest;
try { manifest=await json(join(output,"manifest.json")); }
catch(error) { if(error.code!=="ENOENT") throw error; }
if(manifest) { manifest.files=await inventory(output,name=>name==="manifest.json"); await writeJson(join(output,"manifest.json"),manifest); }
