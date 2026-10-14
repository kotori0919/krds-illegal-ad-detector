import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { win32 } from "node:path";
import { PublicNetworkPolicy, createConnectTransport, type PinnedTransport, type ScanDeadline } from "@krds-detector/scanner";

const executableSha256 = "122f2e40208e81bb814fcb4be4fbbbdc9246860f1f3784f72ae4512b97667e91";
const traceUrl = "https://www.cloudflare.com/cdn-cgi/trace";
export interface WarpRuntime { transport: PinnedTransport; failure: Promise<Error>; close(): Promise<void>; }
interface Options { executablePath: string; configPath: string; deadline: ScanDeadline; signal: AbortSignal; }
interface Dependencies {
  expectedExecutableSha256: string;
  spawn: (path: string, args: readonly string[]) => ChildProcessWithoutNullStreams;
  discoverListener: (pid: number, signal: AbortSignal, timeoutMs: number) => Promise<number>;
  networkPolicyFactory: (transport: PinnedTransport) => Pick<PublicNetworkPolicy, "fetch">;
}
export type WarpRuntimeErrorCode = "config-permission" | "config-invalid" | "binary-missing" | "binary-integrity" | "preparation-failed" | "tunnel-exited";
export class WarpRuntimeError extends Error {
  constructor(readonly code: WarpRuntimeErrorCode) { super("WARP tunnel failed"); this.name="WarpRuntimeError"; }
}
const failureError = (): WarpRuntimeError => new WarpRuntimeError("preparation-failed");

/** One bounded readiness helper; only the exact owned child PID may supply a listener. */
async function discoverWindowsListener(pid: number, signal: AbortSignal, timeoutMs: number): Promise<number> {
  if (process.platform !== "win32" || !Number.isSafeInteger(pid) || pid <= 0) throw failureError();
  const systemRoot=process.env.SystemRoot;
  if(!systemRoot || !/^[A-Za-z]:\\/.test(systemRoot) || /[\0\r\n]/.test(systemRoot))throw failureError();
  const powershell=win32.resolve(systemRoot,"System32","WindowsPowerShell","v1.0","powershell.exe");
  const script = `$end=[DateTime]::UtcNow.AddMilliseconds(${Math.max(1,Math.floor(timeoutMs))}); do { $rows=@(Get-NetTCPConnection -OwningProcess ${pid} -State Listen -ErrorAction SilentlyContinue); if($rows.Count -gt 0){ if($rows.Count -ne 1 -or $rows[0].LocalAddress -ne '127.0.0.1'){exit 2}; [Console]::Out.Write($rows[0].LocalPort); exit 0 }; Start-Sleep -Milliseconds 50 } while([DateTime]::UtcNow -lt $end); exit 3`;
  const helper = spawn(powershell, ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script], { windowsHide: true, stdio: "pipe" });
  return new Promise<number>((resolve,reject) => {
    let output = ""; let invalid = false;
    const stop = (): void => { invalid = true; helper.kill(); };
    const timer = setTimeout(stop, Math.max(1,timeoutMs));
    signal.addEventListener("abort",stop,{once:true});
    if(signal.aborted)stop();
    helper.stdout.on("data", chunk => { output += String(chunk); if(output.length > 32)stop(); });
    helper.stderr.on("data", () => {});
    helper.once("error", () => { invalid=true; });
    helper.once("close", code => {
      clearTimeout(timer);signal.removeEventListener("abort",stop);
      const port=Number(output);
      if(invalid || code!==0 || !/^\d{1,5}$/.test(output) || port<1 || port>65535)reject(failureError());else resolve(port);
    });
  });
}

/** Production entry point fixes provenance, platform discovery and public trace policy. */
export function startWarpRuntime(options: Options): Promise<WarpRuntime> {
  return startWarpRuntimeWithDependencies(options, {
    expectedExecutableSha256: executableSha256,
    spawn: (path,args) => spawn(path,[...args],{windowsHide:true,stdio:"pipe"}),
    discoverListener: discoverWindowsListener,
    networkPolicyFactory: transport => new PublicNetworkPolicy(undefined,transport),
  });
}

