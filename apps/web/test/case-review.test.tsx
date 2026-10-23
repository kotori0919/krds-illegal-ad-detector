// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import type { CaseReview, HostBridge, OpenCase, ReviewRecord } from "@krds-detector/contracts";
import { CaseReviewWriter } from "../src/useCaseReview.js";
import { BrowserHost } from "../src/host/browser.js";

/** Test-only storage adapter. Implements revision transactions; never ships as live evidence. */
class ReviewStore extends BrowserHost {
  stored: CaseReview = { schemaVersion: 1, revision: 0, updatedAt: "2026-10-09T00:00:00Z", records: [] };
  delay?: Promise<void>;
  afterCommit?: () => void;
  inFlight = 0; maximumInFlight = 0;
  override async openCase(): Promise<OpenCase> {
    return { directory: "/test-only/case", manifest: { schemaVersion: 1, caseId: "case", entryUrl: "https://fixture.example/", startedAt: "2026-10-09T00:00:00Z", finishedAt: "2026-10-09T00:01:00Z", exportableAt: "2026-10-09T00:01:01Z", status: "succeeded", toolVersion: "test", policyVersion: 2, officialSha256: "0".repeat(64), findings: 2, issues: [], settings: {} }, review: structuredClone(this.stored) };
  }
  override async saveCaseReview(_caseId: string, expected: number, records: ReviewRecord[]): Promise<CaseReview> {
    this.inFlight++; this.maximumInFlight = Math.max(this.maximumInFlight, this.inFlight);
    try {
      const delay = this.delay; this.delay = undefined; await delay;
      if (expected !== this.stored.revision) throw new Error("REVIEW_CONFLICT");
      this.stored = { schemaVersion: 1, revision: expected + 1, updatedAt: new Date().toISOString(), records: structuredClone(records) };
      const saved = structuredClone(this.stored);
      const after = this.afterCommit; this.afterCommit = undefined; after?.();
      return saved;
    } finally { this.inFlight--; }
  }
}
const record = (findingId: string, note: string): ReviewRecord => ({ findingId, note, state: "needed", judgment: "needs-more-evidence", at: new Date().toISOString() });
const pending: CaseReviewWriter[] = [];
afterEach(() => { for (const writer of pending.splice(0)) for (const state of writer.states.values()) if (state.timer) clearTimeout(state.timer); });
const writerFor = (host: HostBridge) => { const writer = new CaseReviewWriter(host, () => {}); pending.push(writer); return writer; };
const untilSaved = async (writer: CaseReviewWriter) => {
  for (let index = 0; index < 30 && writer.state("case").status !== "saved"; index++) await new Promise((resolve) => setTimeout(resolve, 1));
  expect(writer.state("case").status).toBe("saved");
};

