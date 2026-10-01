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

- Windows build + Job behavior verified in the Phase 23 dry run; Linux CI
  covers web/type/test/build only.

## Amendment 2026-10-02: browser channel + sidecar bundling

- Worker/crawler accept `--channel`/`channel` (e.g. `msedge`): on evaluator
  PCs with no Playwright browser download, the sidecar drives the inbox
  Edge via `chromium.launch({ channel })` — zero extra download.
- `tauri.conf.json` declares `externalBin: ["binaries/scanner-worker"]`
  (Tauri sidecar convention: `<name>-<target-triple>` binaries staged
  under `src-tauri/binaries/`); `scan_start` passes `--channel msedge` so
  the packaged app prefers the inbox browser.
- Runtime chain on clean Windows 11: WebView2 (inbox) for UI + Edge
  (inbox) for scanning + single-file sidecar — no Node.js install needed
  if the sidecar is compiled (`bun build --compile`, 86 MB measured),
  or Node.js + `node_modules` + `playwright-core msedge` if shipped as JS.
