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
  try {
  const { json, detailBundle, extraJson } = await scanSite({
    entryUrl: args.entryUrl,
    signal: controller.signal,
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
    },
    onEvent: (e) => {
      // Machine-readable progress for the Tauri host (KODEX §36): the host
      // forwards KRDSPROGRESS lines as scan-event IPC so the progress screen
      // shows real counters. Stdout stays result.json only.
      const payload = JSON.stringify({
        kind: e.kind,
        message: e.message ?? null,
        pageUrl: e.pageUrl ?? null,
        progress: e.progress,
      });
      console.error(`KRDSPROGRESS ${payload}`);
    },
  });
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
  } finally { commands.close(); }
}

void main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
