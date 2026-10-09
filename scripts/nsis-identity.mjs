import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { lstat, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const original = Buffer.from("__TAURI_BUNDLE_TYPE_VAR_UNK");
const packaged = Buffer.from("__TAURI_BUNDLE_TYPE_VAR_NSS");
const source = "https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.12.1/crates/tauri-bundler/src/bundle.rs";

/** Match the unsigned Tauri CLI 2.12.1 NSIS payload; never mutate the standalone executable. */
export function nsisPayloadIdentity(bytes, cliVersion) {
  if (cliVersion !== "2.12.1") throw new Error("Review NSIS identity derivation for this Tauri CLI version");
  const offset = bytes.indexOf(original);
  if (offset < 0 || bytes.indexOf(original, offset + 1) >= 0) throw new Error("Expected exactly one complete unpatched Tauri bundle marker");
  return { schemaVersion: 1, path: "krds-detector.exe", sourceVersion: cliVersion, source,
    profile: "unsigned-nsis", markerOffset: offset,
    standaloneSha256: createHash("sha256").update(bytes).digest("hex"),
    sha256: createHash("sha256").update(bytes.subarray(0, offset)).update(packaged)
      .update(bytes.subarray(offset + original.length)).digest("hex") };
}

export async function installedExecutableIdentity(path, cliVersion) {
  return nsisPayloadIdentity(await readFile(path), cliVersion);
}

/** Record the actual critical files in Tauri's observed project-local Windows NSIS layout. */
export async function projectNsisIdentity(projectRoot, tools, npmLockSha256) {
  if(tools.tauri!=="2.12.1")throw new Error("Review project NSIS provenance for this Tauri CLI version");
  const parts=["src-tauri","target",".tauri","NSIS"];
  let directory=projectRoot;
  for(const part of parts){directory=join(directory,part);if(!(await lstat(directory)).isDirectory()||(await lstat(directory)).isSymbolicLink())throw new Error("Project NSIS root must contain only regular directories");}
  const files=[];
  for(const path of ["makensis.exe","Bin/makensis.exe","Plugins/x86-unicode/additional/nsis_tauri_utils.dll"]){
    let current=directory;
    const components=path.split("/");
    for(const [index,part] of components.entries()){
      current=join(current,part);const status=await lstat(current);
      if(status.isSymbolicLink()||(index<components.length-1?!status.isDirectory():!status.isFile()))throw new Error("Project NSIS input must be a regular file inside its tool root");
      if(index===components.length-1){
        if(status.size>8_000_000)throw new Error("Project NSIS critical input exceeds bounded inventory size");
        files.push({path,size:status.size,sha256:createHash("sha256").update(await readFile(current)).digest("hex")});
      }
    }
  }
  const version=execFileSync(join(directory,"makensis.exe"),["/VERSION"],{encoding:"utf8",timeout:10_000,maxBuffer:4096}).trim();
  if(version!=="v3.11")throw new Error("Unexpected project NSIS compiler version");
  return {schemaVersion:1,root:parts.join("/"),scope:"critical-compiler-launcher-and-tauri-plugin",version,pluginVersion:"0.5.3",
    sourceCli:{version:tools.tauri,npmPackageVersion:tools.tauriNpmPackage,npmLockSha256,
      source:"https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.12.1/crates/tauri-bundler/src/bundle/windows/nsis/mod.rs"},
    downloads:{nsis:"https://github.com/tauri-apps/binary-releases/releases/download/nsis-3.11/nsis-3.11.zip",
      plugin:"https://github.com/tauri-apps/nsis-tauri-utils/releases/download/nsis_tauri_utils-v0.5.3/nsis_tauri_utils.dll"},files};
}
