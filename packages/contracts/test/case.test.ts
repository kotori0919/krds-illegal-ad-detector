import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { isCaseManifest, isCaseReview, isCaseList, isOpenCase } from "../src/case.js";
import type { OfficialResult } from "../src/result.js";

const corpus = JSON.parse(readFileSync(new URL("./fixtures/case-conformance.json", import.meta.url), "utf8")) as {
  valid: { official: OfficialResult; manifest: unknown; review: unknown };
  invalid: { kind: "manifest" | "review"; name: string; path: (string | number)[]; value: unknown }[];
};
it("accepts the durable case and review against their official result", () => {
  expect(isCaseManifest(corpus.valid.manifest, corpus.valid.official)).toBe(true);
  expect(isCaseReview(corpus.valid.review, corpus.valid.official)).toBe(true);
  expect(isOpenCase({ manifest: corpus.valid.manifest, review: corpus.valid.review, directory: "cases/example" })).toBe(true);
});
it.each(corpus.invalid)("rejects shared $kind boundary: $name", sample => {
  const value = structuredClone(corpus.valid[sample.kind]);
  let target = value as Record<string | number, unknown>;
  for (const key of sample.path.slice(0, -1)) target = target[key] as Record<string | number, unknown>;
  target[sample.path.at(-1)!] = sample.value;
  expect(sample.kind === "manifest" ? isCaseManifest(value, corpus.valid.official) : isCaseReview(value, corpus.valid.official)).toBe(false);
});
it("accepts the unsaved empty review and rejects duplicate catalog identities", () => {
  expect(isCaseReview({ schemaVersion: 1, revision: 0, updatedAt: "", records: [] }, corpus.valid.official)).toBe(true);
  const saved = { manifest: corpus.valid.manifest, directory: "cases/example", reviewRevision: 1 };
  expect(isCaseList({ schemaVersion: 1, storageRoot: "cases", cases: [saved, saved], issues: [], limit: 200 })).toBe(false);
});

it("reopens failed transport cases without changing official data and rejects secret metadata", () => {
  const manifest = { ...(corpus.valid.manifest as Record<string, unknown>), status: "failed", settings: {
    transport: { kind: "warp", backend: "usque", version: "4.2.1" },
    transportFailure: { code: "tunnel-exited", scope: "incomplete" },
  } };
  expect(isCaseManifest(manifest, corpus.valid.official)).toBe(true);
  expect(isCaseManifest({ ...manifest, settings: { transport: { ...manifest.settings.transport, token: "private-fixture" } } })).toBe(false);
  expect(isCaseManifest({ ...manifest, settings: { transportFailure: { code: "raw-secret", scope: "incomplete" } } })).toBe(false);
  expect(isCaseManifest({ ...manifest, settings: { transport: { kind: "direct", reason: "source-cli" } } })).toBe(true);
});

it.each(["succeeded", "cancelled"])("rejects incomplete transport metadata with %s status", status => {
  const manifest = { ...(corpus.valid.manifest as Record<string, unknown>), status,
    settings: { transportFailure: { code: "tunnel-exited", scope: "incomplete" } } };
  expect(isCaseManifest(manifest, corpus.valid.official)).toBe(false);
  expect(isOpenCase({ manifest, review: corpus.valid.review, directory: "cases/example" })).toBe(false);
});

it.each(["succeeded", "cancelled", "failed"])("preserves %s cases without transport metadata", status => {
  expect(isCaseManifest({ ...(corpus.valid.manifest as Record<string, unknown>), status, settings: {} }, corpus.valid.official)).toBe(true);
});
