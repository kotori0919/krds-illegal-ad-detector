import { expect, it } from "vitest";
import { parseWorkerArgs } from "../src/worker-args.js";
const base = ["--session", "owned-worker", "--entry-url", "https://example.test/"];
it("resolves shared defaults and permits bounded short fixture deadlines", () => {
  expect(parseWorkerArgs([...base, "--timeout-sec", "12"]).timeoutSec).toBe(12);
  expect(parseWorkerArgs(base)).toMatchObject({ maxPages: 200, maxDepth: 4, maxFrameDepth: 4, timeoutSec: 1500, concurrency: 2, settleMs: 1500, publicNetworkOnly: false });
  expect(parseWorkerArgs([...base, "--public-network-only"]).publicNetworkOnly).toBe(true);
});
it.each([
  ["--timeout-sec", "0"], ["--timeout-sec", "1501"], ["--max-pages", "0"], ["--max-pages", "2001"],
  ["--max-depth", "11"], ["--concurrency", "1.5"], ["--settle-ms", "5001"], ["--entry-kind", "arbitrary"],
  ["--disable-sandbox"], ["--session", "duplicate"], ["--timeout-sec"],
])("rejects malformed or unsafe CLI settings: %j", (...extra) => { expect(() => parseWorkerArgs([...base, ...extra])).toThrow(); });
it("does not accept credential-bearing URLs or control characters", () => {
  expect(() => parseWorkerArgs(["--session", "test", "--entry-url", "https://user:secret@example.test/"])).toThrow(/without credentials/);
  expect(() => parseWorkerArgs([...base, "--out-file", "unsafe\npath"])).toThrow(/unsafe/);
});
