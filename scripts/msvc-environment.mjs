import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import process from "node:process";

const normalize = input => Object.fromEntries(Object.entries(input).map(([key,value]) => [key.toUpperCase(), value]));
const digest = async path => { const hash=createHash("sha256"); for await(const bytes of createReadStream(path)) hash.update(bytes); return hash.digest("hex"); };
const trimVersion = value => (value ?? "").replace(/[\\/]+$/, "");

/** Select through Microsoft's developer environment, then pin the actual child build tools. */
export async function msvcEnvironment() {
  if (process.platform !== "win32") throw new Error("MSVC requires the Windows receiving build environment");
  let env=normalize(process.env);
  const vswhere=join(env["PROGRAMFILES(X86)"] ?? "", "Microsoft Visual Studio/Installer/vswhere.exe");
  let installations;
  try { installations=JSON.parse(execFileSync(vswhere,["-products","*","-requires","Microsoft.VisualStudio.Component.VC.Tools.x86.x64","-format","json","-utf8"],{encoding:"utf8"})); }
  catch { throw new Error("Visual Studio discovery failed; install approved C++ Build Tools with Windows SDK"); }
  let installation;
  let selection;
  if (env.VSCMD_ARG_TGT_ARCH === "x64" && env.VSCMD_ARG_HOST_ARCH === "x64" && env.VCTOOLSINSTALLDIR && env.WINDOWSSDKDIR && env.WINDOWSSDKVERSION) {
    installation=installations.find(item=>resolve(item.installationPath).toLowerCase()===resolve(env.VSINSTALLDIR ?? "").toLowerCase());
    selection="inherited-x64-developer-environment";
  } else {
    let selected;
    try { selected=execFileSync(vswhere,["-latest","-products","*","-requires","Microsoft.VisualStudio.Component.VC.Tools.x86.x64","-property","installationPath"],{encoding:"utf8"}).trim(); }
    catch { throw new Error("Visual Studio x64 toolchain selection failed"); }
    installation=installations.find(item=>item.installationPath===selected);
    if (!installation) throw new Error("Approved complete Visual Studio installation unavailable");
    const developer=join(selected,"Common7/Tools/VsDevCmd.bat");
    try {
      const output=execFileSync("cmd.exe",["/d","/s","/c",`"chcp 65001 >nul && call "${developer}" -no_logo -arch=x64 -host_arch=x64 >nul && set"`],
        {encoding:"utf8",windowsVerbatimArguments:true,maxBuffer:4_000_000});
      for(const line of output.split(/\r?\n/)){const separator=line.indexOf("=");if(separator>0)env[line.slice(0,separator).toUpperCase()]=line.slice(separator+1);}
    } catch { throw new Error("Visual Studio developer environment failed; repair the selected C++ tools and SDK"); }
    selection="vswhere-and-VsDevCmd-x64";
  }
  if (!installation || !installation.isComplete || env.VSCMD_ARG_TGT_ARCH !== "x64" || env.VSCMD_ARG_HOST_ARCH !== "x64" || !env.VCTOOLSINSTALLDIR || !env.WINDOWSSDKDIR) throw new Error("Incomplete MSVC developer environment");
  const toolsetVersion=trimVersion(env.VCTOOLSVERSION);
  const sdkVersion=trimVersion(env.WINDOWSSDKVERSION);
  const ucrtVersion=trimVersion(env.UCRTVERSION);
  if (![toolsetVersion,sdkVersion,ucrtVersion].every(value=>/^\d+(?:\.\d+){2,3}$/.test(value))) throw new Error("Unresolved MSVC/Windows SDK version");
  const toolsRoot=resolve(env.VCTOOLSINSTALLDIR);
  const sdkRoot=resolve(env.WINDOWSSDKDIR);
  const paths={ compiler:join(toolsRoot,"bin/Hostx64/x64/cl.exe"),linker:join(toolsRoot,"bin/Hostx64/x64/link.exe"),
    archiver:join(toolsRoot,"bin/Hostx64/x64/lib.exe"),resourceCompiler:join(sdkRoot,"bin",sdkVersion,"x64/rc.exe"),
    kernel32:join(sdkRoot,"Lib",sdkVersion,"um/x64/kernel32.lib"),ucrt:join(env.UNIVERSALCRTSDKDIR ?? sdkRoot,"Lib",ucrtVersion,"ucrt/x64/ucrt.lib") };
  const tools={};
  for(const [name,path] of Object.entries(paths)){
    if(!(await stat(path)).isFile())throw new Error(`Selected MSVC input unavailable: ${name}`);
    tools[name]={path:relative(name==="compiler"||name==="linker"||name==="archiver"?toolsRoot:sdkRoot,path).split("\\").join("/"),sha256:await digest(path)};
  }
  env.CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER=paths.linker;
  env.CC_X86_64_PC_WINDOWS_MSVC=paths.compiler;
  env["CC_X86_64-PC-WINDOWS-MSVC"]=paths.compiler;
  env.AR_X86_64_PC_WINDOWS_MSVC=paths.archiver;
  env["AR_X86_64-PC-WINDOWS-MSVC"]=paths.archiver;
  env.RC=paths.resourceCompiler;
  return {env,provenance:{schemaVersion:1,selection,visualStudio:{instanceId:installation.instanceId,productId:installation.productId,version:installation.installationVersion},
    toolsetVersion,windowsSdkVersion:sdkVersion,ucrtVersion,hostArchitecture:"x64",targetArchitecture:"x64",tools}};
}
