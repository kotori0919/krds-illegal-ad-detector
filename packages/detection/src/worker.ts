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
interface WorkerArgs {
  session: string;
  entryUrl: string;
  maxPages: number;
  maxDepth: number;
  timeoutSec: number;
  settleMs: number;
  concurrency?: number;
  executablePath?: string;
  channel?: string;
  outFile?: string;
  detailOutFile?: string;
  extraOutFile?: string;
  publicNetworkOnly: boolean;
  entryKind: "site" | "sitemap";
}

function parseArgs(argv: string[]): WorkerArgs {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    session: get("--session") ?? "",
    entryUrl: get("--entry-url") ?? "",
    maxPages: Number(get("--max-pages") ?? 200),
    maxDepth: Number(get("--max-depth") ?? 4),
    timeoutSec: Number(get("--timeout-sec") ?? 1500),
    settleMs: Number(get("--settle-ms") ?? 1500),
    concurrency: get("--concurrency") === undefined ? undefined : Number(get("--concurrency")),
    executablePath: get("--executable-path"),
    channel: get("--channel"),
    outFile: get("--out-file"),
    detailOutFile: get("--detail-out-file"),
    extraOutFile: get("--extra-out-file"),
    publicNetworkOnly: argv.includes("--public-network-only"),
    entryKind: get("--entry-kind") === "sitemap" ? "sitemap" : "site",
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const entryKindIndex = process.argv.indexOf("--entry-kind");
  if (entryKindIndex >= 0 && !["site", "sitemap"].includes(process.argv[entryKindIndex + 1] ?? "")) {
    console.error("--entry-kind must be site or sitemap"); process.exitCode = 2; return;
  }
  if (!args.session || !args.entryUrl) {
    console.error("usage: scanner-worker --session <id> --entry-url <url> [--max-pages n] [--max-depth n] [--timeout-sec s] [--settle-ms ms]");
    process.exitCode = 2;
    return;
  }
  if (args.concurrency !== undefined && (!Number.isInteger(args.concurrency) || args.concurrency < 1 || args.concurrency > 4)) {
    console.error("--concurrency must be an integer from 1 to 4");
    process.exitCode = 2;
    return;
  }
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
    crawl: {
      limits: { maxPages: args.maxPages, maxDepth: args.maxDepth, timeoutSec: args.timeoutSec },
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
  if (args.detailOutFile) writeFileSync(args.detailOutFile, JSON.stringify(detailBundle), "utf8");
  if (args.extraOutFile) writeFileSync(args.extraOutFile, extraJson, "utf8");
  if (args.outFile) writeFileSync(args.outFile, text, "utf8");
  else writeFileSync(1, text);
  } finally { commands.close(); }
}

void main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
