import { execFileSync } from "node:child_process";
import console from "node:console";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { json, root, run } from "./build-support.mjs";

const checks = [];
function check(name, action, recovery) {
  try { checks.push({ name, state:"ok", value:action() }); }
  catch (error) { checks.push({name,state:"missing",error:error.message,recovery}); }
}
check("Node build major",()=> {
  const [major,minor]=process.versions.node.split(".").map(Number);
  if (![22,24,26].includes(major) || (major===22 && minor<19)) throw new Error("Supported builds:22.19+,24,26; canonical:22.19.0");
  return process.version;
},"Install an approved supported Node release, then npm ci");
check("Rust",()=> {
  const value=execFileSync("rustc",["--version"],{encoding:"utf8"}).trim();
  if (!value.startsWith("rustc 1.98.1 ")) throw new Error(`Expected Rust1.98.1; found ${value}`);
  return value;
},"Provision the rust-toolchain.toml version under organization policy");
const dataRoot = process.env.KRDS_DATA_ROOT ?? (process.platform === "win32"
  ? join(process.env.APPDATA ?? join(homedir(),"AppData/Roaming"),"kr.go.nia.illegal-ad-detector")
  : join(process.env.XDG_DATA_HOME ?? join(homedir(),".local/share"),"kr.go.nia.illegal-ad-detector"));
try {
  await mkdir(dataRoot,{recursive:true});
  const probe=await mkdtemp(join(dataRoot,".doctor-"));
  try { await writeFile(join(probe,"probe"),"writable"); }
  finally { await rm(probe,{recursive:true,force:true}); }
  checks.push({name:"writable data root",state:"ok",path:dataRoot});
} catch(error) { checks.push({name:"writable data root",state:"missing",error:error.code,recovery:"Choose a writable per-user data root; preserve cases"}); }
try {
  await run(process.execPath,[join(root,"scripts/prepare-windows-runtime.mjs"),"--verify"]);
  checks.push({name:"Windows runtime resources",state:"ok"});
} catch(error) { checks.push({name:"Windows runtime resources",state:"missing",error:error.message,recovery:"npm run prepare:windows-runtime (explicit network preparation)"}); }
const packageJson=await json(join(root,"package.json"));
console.log(JSON.stringify({schemaVersion:1,appVersion:packageJson.version,nodeRuntime:"22.19.0",platform:process.platform,
  dataRoot,installer:"NSIS current-user; WebView2 pre-provisioned or approved online bootstrapper",checks},null,2));
if(checks.some(item=>item.state!=="ok")) process.exitCode=1;
