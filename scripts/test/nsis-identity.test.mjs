import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { nsisPayloadIdentity } from "../nsis-identity.mjs";

test("NSIS identity changes only the exact Tauri bundle marker and preserves standalone bytes",()=>{
  const original=Buffer.from("MZ\0controlled fixture prefix\0__TAURI_BUNDLE_TYPE_VAR_UNK\0controlled suffix");
  const before=Buffer.from(original);
  const expected=Buffer.from(original.toString().replace("__TAURI_BUNDLE_TYPE_VAR_UNK","__TAURI_BUNDLE_TYPE_VAR_NSS"));
  const identity=nsisPayloadIdentity(original,"2.12.1");
  assert.equal(identity.sha256,createHash("sha256").update(expected).digest("hex"));
  assert.equal(identity.standaloneSha256,createHash("sha256").update(original).digest("hex"));
  assert.notEqual(identity.sha256,identity.standaloneSha256);
  assert.deepEqual(original,before);
});
test("NSIS identity refuses missing, partial, duplicate markers and unreviewed bundler versions",()=>{
  for(const bytes of [Buffer.from("MZ UNK"),Buffer.from("__TAURI_BUNDLE_TYPE_VAR_UN"),
    Buffer.from("__TAURI_BUNDLE_TYPE_VAR_UNK__TAURI_BUNDLE_TYPE_VAR_UNK")])assert.throws(()=>nsisPayloadIdentity(bytes,"2.12.1"),/exactly one complete/);
  assert.throws(()=>nsisPayloadIdentity(Buffer.from("__TAURI_BUNDLE_TYPE_VAR_UNK"),"2.13.0"),/Review NSIS identity/);
});
