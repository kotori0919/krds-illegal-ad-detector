import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import process from "node:process";
import { promisify } from "node:util";
import { inventory, root, verifyFiles, writeJson } from "../build-support.mjs";

test("artifact verifier rejects modified resources and traversal before accepting bytes",async()=>{
  const temporary=await mkdtemp(join(tmpdir(),"krds resource 사용자 "));
  try {
    await mkdir(join(temporary,"nested"));
    await writeFile(join(temporary,"nested","resource.wasm"),"original");
    const files=await inventory(temporary);
    assert.deepEqual(files.map(file=>file.path),["nested/resource.wasm"]);
    await verifyFiles(temporary,files);
    await writeFile(join(temporary,"nested","resource.wasm"),"tampered");
    await assert.rejects(verifyFiles(temporary,files),/Resource mismatch/);
    await assert.rejects(verifyFiles(temporary,[{...files[0],path:"../outside"}]),/Invalid resource/);
    await assert.rejects(verifyFiles(temporary,[files[0],files[0]]),/Resource mismatch|Invalid resource/);
  } finally { await rm(temporary,{recursive:true,force:true}); }
});
test("resource symlinks cannot escape candidate ownership",async(context)=>{
  const temporary=await mkdtemp(join(tmpdir(),"krds link "));
  try {
    await writeFile(join(temporary,"original"),"evidence");
    try { await symlink(join(temporary,"original"),join(temporary,"link")); }
    catch(error) { if(error.code==="EPERM") { context.skip("Windows developer mode symlink permission unavailable"); return; } throw error; }
    await assert.rejects(inventory(temporary),/symlink rejected/);
  } finally { await rm(temporary,{recursive:true,force:true}); }
});
test("candidate CLI refuses incomplete builds and files absent from the reviewed inventory",async()=>{
  const temporary=await mkdtemp(join(tmpdir(),"krds candidate "));
  const command=join(root,"scripts/verify-artifact.mjs");
  const manifestPath=join(temporary,"manifest.json");
  const run=promisify(execFile);
  try {
    await writeFile(join(temporary,"setup.exe"),"controlled fixture bytes; not an executable");
    const manifest={schemaVersion:1,releaseStatus:"preparing",source:{sourceSha256:"0".repeat(64)},signing:"unsigned-internal-candidate",files:await inventory(temporary)};
    await writeJson(manifestPath,manifest);
    await assert.rejects(run(process.execPath,[command,manifestPath]),/incomplete candidate/);
    manifest.releaseStatus="candidate";
    await writeJson(manifestPath,manifest);
    const result=await run(process.execPath,[command,join(temporary,"setup.exe")]);
    assert.equal(JSON.parse(result.stdout).state,"verified");
    await writeFile(join(temporary,"unreviewed.dll"),"unexpected bytes");
    await assert.rejects(run(process.execPath,[command,manifestPath]),/Unexpected candidate files/);
  } finally { await rm(temporary,{recursive:true,force:true}); }
});