describe("case review transactions", () => {
  it("reloads a restored case with the same ID and revision before another edit", async () => {
    const host = new ReviewStore();
    host.stored = { ...host.stored, revision: 1, records: [record("a", "deleted case memo")] };
    const writer = writerFor(host); await writer.load("case");
    // Deletion and importing a backup can replace the disk state without changing its ID or revision.
    host.stored = { ...host.stored, records: [record("b", "restored backup memo")] };
    await writer.load("case");
    expect(Object.keys(writer.state("case").records)).toEqual(["b"]);
    expect(writer.state("case").records.b?.note).toBe("restored backup memo");
    writer.edit("case", (previous) => ({ ...previous, b: record("b", "new edit after restore") }));
    expect(await writer.prepareClose()).toBe(true);
    expect(host.stored.records.map(({ findingId, note }) => [findingId, note])).toEqual([["b", "new edit after restore"]]);
  });

  it("waits for the active save before reloading its review revision", async () => {
    const host = new ReviewStore(); const writer = writerFor(host); await writer.load("case");
    let release!: () => void; host.delay = new Promise<void>((resolve) => { release = resolve; });
    writer.edit("case", () => ({ a: record("a", "in-flight memo") }));
    const saving = writer.flush("case");
    const reloading = writer.load("case");
    release(); await saving; await reloading;
    expect(writer.state("case").revision).toBe(1);
    expect(writer.state("case").records.a?.note).toBe("in-flight memo");
    writer.edit("case", () => ({ a: record("a", "after reopen") }));
    expect(await writer.prepareClose()).toBe(true);
    expect(host.stored.revision).toBe(2);
    expect(host.stored.records[0]?.note).toBe("after reopen");
    expect(host.maximumInFlight).toBe(1);
  });

  it("keeps edits made during reload until the durable revision has been read", async () => {
    const host = new ReviewStore(); const writer = writerFor(host); await writer.load("case");
    host.stored = { ...host.stored, revision: 1, records: [record("b", "remote memo")] };
    const open = host.openCase.bind(host);
    let release!: () => void; const gate = new Promise<void>((resolve) => { release = resolve; });
    host.openCase = async () => { await gate; return open(); };
    const reloading = writer.load("case");
    writer.edit("case", (previous) => ({ ...previous, a: record("a", "edit during reload") }));
    await writer.flush("case");
    expect(host.stored.records.map((item) => item.findingId)).toEqual(["b"]);
    expect(writer.state("case").status).toBe("unsaved");
    release(); await reloading; await untilSaved(writer);
    expect(host.stored.records.map(({ findingId, note }) => [findingId, note]).sort())
      .toEqual([["a", "edit during reload"], ["b", "remote memo"]]);
    expect(host.stored.revision).toBe(2);
  });

  it("saves an immediate close without waiting for the debounce timer", async () => {
    const host = new ReviewStore(); const writer = writerFor(host); await writer.load("case");
    writer.edit("case", () => ({ a: record("a", "typed immediately before close") }));
    expect(await writer.prepareClose()).toBe(true);
    const reopened = writerFor(host); await reopened.load("case");
    expect(reopened.state("case").records.a?.note).toBe("typed immediately before close");
  });
  it("persists an immediate close before debounce and waits for an in-flight successor edit", async () => {
    const host = new ReviewStore(); const writer = writerFor(host); await writer.load("case");
    let release!: () => void; host.delay = new Promise<void>((resolve) => { release = resolve; });
    writer.edit("case", () => ({ a: record("a", "first") }));
    const saving = writer.flush("case");
    writer.edit("case", () => ({ a: record("a", "last edit before close") }));
    let finished = false;
    const closing = writer.prepareClose().then((allowed) => { finished = true; return allowed; });
    await Promise.resolve(); expect(finished).toBe(false);
    release(); await saving; expect(await closing).toBe(true);
    const reopened = writerFor(host); await reopened.load("case");
    expect(reopened.state("case").records.a?.note).toBe("last edit before close");
    expect(host.maximumInFlight).toBe(1);
  });

  it("refuses close after a revision conflict and retains the unsaved memo", async () => {
    const host = new ReviewStore(); const writer = writerFor(host); await writer.load("case");
    host.stored = { ...host.stored, revision: 1 };
    writer.edit("case", () => ({ a: record("a", "keep window open") }));
    expect(await writer.prepareClose()).toBe(false);
    expect(writer.state("case").status).toBe("error");
    expect(writer.state("case").records.a?.note).toBe("keep window open");
    expect(host.stored.records).toEqual([]);
  });

  it("serializes rapid edits and reopens the latest memo and judgment through a fresh writer", async () => {
    const host = new ReviewStore(); const writer = writerFor(host); await writer.load("case");
    let release!: () => void; host.delay = new Promise<void>((resolve) => { release = resolve; });
    writer.edit("case", () => ({ a: record("a", "first") }));
    const firstSave = writer.flush("case");
    writer.edit("case", () => ({ a: { ...record("a", "latest memo"), state: "reviewed" } }));
    release(); await firstSave; await untilSaved(writer);
    expect(host.maximumInFlight).toBe(1);
    expect(host.stored.revision).toBe(2);
    const reopened = writerFor(host); await reopened.load("case");
    expect(reopened.state("case").records.a).toMatchObject({ note: "latest memo", state: "reviewed", judgment: "needs-more-evidence" });
  });

  it("keeps an unsaved memo after conflict, then merges an unrelated remote edit on explicit retry", async () => {
    const host = new ReviewStore(); const writer = writerFor(host); await writer.load("case");
    host.stored = { ...host.stored, revision: 1, records: [record("b", "other operator")] };
    writer.edit("case", () => ({ a: record("a", "do not lose this memo") }));
    await writer.flush("case");
    expect(writer.state("case").status).toBe("error");
    expect(writer.state("case").records.a?.note).toBe("do not lose this memo");
    expect(host.stored.records.map((item) => item.findingId)).toEqual(["b"]);
    await writer.load("case"); await untilSaved(writer);
    expect(host.stored.records.map((item) => [item.findingId, item.note]).sort()).toEqual([["a", "do not lose this memo"], ["b", "other operator"]]);
  });

  it("makes unsupported browser persistence an explicit error while keeping local edits", async () => {
    const writer = writerFor(new BrowserHost()); await writer.load("case");
    writer.edit("case", () => ({ a: record("a", "preview-only memo") })); await writer.flush("case");
    expect(writer.state("case").status).toBe("error");
    expect(writer.state("case").records.a?.note).toBe("preview-only memo");
    expect(writer.state("case").loaded).toBe(false);
  });

  it("does not overwrite a later remote change to an already saved record during recovery of another edit", async () => {
    const host = new ReviewStore(); const writer = writerFor(host); await writer.load("case");
    let release!: () => void; host.delay = new Promise<void>((resolve) => { release = resolve; });
    writer.edit("case", () => ({ a: record("a", "saved first") }));
    const first = writer.flush("case");
    writer.edit("case", (previous) => ({ ...previous, b: record("b", "local pending") }));
    host.afterCommit = () => { host.stored = { ...host.stored, revision: 2, records: [record("a", "remote newer")] }; };
    release(); await first;
    for (let index = 0; index < 30 && writer.state("case").status !== "error"; index++) await new Promise((resolve) => setTimeout(resolve, 1));
    expect(writer.state("case").status).toBe("error");
    await writer.load("case"); await untilSaved(writer);
    expect(host.stored.records.map((item) => [item.findingId, item.note]).sort()).toEqual([["a", "remote newer"], ["b", "local pending"]]);
  });
});
