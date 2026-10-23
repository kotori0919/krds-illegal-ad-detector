import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { batchGroupProgress, isBatchGroup, isBatchGroupList, isBatchGroupId, type BatchGroup } from "../src/batch-group.js";

const corpus = JSON.parse(readFileSync(new URL("./fixtures/batch-group-conformance.json", import.meta.url), "utf8")) as {
  valid: unknown;
  invalid: { name: string; path: (string | number)[]; value: unknown }[];
};

it("accepts a durable batch group with one completed and one pending target", () => {
  expect(isBatchGroup(corpus.valid)).toBe(true);
  const group = corpus.valid as BatchGroup;
  expect(batchGroupProgress(group)).toEqual({ completed: 1, total: 2, incomplete: 1 });
});

it.each(corpus.invalid)("rejects batch group boundary: $name", (sample) => {
  const value = structuredClone(corpus.valid) as Record<string | number, unknown>;
  let target = value;
  for (const key of sample.path.slice(0, -1)) target = target[key] as Record<string | number, unknown>;
  target[sample.path.at(-1)!] = sample.value;
  expect(isBatchGroup(value)).toBe(false);
});

it("keeps a list of groups free of duplicate identities and rejects unsafe ids", () => {
  const group = corpus.valid as BatchGroup;
  expect(isBatchGroupList({ schemaVersion: 1, groups: [group], issues: [] })).toBe(true);
  expect(isBatchGroupList({ schemaVersion: 1, groups: [group, group], issues: [] })).toBe(false);
  expect(isBatchGroupList({ schemaVersion: 1, groups: [group], issues: [{ code: "BATCH_GROUP_UNAVAILABLE", groupId: "x" }] })).toBe(true);
  expect(isBatchGroupId(group.groupId)).toBe(true);
  for (const id of ["../escape", "not-a-uuid", "", group.groupId + "/../x"]) expect(isBatchGroupId(id)).toBe(false);
});
