import { afterAll, beforeAll, expect, it } from "vitest";
import { spawn, execFileSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:https";
import { connect } from "node:net";
import { getCACertificates, setDefaultCACertificates } from "node:tls";
import { PublicNetworkPolicy, ScanDeadline } from "@krds-detector/scanner";
import { startWarpRuntimeWithDependencies } from "../src/warp-runtime.js";

const fixture = fileURLToPath(new URL("./fixtures/warp-child.mjs", import.meta.url));
const hash = createHash("sha256").update(readFileSync(fixture)).digest("hex");
const directory = mkdtempSync(join(tmpdir(), "warp-runtime-"));
let body = "warp=on\n"; let status = 200; let delay = 0; let requests = 0;
let server: ReturnType<typeof createServer>; let destination = 0;
const roots = getCACertificates("default");
beforeAll(async () => {
  const openssl = process.platform === "win32" ? resolve(execFileSync("git", ["--exec-path"], { encoding: "utf8" }).trim(), "..", "..", "bin", "openssl.exe") : "openssl";
  execFileSync(openssl, ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", join(directory,"key"), "-out", join(directory,"cert"), "-days", "1", "-subj", "/CN=www.cloudflare.com", "-addext", "subjectAltName=DNS:www.cloudflare.com"], { stdio: "ignore" });
  setDefaultCACertificates([...roots, readFileSync(join(directory,"cert"), "utf8")]);
  server = createServer({ key: readFileSync(join(directory,"key")), cert: readFileSync(join(directory,"cert")) }, (req,res) => {
    requests++; res.statusCode = status;
    setTimeout(() => { if (!res.destroyed) res.end(body); }, delay);
  });
  await new Promise<void>(resolve => server.listen(0,"127.0.0.1",resolve));
  destination = (server.address() as { port: number }).port;
});
afterAll(async () => { setDefaultCACertificates(roots); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); rmSync(directory,{recursive:true,force:true}); });

function setup(mode = "", expectedExecutableSha256 = hash) {
  let child: ChildProcessWithoutNullStreams; let port = 0; let captured = "";let secrets: string[]=[];
  let ready: (port: number) => void;
  const listener = new Promise<number>(resolve => { ready = resolve; });
  const dependencies = { expectedExecutableSha256,
    spawn: (_path: string, args: readonly string[]) => {
      const value = (flag: string) => args[args.indexOf(flag)+1]!;
      secrets=[value("--username"),value("--password")];
      child = spawn(process.execPath, [fixture,value("--username"),value("--password"),String(destination),mode], { stdio: "pipe" });
      child.stdout.on("data", chunk => { captured += String(chunk); const match = /PORT=(\d+)\n/.exec(captured); if(match) { port = Number(match[1]); ready(port); } });
      child.stderr.on("data", chunk => { captured += String(chunk); });
      return child;
    },
    discoverListener: async (_pid: number, signal: AbortSignal) => {
      let stop!:()=>void;
      const cancelled=new Promise<never>((_,reject)=>{stop=()=>reject(new Error("fixture discovery cancelled"));signal.addEventListener("abort",stop,{once:true});if(signal.aborted)stop();});
      try{return await Promise.race([listener,cancelled]);}finally{signal.removeEventListener("abort",stop);}
    },
    networkPolicyFactory: (transport: Parameters<typeof PublicNetworkPolicy.forFixtureOrigins>[1]) => new PublicNetworkPolicy(async () => [{address:"1.1.1.1",family:4}], transport),
  };
  return { dependencies, child: () => child, port: () => port, captured: () => captured, secrets:()=>secrets };
}
async function closed(f: ReturnType<typeof setup>) {
  expect(f.child().exitCode !== null || f.child().signalCode !== null).toBe(true);
  await expect(new Promise<void>((resolve,reject) => { const s = connect(f.port(),"127.0.0.1"); s.once("connect",()=>{s.destroy();resolve();});s.once("error",reject); })).rejects.toThrow();
  expect(f.captured()).not.toContain("Proxy-Authorization");
  for(const secret of f.secrets())expect(f.captured()).not.toContain(secret);
}
async function automaticallyClosed(f: ReturnType<typeof setup>) {
  if (f.child().exitCode === null && f.child().signalCode === null) {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { f.child().off("close", finish); reject(new Error("owned child did not close automatically")); }, 2000);
      const finish = (): void => { clearTimeout(timer); resolve(); };
      f.child().once("close", finish);
    });
  }
  await closed(f);
}
function options(signal = new AbortController().signal, timeout = 5) { return { executablePath: fixture, configPath: join(directory,"config.json"), deadline: new ScanDeadline(timeout), signal }; }

