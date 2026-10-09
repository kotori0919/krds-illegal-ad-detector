import { createServer } from "node:http";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import { crawlSite } from "../src/crawl.js";

/** Linux whole test-host/browser descendant RSS, sampled at 25ms. RSS sums
 * double-count shared mappings; this is an observed comparison, not a RAM cap.
 */
function processTreeRssKiB(): number | undefined {
  if (process.platform !== "linux") return undefined;
  const processes: { pid: number; parent: number; rss: number }[] = [];
  for (const name of readdirSync("/proc")) {
    if (!/^\d+$/.test(name)) continue;
    try {
      const status = readFileSync(`/proc/${name}/status`, "utf8");
      processes.push({ pid: Number(name), parent: Number(status.match(/^PPid:\s+(\d+)/m)?.[1]), rss: Number(status.match(/^VmRSS:\s+(\d+)/m)?.[1] ?? 0) });
    } catch { /* Process may exit between inventory and status read. */ }
  }
  const descendants = new Set([process.pid]);
  for (let changed = true; changed;) {
    changed = false;
    for (const item of processes) if (descendants.has(item.parent) && !descendants.has(item.pid)) { descendants.add(item.pid); changed = true; }
  }
  return processes.reduce((sum, item) => sum + (descendants.has(item.pid) ? item.rss : 0), 0);
}

it("bounds collected bytes/items while varying DOM, frame and resource dimensions independently", async () => {
  const observations: object[] = [];
  let resourceRequests = 0;
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://fixture.invalid");
    if (url.pathname === "/robots.txt") { response.end(""); return; }
    if (url.pathname === "/image") { resourceRequests += 1; response.setHeader("content-type", "image/svg+xml"); response.end('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'); return; }
    response.setHeader("content-type", "text/html; charset=utf-8");
    if (url.pathname === "/frame") { response.end('<p id="ad">카지노 가입</p>'); return; }
    const dom = Number(url.searchParams.get("dom") ?? 0);
    const frames = Number(url.searchParams.get("frames") ?? 0);
    const resources = Number(url.searchParams.get("resources") ?? 0);
    response.end(`<body>${'<p>일반 콘텐츠</p>'.repeat(dom)}${Array.from({ length: frames }, (_, index) => `<iframe src="/frame?i=${index}"></iframe>`).join("")}${Array.from({ length: resources }, (_, index) => `<img src="/image?i=${index}">`).join("")}</body>`);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  try {
    for (const input of [{ dom: 100, frames: 0, resources: 0 }, { dom: 25_000, frames: 0, resources: 0 }, { dom: 100, frames: 24, resources: 0 }, { dom: 100, frames: 0, resources: 600 }]) {
      resourceRequests = 0;
      const started = performance.now();
      let peak = processTreeRssKiB() ?? 0;
      const sample = setInterval(() => { peak = Math.max(peak, processTreeRssKiB() ?? 0); }, 25);
      let summary;
      try { summary = await crawlSite({ entryUrl: `${base}/?${new URLSearchParams(Object.entries(input).map(([key, value]) => [key, String(value)]))}`,
        maxBodyBytes: 64 * 1024, settleMs: 100, limits: { maxPages: 1, maxDepth: 0, timeoutSec: 30 } }); }
      finally { clearInterval(sample); }
      const page = summary.pages[0]!;
      expect(page.issue).toBeUndefined();
      const bytes = Buffer.byteLength(page.html) + page.frames.reduce((sum, frame) => sum + Buffer.byteLength(frame.html), 0);
      expect(bytes).toBeLessThanOrEqual(64 * 1024);
      expect(page.frames.length).toBeLessThanOrEqual(15);
      expect(page.externals.length).toBeLessThanOrEqual(500);
      expect(resourceRequests).toBeLessThanOrEqual(499);
      if (input.dom > 20_000) expect(page.collectionIssues).toContain("link-discovery-limit");
      if (input.frames > 15) expect(page.collectionIssues).toContain("frame-count-limit");
      if (input.resources > 500) expect(page.collectionIssues).toContain("request-limit");
      observations.push({ input, elapsedMs: Math.round(performance.now() - started), processTreePeakRssKiB: peak || null,
        retainedSnapshotBytes: bytes, retainedFrames: page.frames.length, resourceRequests, issues: page.collectionIssues ?? [] });
    }
    const report = { method: "one fresh browser launch per row; Linux host + browser descendants RSS sampled 25ms, shared mappings counted per process; no percentile claim", observations };
    if (process.env.KRDS_COLLECTION_REPORT) writeFileSync(process.env.KRDS_COLLECTION_REPORT, JSON.stringify(report, null, 2) + "\n");
    console.info("COLLECTION_OBSERVATIONS", JSON.stringify(report));
  } finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
}, 90_000);
