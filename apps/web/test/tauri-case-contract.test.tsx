import { afterEach, expect, it, vi } from "vitest";
import corpus from "../../../packages/contracts/test/fixtures/case-conformance.json";
import { TauriHost } from "../src/host/tauri.js";

const boundary = vi.hoisted(() => ({ value: undefined as unknown }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: async () => boundary.value }));
vi.mock("@tauri-apps/api/event", () => ({ listen: async () => () => {} }));
afterEach(() => { boundary.value = undefined; });
const caseId = corpus.valid.manifest.caseId;

it("rejects unsupported case data before it reaches the review UI", async () => {
  boundary.value = { manifest: { ...corpus.valid.manifest, schemaVersion: 2 }, review: corpus.valid.review, directory: "cases/example" };
  await expect(new TauriHost().openCase(caseId)).rejects.toThrow("INVALID_CASE_CONTRACT");
  boundary.value = { manifest: { ...corpus.valid.manifest, caseId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" }, review: corpus.valid.review, directory: "cases/example" };
  await expect(new TauriHost().openCase(caseId)).rejects.toThrow("case identity disagrees");
});
it("accepts a native case and refuses a stale save acknowledgement", async () => {
  boundary.value = { manifest: corpus.valid.manifest, review: corpus.valid.review, directory: "cases/example" };
  const opened = await new TauriHost().openCase(caseId);
  expect(opened.review.records[0]?.judgment).toBe("suspected");
  boundary.value = corpus.valid.review;
  await expect(new TauriHost().saveCaseReview(caseId, 1, [])).rejects.toThrow("committed successor");
});
it("refuses malformed native catalog and import values", async () => {
  boundary.value = { schemaVersion: 1, storageRoot: "cases", limit: 200, cases: [], issues: [{ code: "CORRUPT", caseId: "case", retryable: "yes" }] };
  await expect(new TauriHost().listCases()).rejects.toThrow("INVALID_CASE_CONTRACT");
  boundary.value = "../../escape";
  await expect(new TauriHost().importCase()).rejects.toThrow("invalid imported case identity");
  boundary.value = null;
  expect(await new TauriHost().importCase()).toBeNull();
});
