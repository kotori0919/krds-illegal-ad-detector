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

- Worker/crawler accept `--channel`/`channel` and both launches pass
  `--no-sandbox` (needed under SYSTEM session-0).
- `tauri.conf.json` declares `externalBin: ["binaries/scanner-worker"]`
  with a staging README (esbuild + `bun build --compile` recipes).
- VERDICT on this VM (OBSERVED): channel `msedge` does NOT launch here —
  bare `chromium.launch({ channel: msedge })` fails headless AND headed,
  and `msedge.exe --headless --dump-dom` exits 1002 under SYSTEM
  session-0. The running app renders (WebView2 works), so this is an
  Edge-as-Playwright-channel limitation, not a broken browser.
  The `--channel` flag stays optional plumbing; the default path uses
  the Playwright headless shell (proven 17/17 on this VM).
- Clean-evaluator implication: ship the sidecar + Playwright browsers
  (or install headless shell at first run), OR retry channel `msedge`
  in an interactive session where Edge launches.