/** Internal platform-fixture seam; never exported by the package or exposed to worker input. */
export async function startWarpRuntimeWithDependencies(options: Options, dependencies: Dependencies): Promise<WarpRuntime> {
  let child: ChildProcessWithoutNullStreams | undefined;
  let transport: PinnedTransport | undefined;
  let closing: Promise<void> | undefined;
  let intentional = false;
  let failed = false;
  let childClosed = false;
  let childFinished: Promise<void> | undefined;
  let discoveryPending: Promise<number> | undefined;
  let resolveFailure!: (error: Error) => void;
  const failure = new Promise<Error>(resolve => { resolveFailure=resolve; });
  const controller = new AbortController();
  const abort = (): void => controller.abort();
  options.signal.addEventListener("abort",abort,{once:true});
  if(options.signal.aborted)abort();
  const budgetTimer = setTimeout(abort, Math.max(1,options.deadline.remainingMs()));
  const close = (): Promise<void> => {
    if(closing)return closing;
    intentional=true;
    closing=Promise.resolve().then(async()=>{
      controller.abort(); clearTimeout(budgetTimer); options.signal.removeEventListener("abort",abort);
      await transport?.close();
      await discoveryPending?.catch(()=>{});
      if(child && !childClosed){
        const owned=child;
        const timer=setTimeout(()=>owned.kill("SIGKILL"),2000);
        owned.kill(); await childFinished; clearTimeout(timer);
      }
    });return closing;
  };
  const fail = (): void => {
    if(intentional || failed)return;
    failed=true;resolveFailure(new WarpRuntimeError("tunnel-exited"));controller.abort();child?.kill();
  };
  const bounded = async <T>(operation: Promise<T>): Promise<T> => {
    if(controller.signal.aborted)throw failureError();
    let listener!: () => void;
    const stopped=new Promise<never>((_,reject)=>{ listener=()=>reject(failureError());controller.signal.addEventListener("abort",listener,{once:true}); });
    try{return await Promise.race([operation,stopped]);}finally{controller.signal.removeEventListener("abort",listener);}
  };
  try {
    if(options.deadline.expired() || options.signal.aborted)throw failureError();
    const hash=createHash("sha256");
    const file=createReadStream(options.executablePath,{signal:controller.signal});
    try {for await(const chunk of file)hash.update(chunk);} catch(error) {
      if((error as NodeJS.ErrnoException).code==="ENOENT")throw new WarpRuntimeError("binary-missing");
      throw failureError();
    }
    if(hash.digest("hex")!==dependencies.expectedExecutableSha256)throw new WarpRuntimeError("binary-integrity");
    const username=randomBytes(24).toString("hex"), password=randomBytes(32).toString("hex");
    child=dependencies.spawn(options.executablePath,["http-proxy","--config",options.configPath,"--bind","127.0.0.1","--port","0","--username",username,"--password",password]);
    childFinished=new Promise(resolve=>child!.once("close",()=>{childClosed=true;resolve();}));
    child.once("error",fail);child.once("exit",fail);
    for(const stream of [child.stdout,child.stderr]) {
      let tail="";
      stream.on("data",(chunk:Buffer)=>{
        // Keep only a short classification window; raw output is never diagnostic data.
        const text=tail+chunk.toString("utf8");
        if(/Failed to connect tunnel:|Tunnel connection failed:|Tunnel connection lost:/.test(text))fail();
        tail=text.slice(-64);
      });
    }
    if(!child.pid)throw failureError();
    discoveryPending=dependencies.discoverListener(child.pid,controller.signal,options.deadline.remainingMs());
    const port=await bounded(discoveryPending);
    if(child.exitCode!==null || child.signalCode!==null || failed || !Number.isInteger(port) || port<1 || port>65535)throw failureError();
    transport=createConnectTransport({port,username,password});
    const traceController=new AbortController();
    const stopTrace=():void=>traceController.abort();controller.signal.addEventListener("abort",stopTrace,{once:true});
    const traceTimer=setTimeout(stopTrace,Math.max(1,Math.min(10_000,options.deadline.remainingMs())));
    try {
      await bounded((async()=>{
        const response=await dependencies.networkPolicyFactory(transport!).fetch(traceUrl,{signal:traceController.signal});
        if(response.status!==200){await response.body?.cancel();throw failureError();}
        const reader=response.body?.getReader();if(!reader)throw failureError();
        let bytes=0;let text="";
        try{while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>16384)throw failureError();text+=Buffer.from(part.value).toString("utf8");}}
        finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
        const values=text.split(/\r?\n/).filter(line=>line.startsWith("warp="));
        if(values.length!==1 || values[0]!=="warp=on")throw failureError();
      })());
    } finally {clearTimeout(traceTimer);controller.signal.removeEventListener("abort",stopTrace);}
    if(controller.signal.aborted || failed)throw failureError();
    // Cancellation/deadline after startup also closes the owned process and sockets.
    controller.signal.addEventListener("abort",()=>{void close();},{once:true});
    return {transport,failure,close};
  } catch(error) {await close();throw failed ? new WarpRuntimeError("tunnel-exited") : error instanceof WarpRuntimeError ? error : failureError();}
}
