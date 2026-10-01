# Desktop host (Phases 18–19)

Thin Tauri 2 host reusing the canonical React UI via `HostBridge`.

## Frontend (`apps/web/src/host/`)

- `browser.ts` — demo/preview host (unchanged behavior).
- `tauri.ts` — `TauriHost`: six narrow IPC commands (`scan_start`,
  `scan_cancel`, `scan_get_session`, `scan_get_result`,
  `scan_get_extra_result`, `scan_export`) + `scan-event` subscription. No
  arbitrary shell execution exposed.
- `index.ts` — `createHost()`: Tauri internals marker → `TauriHost`,
  otherwise `BrowserHost`. Dynamic import keeps `@tauri-apps/api` out of
  the browser bundle.
- `App.tsx` — resolves host asynchronously with a loading status.

## Scanner sidecar (`packages/detection/src/worker.ts`)

Node worker: `crawlSite` → per-page + per-frame live `detectPageCandidates`
→ `buildOfficialResult` → BOM-free `result.json` on stdout (JSON only;
diagnostics on stderr). Tauri spawns it with `--session <id>`; clients pass
scan parameters only, never shell strings.

OBSERVED: `--help` usage exit 2; combined fixture → 2 findings
(HOMOGLYPH + TRANSPARENT); full hub → 17 findings, valid techniques,
no BOM.

## Rust host (`src-tauri/`)

- `main.rs` — six commands, `scan-event` emit, `CREATE_NO_WINDOW` on
  Windows, exit-cleanup hook. `scan_export` rejects empty directories;
  session/result read-back returns `None` until the result-store slice lands
  (explicit, not silent).
- `session.rs` — registry owns children: `kill_on_drop(true)`, `kill_child`
  on cancel, descendant cleanup via Job on Windows.
- `job.rs` — Windows Job Object `KILL_ON_JOB_CLOSE` guard (KODEX §15):
  worker + browser + renderers die with the guard on cancel/crash/exit.
- `job_fallback.rs` — POSIX no-op (CI compiles; submission is Windows).
- `tauri.conf.json` — `kr.go.nia.illegal-ad-detector`, NSIS target,
  restrictive CSP. `capabilities/default.json` — minimal set (event
  emit/listen, dialog open, text-file write).

## Verification status (honest, updated 2026-10-02, HEAD ed5f5ef)

- Packaged scan loop CLOSED in tree (not yet rebuilt on VM): `scan_start`
  forwards entry-url/topic/limits to the sidecar, waits for exit,
  validates stdout (BOM/JSON/official shape), stores canonical
  `result.json`, emits `session-finished`/`session-failed`; registry gains
  result store + snapshot/readback + `wait_sidecar`; `scan_export` writes
  the validated file; worker routes through `scanSite` (ADR-0007) so the
  packaged path cannot drift from the 17/17 e2e seam.
- Linux evidence (OBSERVED): typecheck + lint + 15 files/93 tests + vite
  build green; `cargo check --target x86_64-pc-windows-msvc` green;
  bundled worker 17/17 findings on local fixtures; CI success on ed5f5ef.
- VM rebuild BLOCKED on channel, not code: QGA `guest-exec` returns
  truncated/empty output for multi-statement probes (only trivial
  `Write-Output` round-trips); `where.exe node/git/cargo`, directory
  listings, and drive probes return empty. The VM ran `C:\work\repo`
  builds before (docs/DRY_RUN.md), so toolchains exist — the current
  session cannot address them without an interactive-session channel
  (RDP/WinRM/VNC clipboard or scheduled-task script drop).
- Web on Windows VM (prior session): `npm ci` PASS; `typecheck` PASS;
  `lint` PASS; production `vite build` PASS; full `vitest` PASS
  (after `playwright-core install chromium --only-shell`).
- `cargo test` on Windows (prior session): PASS via MinGW-w64 GCC 16.2
  (gnu host toolchain) — the MSVC lane stays BLOCKED (SDK import libs absent).
- MSVC `link.exe` present (14.44) but the Windows 11 SDK import libs
  (`kernel32.lib`, `ucrt.lib`) are absent and every install channel tried
  failed silently. Dead ends recorded, do NOT retry without a new channel:
  (a) dumpbin/lib.exe vendored import libs; (b) MinGW `.a` renamed to
  `.lib`; (c) raw-dylib fixes our crate only, std build scripts still
  demand the real SDK libs.
- Next Windows step: open an interactive-session channel, then `cargo test`
  → `cargo build --release` (gnu lane) → `tauri build` (NSIS needs MSVC+SDK)
  → clean-install → packaged form-submit + cancel/recovery CUA flow.
- Windows test matrix (Phase 19): normal completion, cancel, scanner crash,
  browser crash, app-close-during-scan, repeat-after-failure — all funnel
  through `kill_child` + Job Drop; packaged execution pending rebuild.