it("authenticates a real child proxy, verifies TLS trace and closes idempotently", async () => {
  body="warp=on\n";status=200;delay=0;const f=setup(); const before=requests;
  const runtime=await startWarpRuntimeWithDependencies(options(),f.dependencies);
  expect(requests-before).toBe(1); await runtime.close(); await runtime.close(); await closed(f);
});
it.each(["warp=off\n", "warp=on\nwarp=off\n", "x".repeat(16385)])("rejects unverified trace and closes startup resources", async bodyValue => {
  body=bodyValue;status=200;delay=0;const f=setup();
  await expect(startWarpRuntimeWithDependencies(options(),f.dependencies)).rejects.toThrow(/WARP/); await closed(f);
});
it("rejects non-200 trace", async () => { body="warp=on\n";status=403;delay=0;const f=setup();await expect(startWarpRuntimeWithDependencies(options(),f.dependencies)).rejects.toThrow(/WARP/);await closed(f); });
it.each(["connect","failed","lost"])("terminates a still-running child on fragmented tunnel failure: %s", async mode => {
  body="warp=on\n";status=200;delay=0;const f=setup();const runtime=await startWarpRuntimeWithDependencies(options(),f.dependencies);
  try {
    f.child().stdin.write(`${mode}\n`);
    expect(await runtime.failure).toMatchObject({message:"WARP tunnel failed",code:"tunnel-exited"});
    await automaticallyClosed(f);
  } finally { await runtime.close(); }
});
it("reports child exit after preparation and closes its listener", async()=>{
  body="warp=on\n";status=200;delay=0;const f=setup();const runtime=await startWarpRuntimeWithDependencies(options(),f.dependencies);
  try { f.child().kill();expect(await runtime.failure).toMatchObject({code:"tunnel-exited"});await automaticallyClosed(f); }
  finally { await runtime.close(); }
});
it("closes an active runtime on cancellation",async()=>{
  body="warp=on\n";status=200;delay=0;const f=setup();const controller=new AbortController();const runtime=await startWarpRuntimeWithDependencies(options(controller.signal),f.dependencies);
  try { controller.abort();await automaticallyClosed(f); }
  finally { await runtime.close(); }
});
it("closes an active runtime when its shared deadline expires", async () => {
  body="warp=on\n";status=200;delay=0;const f=setup();
  const runtime=await startWarpRuntimeWithDependencies(options(undefined,1),f.dependencies);
  try { await automaticallyClosed(f); }
  finally { await runtime.close(); }
});
it.each(["cancel", "deadline", "exit"])("closes child on setup %s", async mode => {
  body="warp=on\n";status=200;delay=500;const f=setup(mode);const controller=new AbortController();
  const pending=startWarpRuntimeWithDependencies(options(controller.signal,mode==="deadline"?0.1:5),f.dependencies);
  if(mode==="cancel")setTimeout(()=>controller.abort(),50);
  await expect(pending).rejects.toThrow(/WARP/);await closed(f);delay=0;
});
it("rejects modified or missing executable before spawning", async () => {
  const f=setup("","0".repeat(64));await expect(startWarpRuntimeWithDependencies(options(),f.dependencies)).rejects.toMatchObject({code:"binary-integrity"});expect(f.child()).toBeUndefined();
  await expect(startWarpRuntimeWithDependencies({...options(),executablePath:join(directory,"missing")},f.dependencies)).rejects.toMatchObject({code:"binary-missing"});expect(f.child()).toBeUndefined();
});
