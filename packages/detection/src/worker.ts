//! Scanner worker sidecar (Node): crawl + detect + validate + print.
//!
//! The Tauri host spawns this worker with `--session <id>`; it writes
//! validated result.json to stdout (BOM-free) and exits. Stdout is JSON only;
//! diagnostics go to stderr. This keeps detection semantics out of Tauri
//! commands (KODEX §13) and makes the worker testable headlessly.

import { crawlSite } from "@krds-detector/scanner";
import { detectPageCandidates } from "./pipeline.js";
import { buildOfficialResult, serializeValidatedResult } from "./result-engine.js";
import { chromium } from "playwright-core";

interface WorkerArgs {
  session: string;
  entryUrl: string;
  topic: string;
  maxPages: number;
  maxDepth: number;
  timeoutSec: number;
  settleMs: number;
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
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.session || !args.entryUrl) {
    console.error("usage: scanner-worker --session <id> --entry-url <url> [--topic t] [--max-pages n] [--max-depth n] [--timeout-sec s] [--settle-ms ms]");
    process.exitCode = 2;
    return;
  }
  const startedAt = new Date().toISOString();
  const summary = await crawlSite({
    entryUrl: args.entryUrl,
    limits: { maxPages: args.maxPages, maxDepth: args.maxDepth, timeoutSec: args.timeoutSec },
    settleMs: args.settleMs,
  });
  const browser = await chromium.launch();
  const allCandidates = [];
  try {
    const context = await browser.newContext();
    for (const snapshot of summary.pages) {
      const page = await context.newPage();
      try {
        await page.goto(snapshot.url, { waitUntil: "commit", timeout: 20000 });
        await page.waitForTimeout(Math.min(args.settleMs, 5000));
        const found = await detectPageCandidates(page, { pageUrl: snapshot.url });
        for (const c of found) allCandidates.push(c);
      } finally {
        await page.close().catch(() => undefined);
      }
      for (const frame of snapshot.frames) {
        const framePage = await context.newPage();
        try {
          await framePage.goto(frame.url, { waitUntil: "commit", timeout: 20000 });
          await framePage.waitForTimeout(500);
          const chain = frame.srcChain.map((src, i) => ({ src, selector: frame.selectorChain[i] ?? "iframe" }));
          const found = await detectPageCandidates(framePage, { pageUrl: frame.url, framePath: chain, baseUrl: snapshot.finalUrl });
          for (const c of found) allCandidates.push(c);
        } finally {
          await framePage.close().catch(() => undefined);
        }
      }
    }
    await context.close();
  } finally {
    await browser.close();
  }
  const finishedAt = new Date().toISOString();
  const result = buildOfficialResult(
    { topic: args.topic, entryUrl: args.entryUrl, startedAt, finishedAt },
    allCandidates,
  );
  process.stdout.write(serializeValidatedResult(result));
}

void main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
