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
interface WorkerArgs {
  session: string;
  entryUrl: string;
  topic: string;
  maxPages: number;
  maxDepth: number;
  timeoutSec: number;
  settleMs: number;
  executablePath?: string;
  outFile?: string;
}

function parseArgs(argv: string[]): WorkerArgs {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    session: get("--session") ?? "",
    entryUrl: get("--entry-url") ?? "",
    topic: get("--topic") ?? "",
    maxPages: Number(get("--max-pages") ?? 200),
    maxDepth: Number(get("--max-depth") ?? 4),
    timeoutSec: Number(get("--timeout-sec") ?? 1500),
    settleMs: Number(get("--settle-ms") ?? 1500),
    executablePath: get("--executable-path"),
    outFile: get("--out-file"),
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.session || !args.entryUrl) {
    console.error("usage: scanner-worker --session <id> --entry-url <url> [--topic t] [--max-pages n] [--max-depth n] [--timeout-sec s] [--settle-ms ms]");
    process.exitCode = 2;
    return;
  }
  // scanSite owns crawl → live-page detection → validated result.json
  // (the same seam the 17/17 e2e test exercises). Progress events stay on
  // stderr so stdout remains result.json only.
  const startedAt = new Date().toISOString();
  const { json } = await scanSite({
    entryUrl: args.entryUrl,
    topic: args.topic,
    crawl: {
      limits: { maxPages: args.maxPages, maxDepth: args.maxDepth, timeoutSec: args.timeoutSec },
      settleMs: args.settleMs,
      executablePath: args.executablePath,
    },
    onEvent: (e) => {
      console.error(`[${args.session}] ${e.kind} ${e.message ?? ""}`.trimEnd());
    },
  });
  void startedAt;
  // --out-file bypasses shell redirection entirely (PowerShell `>` forces
  // UTF-16); stdout stays a fallback for piped Tauri capture (bytes).
  const text = json.endsWith("\n") ? json : `${json}\n`;
  if (args.outFile) writeFileSync(args.outFile, text, "utf8");
  else writeFileSync(1, text);
}

void main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
