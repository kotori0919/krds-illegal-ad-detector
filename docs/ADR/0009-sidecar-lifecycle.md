# ADR-0009: Sidecar owns detection, Tauri owns lifecycle

Status: accepted.

## Context

KODEX §13 forbids detection semantics in Tauri commands; KODEX §15 requires
whole-tree cleanup (Tauri → worker → browser → renderers). A Tauri-native
detection port would duplicate the TypeScript pipeline in Rust.

## Decision

- Scanner sidecar (Node worker bundling the frozen pipeline) owns crawl +
  detection + validation; stdout carries `result.json` only.
- Tauri owns hosting, IPC, lifecycle, export, and Windows Job Objects.
- Frontend supplies scan parameters; never shell strings (no arbitrary
  execution surface).
- Windows Job `KILL_ON_JOB_CLOSE` is the cleanup mechanism; POSIX
  `kill_on_drop` is the CI equivalent.

## Consequences

- One detection codebase (TypeScript) serves tests, worker, and future
  packaging; Rust stays small and auditable.
- Windows build + Job behavior verified in the Phase 23 dry run; Linux CI
  covers web/type/test/build only.
