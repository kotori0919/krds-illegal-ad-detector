import { execFileSync } from "node:child_process";
import console from "node:console";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";
import { inventory, json, npm, root, run, sha256, sourceIdentity, stage, verifyFiles, workerName, writeJson } from "./build-support.mjs";

const action = process.argv[2];
const target = process.env.KRDS_WINDOWS_TARGET ?? (process.platform === "win32" ? "x86_64-pc-windows-msvc" : "x86_64-pc-windows-gnullvm");
if (!["x86_64-pc-windows-msvc", "x86_64-pc-windows-gnullvm"].includes(target)) throw new Error("Unsupported Windows target");
if (action === "resources") {
  await run(process.execPath, [join(root, "scripts/prepare-windows-runtime.mjs"), "--verify"]);
  await npm(["run", "build", "-w", "apps/web"]);
  await npm(["run", "build:sidecar"]);
  const source = await sourceIdentity();
  const builtAt = new Date().toISOString();
  const appVersion = (await json(join(root,"package.json"))).version;
  if ((await json(join(root,"src-tauri/tauri.conf.json"))).version !== appVersion) throw new Error("Tauri/app version mismatch");
  const releaseInputs = {};
  if (target.endsWith("gnullvm") && process.env.KRDS_LLVM_MINGW && process.env.KRDS_NSIS_ROOT) {
    const llvm=resolve(process.env.KRDS_LLVM_MINGW);
    const nsis=resolve(process.env.KRDS_NSIS_ROOT);
    releaseInputs.llvm={version:execFileSync(join(llvm,"bin/clang"),["--version"],{encoding:"utf8"}).trim(),
      compilerSha256:await sha256(join(llvm,"bin/clang")),licenseSha256:await sha256(join(llvm,"LICENSE.TXT"))};
    releaseInputs.nsis={version:execFileSync(join(nsis,"bin/makensis"),["-VERSION"],{encoding:"utf8",env:{...process.env,NSISDIR:join(nsis,"share/nsis")}}).trim(),
      compilerSha256:await sha256(join(nsis,"bin/makensis"))};
    releaseInputs.loaders={libunwind:await sha256(join(stage,"libunwind.dll")),webview2:await sha256(join(stage,"WebView2Loader.dll"))};
  }
  const manifest = { schemaVersion: 1, builtAt, buildId: `${appVersion}-${target}-${source.sourceSha256.slice(0,12)}-${builtAt.replace(/[^0-9TZ]/g,"")}`,
    caseSchemaVersion: 1, detectorPolicyVersion: 2, appVersion, source,
    target, releaseInputs, tools: { node: process.version, rust: execFileSync("rustc", ["--version"], { encoding: "utf8" }).trim(),
      tauri: (await json(join(root, "node_modules/@tauri-apps/cli/package.json"))).version },
    lockfiles: { npm: await sha256(join(root,"package-lock.json")), cargo: await sha256(join(root,"src-tauri/Cargo.lock")),
      runtime: await sha256(join(root,"scripts/windows-runtime.lock.json")) },
    frontend: await inventory(join(root, "apps/web/dist")),
    workers: await inventory(stage, name => ![workerName,"ocr-worker.mjs","ocr-data"].includes(name) && !name.startsWith("ocr-data/")) };
  await writeJson(join(stage, "build-manifest.json"), manifest);
  await cp(join(root, "scripts/windows-runtime.lock.json"), join(stage, "resources-manifest.json"));
} else if (action === "build" || action === "package") {
  const env = { ...process.env, KRDS_WINDOWS_TARGET: target };
  let nsisLauncher;
  if (target === "x86_64-pc-windows-gnullvm") {
    if (!process.env.KRDS_LLVM_MINGW || !process.env.KRDS_NSIS_ROOT) throw new Error("GNU build requires KRDS_LLVM_MINGW and KRDS_NSIS_ROOT; see BUILD_MANUAL.md");
    const llvm = resolve(process.env.KRDS_LLVM_MINGW);
    const nsis = resolve(process.env.KRDS_NSIS_ROOT);
    await cp(join(llvm,"x86_64-w64-mingw32/bin/libunwind.dll"), join(stage,"libunwind.dll"));
    await cp(join(llvm,"LICENSE.TXT"), join(stage,"llvm-LICENSE"));
    const metadata = JSON.parse(execFileSync("cargo", ["metadata", "--format-version=1", "--locked", "--offline", "--filter-platform", target, "--manifest-path", join(root,"src-tauri/Cargo.toml")], { encoding:"utf8",maxBuffer:20_000_000 }));
    const webview = metadata.packages.find(pkg => pkg.name === "webview2-com-sys");
    if (!webview) throw new Error("Locked WebView2 loader package missing; cargo fetch --locked first");
    await cp(join(resolve(webview.manifest_path,".."),"x64/WebView2Loader.dll"),join(stage,"WebView2Loader.dll"));
    // Tauri deliberately removes NSISDIR before invoking makensis. Restore the
    // selected relocatable tool root inside an owned, temporary launcher.
    nsisLauncher = await mkdtemp(join(tmpdir(), "krds-nsis-"));
    const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
    await writeFile(join(nsisLauncher,"makensis"), `#!/bin/sh\nexport NSISDIR=${quote(join(nsis,"share/nsis"))}\nexec ${quote(join(nsis,"bin/makensis"))} "$@"\n`, {mode:0o700});
    env.PATH = [nsisLauncher,join(llvm,"bin"),process.env.PATH].join(":");
    env.NSISDIR = join(nsis,"share/nsis");
    env.CARGO_TARGET_X86_64_PC_WINDOWS_GNULLVM_LINKER = "x86_64-w64-mingw32-clang";
    env.CC_x86_64_pc_windows_gnullvm = "x86_64-w64-mingw32-clang";
    env.AR_x86_64_pc_windows_gnullvm = "x86_64-w64-mingw32-ar";
    env.RC = "llvm-rc";
  }
  const args = ["build","--target",target,"--ci"];
  if (target.endsWith("gnullvm")) args.push("--config","src-tauri/tauri.gnullvm.conf.json");
  if (action === "build") args.push("--no-bundle");
  args.push("--","--locked","--offline");
  try {
    await run(process.execPath,[join(root,"node_modules/@tauri-apps/cli/tauri.js"),...args],{env});
  } finally {
    if (nsisLauncher) await rm(nsisLauncher,{recursive:true,force:true});
  }
  if (action === "package") {
    const manifest = await json(join(stage,"build-manifest.json"));
    if (manifest.source.sourceSha256 !== (await sourceIdentity()).sourceSha256) throw new Error("Source changed during packaging; reject stale build");
    await verifyFiles(join(root,"apps/web/dist"),manifest.frontend);
    await verifyFiles(stage,manifest.workers);
    if (JSON.stringify(await inventory(join(root,"apps/web/dist")))!==JSON.stringify(manifest.frontend)) throw new Error("Frontend files changed during packaging");
    const workers=await inventory(stage,name=>![workerName,"ocr-worker.mjs","ocr-data"].includes(name)&&!name.startsWith("ocr-data/"));
    if (JSON.stringify(workers)!==JSON.stringify(manifest.workers)) throw new Error("Worker files changed during packaging");
    await run(process.execPath,[join(root,"scripts/prepare-windows-runtime.mjs"),"--verify"]);
    if(target.endsWith("gnullvm")&&(await sha256(join(stage,"libunwind.dll"))!==manifest.releaseInputs.loaders.libunwind
      ||await sha256(join(stage,"WebView2Loader.dll"))!==manifest.releaseInputs.loaders.webview2)) throw new Error("Loader inputs changed during packaging");
    const directory = join(root,"src-tauri/target",target,"release/bundle/nsis");
    const installers = (await inventory(directory)).filter(file=>file.path.endsWith(`_${manifest.appVersion}_x64-setup.exe`));
    if (installers.length !== 1) throw new Error("Expected exactly one NSIS installer for candidate");
    const executable = join(root,"src-tauri/target",target,"release/krds-detector.exe");
    const candidate = join(root,"artifacts",`candidate-${manifest.buildId}`);
    await mkdir(candidate,{recursive:true});
    await cp(join(directory,installers[0].path),join(candidate,installers[0].path));
    await cp(executable,join(candidate,"krds-detector.exe"));
    await cp(join(stage,"build-manifest.json"),join(candidate,"build-manifest.json"));
    await cp(join(stage,"resources-manifest.json"),join(candidate,"resources-manifest.json"));
    await writeJson(join(candidate,"manifest.json"),{schemaVersion:1,...manifest, releaseStatus:"preparing", createdAt:new Date().toISOString(),
      signing:"unsigned-internal-candidate",webview2:"pre-provisioned-or-approved-online-bootstrapper; absent-runtime installation NOT_RUN",
      reproducibility:"functional rebuild; bit identity NOT_ESTABLISHED",files:await inventory(candidate)});
    await run(process.execPath,[join(root,"scripts/supply-chain.mjs"),candidate]);
    const completed=await json(join(candidate,"manifest.json"));
    completed.releaseStatus="candidate";
    await writeJson(join(candidate,"manifest.json"),completed);
    console.log(JSON.stringify({candidate,buildId:manifest.buildId,sourceSha256:manifest.source.sourceSha256}));
  }
} else throw new Error("Usage: desktop.mjs resources|build|package");
