import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crawlSite } from "../src/crawl.js";

let server: Server;
let origin = "";
const requests = new Map<string, number>();

beforeAll(async () => {
  server = createServer((request, response) => {
    const path = new URL(request.url ?? "/", "http://fixture.local").pathname;
    requests.set(path, (requests.get(path) ?? 0) + 1);
    response.setHeader("content-type", "text/html; charset=utf-8");
    if (path === "/") {
      response.end(Array.from({ length: 8 }, (_, index) => `<a href="/p${String(index + 1)}">page</a>`).join(""));
    } else {
      response.end("<p>ordinary page</p>");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture port unavailable");
  origin = `http://127.0.0.1:${String(address.port)}`;
});
afterAll(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); });

describe("bounded live page worker pool", () => {
  it("runs concurrent page callbacks up to the selected cap without losing the frontier", async () => {
    for (const concurrency of [1, 2, 3, 4]) {
      requests.clear();
      let active = 0;
      let peak = 0;
      let entered = 0;
      let release: (() => void) | undefined;
      let gate: Promise<void> | undefined;
      let gateTimer: ReturnType<typeof setTimeout> | undefined;
      try {
        const summary = await crawlSite({
          entryUrl: `${origin}/`, concurrency, settleMs: 0, perPageMs: 8_000,
          limits: { maxPages: 9, maxDepth: 1, timeoutSec: 30 },
          onLivePage: async (_page, snapshot) => {
            if (snapshot.depth === 0) return;
            if (!gate) {
              gate = new Promise<void>((resolveGate) => { release = resolveGate; });
              gateTimer = setTimeout(() => release?.(), 5_000);
            }
            active += 1;
            peak = Math.max(peak, active);
            entered += 1;
            if (entered === concurrency) { clearTimeout(gateTimer); release?.(); }
            try { await gate; } finally { active -= 1; }
          },
        });
        expect(summary.timedOut).toBe(false);
        expect(summary.pages.map((page) => new URL(page.url).pathname).sort())
          .toEqual(["/", ...Array.from({ length: 8 }, (_, index) => `/p${String(index + 1)}`)].sort());
        expect(peak).toBe(concurrency);
        for (const path of ["/", ...Array.from({ length: 8 }, (_, index) => `/p${String(index + 1)}`)]) {
          expect(requests.get(path)).toBe(1);
        }
      } finally {
        if (gateTimer) clearTimeout(gateTimer);
      }
    }
  }, 30_000);

  it("rejects an override above the hard cap before starting navigation", async () => {
    requests.clear();
    await expect(crawlSite({ entryUrl: `${origin}/`, concurrency: 5 }))
      .rejects.toThrow("page concurrency must be between 1 and 4");
    expect(requests.size).toBe(0);
  });
});
