# Revision 2 final source typecheck and lint — PASS

Product identity SHA-256: **4125496324d80b8da50a5407510a67595e16cb25004b42490ec342a9981b7993**. All 23 product/document hashes matched before and after all checks. No product source, original config, emitted dist, commit/main/push, model/browser/VM, global/swap/network/security or other-process changes.

| Check | Result | Peak scope RAM | Exit |
|---|---|---|---|
| Source noEmit typecheck: contracts, synth-eval, scanner, detection, evidence, web, sequential | 6/6 passed | 335024128 bytes /319.504 MiB | 0 for all six |
| Existing ESLint rules on 265 fixed standard source files | 0 errors, 0 warnings | 317186048 bytes /302.492 MiB | 0 |

Both actual own scopes verified MemoryHigh384 MiB, MemoryMax512 MiB, swap0, CPU50%, Tasks48, whole-scope120s/SIGKILL deadline; existing aggregate2 GiB/shared flock/durable reservation remained unchanged. Node heap was fixed384 MiB; UV/OMP/BLAS/Rayon worker environment1. No simultaneous checker/linter processes or job workers were launched. No timeout, high/max/oom/oom_kill or other memory.events counter increment; swap.current0. Scope budget was not raised and no resource/OOM failure was retried.

Final independent check: both exact scopes inactive/success, aggregate TasksCurrent0, reservation absent. Final host MemAvailable9701 MiB, free swap rounded13 MiB, PSI some/full averages0.00. These observations do not authorize heavy/model/VM work.

## Commands and scope

Fixed local Node: /home/monad/.hermes/node/bin/node.

Typechecker: /home/monad/Documents/Codex/2026-10-26/task/krds-adult-semantic/node_modules/typescript/bin/tsc. Each of six invocations used `--pretty false --noEmit --incremental false --composite false -p` followed by its fixed task-local STATIC-R2-TYPECHECK-PATHFIX-<project>.json. The exact six argv arrays, environment and source/config/tool hashes are in STATIC-R2-TYPECHECK-PATHFIX-MANIFEST.json; each successful step is recorded in audit and output.

The original package typecheck starts with `tsc -b`, which emits and was not run. Task-local configs inherit each existing check config (web inherits its project config), preserve its strictness/noUnused/JSX/include behavior, disable emit/declarations/incremental/composite/references, explicitly resolve JSON and alias workspace package exports to current sources instead of stale dist. TypeRoots points to the worktree's node_modules/@types; web's explicit vite/client type is pinned by absolute declaration path. This is a noEmit source projection, not a claim that the literal npm lifecycle/build script was executed. Typechecking reads declarations/source; it does not execute OCR/model/browser code.

Linter: /home/monad/Documents/Codex/2026-10-26/task/krds-adult-semantic/node_modules/eslint/bin/eslint.js with `--no-cache --no-fix --config <worktree>/eslint.config.mjs --format json --output-file <task>/STATIC-R2-LINT-RESULT.json` and the 265 exact file arguments listed in STATIC-R2-LINT-FILES.json. Standard tracked/nonignored source .ts/.tsx/.mjs/.cjs files were selected, excluding existing global-ignore/generated/dependency/target/artifact paths. Existing rules unchanged; no recursive model asset scan, fix, npm/npx, install or lifecycle command. Exact argv is in STATIC-R2-LINT-MANIFEST.json.

## Initial execution-config failure and correction

The first task-local typecheck profile omitted relocated type lookup roots: contracts passed, the other five returned TS2688 (`node` or `vite/client` type library unresolved). This was guard-owner setup failure, not evidence of product type errors or memory-budget failure. Its peak was249597952 bytes and memory.events all0. Preserve original STATIC-R2-FINAL-CHECKS.json, STATIC-R2-TYPECHECK-* manifest/config/output/marker/audit.

Only task-local type resolution paths were corrected in a new fixed profile, `r2-typecheck-pathfix`, with a new manifest/config/marker/output. Product, resource limits, admission, compiler strictness and scope120s were not changed. All six then exited0 without TypeScript diagnostics. The first marker/results were not deleted or overwritten. Lint passed on its first attempt and was not rerun.

## Evidence and hashes

Directory: /home/monad/Documents/Codex/2026-10-26/task-2

- STATIC-R2-FINAL-CHECKS-COMPLETE.json: final checks, six per-project exits, actual peak/events/deadlines, unit IDs and all 23 before/after hashes; source_unchanged=true.
- STATIC-R2-TYPECHECK-PATHFIX-OUTPUT.log: exact six commands, no compiler diagnostics; GUARD.log and MANIFEST.json share that stem.
- STATIC-R2-LINT-RESULT.json: 265 files, 0 errors/0 warnings; OUTPUT.log, GUARD.log and MANIFEST.json share that stem.
- GUARD-AUDIT.jsonl: per-step metrics, verified own/aggregate limits, completion/events/cleanup.
- STATIC-R2-FINAL-CHECKS-GUARD.diff: workload-only new profiles/budgets/deadlines/serial fixed-command handling, no general gate relaxation.

| Executed artifact | SHA-256 |
|---|---|
| Successful typecheck manifest | 15aaac11ce7d8623f51799ce405198b71d46012f0fb94cf80e4ad02490a19bfb |
| Typecheck executed wrapper | e5153862eb362086d4c23467a3f2292237947cd8f4e05aea5e8f93393967298d |
| Lint manifest | 59db8f9b330cf31016bb90e35ca852af872f5959064e956511ad37c6727e4be9 |
| Lint executed wrapper (before the new type-pathfix key) | 74b6b2d5a21c2c340f29aa15686e01e0171143adef082c0a517675dc4f5b7a3d |

Successful typecheck unit: codex-krds-guard-e7a4c5bfe1ab41e6849fed8f774e5c7b.scope. Lint unit: codex-krds-guard-473cc2d285a047f78036fa7d3513558a.scope. Both ended and no reservation remains. Native Rust mapping/deserialization/build, full browser/model inference and broader regression remain unexecuted; earlier108 mock/pure passes remain separate r2 evidence. No approval denied/pending and no cleanup blocker.
