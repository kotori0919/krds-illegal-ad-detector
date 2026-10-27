import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { URL } from "node:url";
import policy from "../../packages/contracts/src/policy.json" with { type: "json" };
import { buildPolicyIdentity } from "../lib/build-policy.mjs";

test("build identity shares detector policy and preserves independent Case schema", () => {
  assert.equal(buildPolicyIdentity.detectorPolicyVersion, policy.detectorPolicyVersion);
  assert.equal(buildPolicyIdentity.caseSchemaVersion, 1);
  assert.ok(Number.isSafeInteger(buildPolicyIdentity.detectorPolicyVersion));
  assert.ok(buildPolicyIdentity.detectorPolicyVersion > 0);
  assert.ok(Object.isFrozen(buildPolicyIdentity));
});

test("desktop manifest consumes shared identity without a literal policy override", async () => {
  // Inspect the wiring without running desktop resources (models, Rust and builds).
  const source = await readFile(new URL("../desktop.mjs", import.meta.url), "utf8");
  assert.match(source, /import \{ buildPolicyIdentity \} from "\.\/lib\/build-policy\.mjs"/);
  assert.match(source, /const manifest = \{[\s\S]*?\.\.\.buildPolicyIdentity, appVersion, source,/);
  assert.doesNotMatch(source, /(?:caseSchemaVersion|detectorPolicyVersion)\s*:/);
});
