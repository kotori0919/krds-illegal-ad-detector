//! Scanner worker sidecar (Node): crawl + detect + validate + print.
//!
//! The Tauri host spawns this worker with `--session <id>`; it writes
//! validated result.json to stdout (BOM-free) and exits. Stdout is JSON only;
//! diagnostics go to stderr. This keeps detection semantics out of Tauri
//! commands (KODEX §13) and makes the worker testable headlessly.
//! The worker routes through scanSite (ADR-0007 live-page loop) so the
//! packaged path cannot drift from the tested e2e seam.

import { scanSite } from "./scan.js";
import { writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { parseWorkerArgs } from "./worker-args.js";
import { PublicNetworkPolicy, ScanDeadline, type PinnedTransport } from "@krds-detector/scanner";
import { startWarpRuntime, WarpRuntimeError, type WarpRuntime } from "./warp-runtime.js";
import { initialProgress, type TransportProvenance } from "@krds-detector/contracts";

async function main(): Promise<void> {
  let args;
  try { args = parseWorkerArgs(process.argv.slice(2)); }
  catch (error) { console.error(error instanceof Error ? error.message : "Invalid worker arguments"); process.exitCode = 2; return; }
  // scanSite owns crawl → live-page detection → validated result.json
  // (the same seam the 17/17 e2e test exercises). Progress events stay on
  // stderr so stdout remains result.json only.
  const controller = new AbortController();
  const commands = createInterface({ input: process.stdin });
  commands.on("line", (line) => {
    try {
      if (JSON.parse(line).type === "cancel") controller.abort();
    } catch { /* Ignore malformed host commands. */ }
  });
  // The command pipe must not keep a settled worker alive.
  process.stdin.unref?.();
  const deadline = new ScanDeadline(args.timeoutSec);
  let runtime: WarpRuntime | undefined;
  let tunnelFailure: Error | undefined;
  let networkPolicy: PublicNetworkPolicy | undefined;
  let provenance: TransportProvenance = { kind: "direct", reason: "source-cli" };
  let preparationEvents = 0;
  try {
  if (args.requireWarp || args.warpExecutable) {
    // Authorization is created once. Its public route stays closed until the
    // runtime is ready; later DNS can never create a new private-origin grant.
    const publicTransport: PinnedTransport = {
      open: (target, options) => runtime && !tunnelFailure ? runtime.transport.open(target, options)
        : Promise.reject(new WarpRuntimeError("preparation-failed")),
      close: async () => {}, // The worker owns runtime cleanup in finally.
    };
    networkPolicy = args.publicNetworkOnly ? new PublicNetworkPolicy(undefined, publicTransport)
      : await PublicNetworkPolicy.forManualEntry(args.entryUrl, controller.signal, deadline.operationTimeoutMs(2000), publicTransport);
    const target = await networkPolicy.resolveTarget(args.entryUrl, controller.signal, deadline.operationTimeoutMs(2000));
    if (target.route === "owned-origin") {
      provenance = { kind: "direct", reason: "owned-origin" };
    } else {
      preparationEvents = 1;
      console.error(`KRDSPROGRESS ${JSON.stringify({ kind: "stage-changed", message: "WARP 연결을 준비하고 있습니다.", progress: { ...initialProgress("running"), sequence: 1 } })}`);
      if (!args.warpExecutable || !args.warpConfigFile) throw new WarpRuntimeError("config-invalid");
      runtime = await startWarpRuntime({ executablePath: args.warpExecutable, configPath: args.warpConfigFile, deadline, signal: controller.signal });
      provenance = { kind: "warp", backend: "usque", version: "4.2.1" };
      void runtime.failure.then(error => { tunnelFailure = error; controller.abort(); });
    }
  }
  console.error(`KRDSTRANSPORT ${JSON.stringify(provenance)}`);
  const { json, detailBundle, extraJson } = await scanSite({
    entryUrl: args.entryUrl,
    signal: controller.signal,
    deadline,
    commitOfficial: (json) => {
      if (args.outFile) writeFileSync(args.outFile, json.endsWith("\n") ? json : `${json}\n`,"utf8");
    },
    crawl: {
      limits: { maxPages: args.maxPages, maxDepth: args.maxDepth, maxFrameDepth: args.maxFrameDepth, timeoutSec: args.timeoutSec },
      settleMs: args.settleMs,
      concurrency: args.concurrency,
      channel: args.channel,
      executablePath: args.executablePath,
      publicNetworkOnly: args.publicNetworkOnly,
      entryKind: args.entryKind,
      networkPolicy,
    },
    onEvent: (e) => {
      if (tunnelFailure && (e.kind === "session-cancelled" || e.kind === "session-finished")) {
        e = { ...e, kind: "session-failed", message: "WARP tunnel failed", progress: { ...e.progress, stage: "failed" } };
      }
      // Machine-readable progress for the Tauri host (KODEX §36): the host
      // forwards KRDSPROGRESS lines as scan-event IPC so the progress screen
      // shows real counters. Stdout stays result.json only.
      const payload = JSON.stringify({
        kind: e.kind,
        message: e.message ?? null,
        pageUrl: e.pageUrl ?? null,
        progress: preparationEvents ? { ...e.progress, sequence: e.progress.sequence + preparationEvents,
          recentActivity: e.progress.recentActivity.map(activity => ({ ...activity, sequence: activity.sequence + preparationEvents })) } : e.progress,
      });
      console.error(`KRDSPROGRESS ${payload}`);
    },
  });
  if (tunnelFailure) throw tunnelFailure;
  // --out-file bypasses shell redirection entirely (PowerShell `>` forces
  // UTF-16); stdout stays a fallback for piped Tauri capture (bytes).
  const text = json.endsWith("\n") ? json : `${json}\n`;
  if (args.outFile) writeFileSync(args.outFile, text, "utf8");
  else writeFileSync(1, text);
  for (const [scope,path,value] of [["detail",args.detailOutFile,()=>JSON.stringify(detailBundle)],["extras",args.extraOutFile,()=>extraJson]] as const) {
    if (!path) continue;
    try {writeFileSync(path,value(),"utf8");}
    catch {console.error(`KRDSISSUE ${JSON.stringify({code:"OPTIONAL_WRITE_FAILED",scope,retryable:false})}`);}
  }
  } finally { await runtime?.close(); commands.close(); }
}

void main().catch((err: unknown) => {
  if (err instanceof WarpRuntimeError) console.error(`KRDSWARPERROR ${JSON.stringify({ code: err.code })}`);
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
