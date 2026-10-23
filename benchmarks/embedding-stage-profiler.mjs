import { appendFileSync } from "node:fs";
import process from "node:process";
import { performance } from "node:perf_hooks";

// Used only by the diagnostic bundle; never imported by production workers.
export function recordValue(stage, value) {
  appendFileSync(process.env.EMBEDDING_PROFILE_FILE, JSON.stringify({ stage, pid: process.pid, ...value }) + "\n");
}

export function recordStage(stage, start, cpuStart) {
  appendFileSync(process.env.EMBEDDING_PROFILE_FILE, JSON.stringify({ stage, pid: process.pid,
    elapsedMs: performance.now() - start, cpu: cpuStart ? process.cpuUsage(cpuStart) : undefined, rssBytes: process.memoryUsage().rss,
    maxRssKiB: process.resourceUsage().maxRSS }) + "\n");
}

export async function profileAsync(stage, operation) {
  const start = performance.now(), cpuStart = process.cpuUsage();
  try { return await operation(); } finally { recordStage(stage, start, cpuStart); }
}

export function profileSync(stage, operation) {
  const start = performance.now(), cpuStart = process.cpuUsage();
  try { return operation(); } finally { recordStage(stage, start, cpuStart); }
}
