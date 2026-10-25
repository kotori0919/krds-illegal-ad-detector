# Revision 2 bounded validation — 108/108 PASS

Identity: /home/monad/Documents/Codex/2026-10-26/task/krds-adult-semantic/docs/validation/STATIC_CORRECTIONS_IDENTITY.r2.json

Identity SHA-256: **4125496324d80b8da50a5407510a67595e16cb25004b42490ec342a9981b7993**. All 23 listed source/document hashes matched before and after. Revision report hash also matched. No product source edits during validation.

Sequential execution: **2026-10-26 08:09:34–08:10:08 KST**. Each file had a new fixed revision profile, manifest, config, marker, stdout and JSON result; no existing marker/result was reused.

| Profile / file | Expected / collected / passed | Peak bytes (MiB) | Exit / scope result |
|---|---|---|---|
| r2-semantic-27 / adult-context.test.ts | 27 / 27 / 27 | 92680192 (88.387) | 0 / success |
| r2-ocr-11 / ocr-diagnostics.test.ts | 11 / 11 / 11 | 98234368 (93.684) | 0 / success |
| r2-result-19 / result.test.ts | 19 / 19 / 19 | 90714112 (86.512) | 0 / success |
| r2-config-13 / config.test.ts | 13 / 13 / 13 | 84557824 (80.641) | 0 / success |
| r2-case-38 / case.test.ts | 38 / 38 / 38 | 89190400 (85.059) | 0 / success |

All five scopes: swap.current=0; memory.events low/high/max/oom/oom_kill/oom_group_kill/sock_throttled all zero; no timeout; no resource failure, retry or budget increase. Each aggregate-after pids.current=0 and reservation absent. Independent final systemctl reads confirmed every exact scope inactive/success, aggregate TasksCurrent=0, reservation absent. No functional failure/trace to report.

Native Rust mapping and new missing/null policy-field regression remain **NOT_RUN**: compiling the revised Rust test binary requires a build and was not authorized. TS passes do not establish native deserialization/storage/restart parity. Browser, real OCR/EmbeddingGemma/native inference, model failure, full suites, typecheck/lint/build and VM were not exercised.

## Fixed execution

Same approved policy as the prior fixed experiment: MemoryHigh192 MiB / MemoryMax256 MiB, swap0, CPU25%, Tasks32, runner1/worker1, whole-scope RuntimeMaxSec30s with scope-wide deadline. Existing shared flock, durable pre-spawn reservation/child acknowledgement, actual own/aggregate cgroup checks and quantified parent/child admission were retained unchanged. Ordinary/light gates and aggregate2 GiB ceiling were not relaxed. All jobs were sequential, one attempt each.

Only five explicit keys were added to FIXED_PROFILES; exact diff: STATIC-R2-GUARD.diff. Wrapper SHA-256: **7144b173a7e7d4d0dbf433773d5a28efa64a095851a276d7fd15d879797e0acd**. Python syntax and 10 guard unit tests passed before dispatch.

Each config includes exactly its one file and excludes browser setup. OCR remains hoisted-mock fork; semantic tests are pure grammar calls; contracts tests use local fixed JSON fixtures. New r2 tests were read before execution and introduce no model/browser/real OCR child/build path. Vitest's bounded runner/worker and transform helper are included in reported memory peaks; these are not EmbeddingGemma memory measurements.

## Exact artifacts

Directory: /home/monad/Documents/Codex/2026-10-26/task-2

- STATIC-R2-VALIDATION-BATCH.json: all counts/exits/unit IDs/child peak/events/parent observations/cleanup and complete 23-file before/after SHA-256 maps; source_unchanged=true, r1_artifacts_preserved=true.
- For stems STATIC-R2-SEMANTIC-27, STATIC-R2-OCR-11, STATIC-R2-RESULT-19, STATIC-R2-CONFIG-13, STATIC-R2-CASE-38: separate `*-MANIFEST.json`, `*.vitest.config.mjs`, `*-ATTEMPT.json`, `*-GUARD.log`, `*-OUTPUT.log`, `*-RESULT.json`.
- GUARD-AUDIT.jsonl: appended actual limit/admission/peak/events/exit records; prior events retained.
- STATIC-R2-PREVIOUS-ARTIFACT-HASHES.json: hashes of 35 pre-existing r1/static artifacts, all unchanged after r2. Prior OCR8 and r1/89 PASS evidence remain distinct historical results.

| r2 manifest | SHA-256 |
|---|---|
| STATIC-R2-SEMANTIC-27-MANIFEST.json | 3108b48c8ddd239d17fe857e35defd6646c35559038a686300105eeca181f63b |
| STATIC-R2-OCR-11-MANIFEST.json | 2e644e2bfb3994430b969795f1b5c43e1558ac2a948b7daea0b522d09ea79bc0 |
| STATIC-R2-RESULT-19-MANIFEST.json | 21542f535ec90fae61834795304fbaee3de505966089e59fe322210c86f8cdfd |
| STATIC-R2-CONFIG-13-MANIFEST.json | 13d1d21be39eb236eb943cc03fd682ce9d5f98f0b6f01fe95304039297bfbce9 |
| STATIC-R2-CASE-38-MANIFEST.json | f4d5fa7f71e82f0fb2e379ebaa106becbb3e23c2e5c4e3c025633a7f5cef46a1 |

Final host reading: MemAvailable9772 MiB, swap free rounded3 MiB, PSI some/full avg10/60/300=0.00. No other service/process, swap/global/network/security setting, VM/ZIP, main/commit/push or Tasks state changed. No denied/pending approval or cleanup blocker. No further dispatch is authorized by these one-shot markers; future revisions need new reviewed identities.
