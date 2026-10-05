import { describe, expect, it } from "vitest";
import { CrawlQueue } from "../src/queue.js";

function makeQueue(overrides = {}) {
  return new CrawlQueue("https://example.kr/", "example.kr", {
    maxPages: 10,
    maxDepth: 2,
    ...overrides,
  });
}

describe("CrawlQueue", () => {
  it("starts with the entry page queued", () => {
    const q = makeQueue();
    expect(q.pendingCount).toBe(1);
    expect(q.next()?.url).toBe("https://example.kr/");
  });

  it("dedups trailing-slash and fragment variants", () => {
    const q = makeQueue();
    const first = q.next();
    expect(first).toBeDefined();
    const added = q.discover(first?.url ?? "", 0, ["/page/", "/page#x", "/page"]);
    expect(added.length).toBe(1);
    expect(q.pendingCount).toBe(1);
  });

  it("keeps query-value pages distinct", () => {
    const q = makeQueue();
    q.next();
    const added = q.discover("https://example.kr/", 0, [
      "/board.html?id=101",
      "/board.html?id=102",
    ]);
    expect(added.length).toBe(2);
  });

  it("observes externals without enqueueing", () => {
    const q = makeQueue();
    q.next();
    const added = q.discover("https://example.kr/", 0, [
      "https://ads.example/x",
      "/local",
    ]);
    expect(added.length).toBe(1);
    expect(q.observedExternals.some((e) => e.url === "https://ads.example/x")).toBe(true);
    expect(q.pendingCount).toBe(1);
  });

  it("enforces depth and page bounds", () => {
    const q = makeQueue({ maxDepth: 0, maxPages: 2 });
    const first = q.next();
    const added = q.discover(first?.url ?? "", 0, ["/deep"]);
    expect(added.length).toBe(0);
  });

  it("dedups identical content bodies", () => {
    const q = makeQueue();
    expect(q.isDuplicateContent("same body")).toBe(false);
    expect(q.isDuplicateContent("same body")).toBe(true);
    expect(q.isDuplicateContent("other body")).toBe(false);
  });

});
