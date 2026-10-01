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

## Verification status (honest, updated Windows VM 2026-10-01)

- Web on Windows VM: `npm ci` PASS; `typecheck` PASS; `lint` PASS;
  production `vite build` PASS; full `vitest` 12 files / 73 tests PASS
  (after `playwright-core install chromium --only-shell`).
- Windows cross-check from Linux: `cargo check --target
  x86_64-pc-windows-msvc` green (warnings only).
- `cargo test` on Windows: PASS via MinGW-w64 GCC 16.2 (gnu host toolchain,
  3 passed / 0 failed) — the MSVC lane stays BLOCKED (SDK import libs absent),
  so the gnu lane is the executed evidence and MSVC remains the packaging lane.
- MSVC `link.exe` present (14.44) but
  the Windows 11 SDK import libs (`kernel32.lib`, `ucrt.lib`) are absent
  and every install channel tried failed silently (Build Tools modify,
  standalone winsdksetup, VS-installer modify). Even `cargo new` hello-world
  fails at LNK1181. Dead ends recorded, do NOT retry without a new channel:
  (a) dumpbin/lib.exe vendored import libs — built, but UCRT needs more
  than kernel32 (mainCRTStartup/_tls_index/type_info unresolved);
  (b) MinGW `.a` renamed to `.lib` — COFF-incompatible for MSVC link;
  (c) raw-dylib `#[link(kind="raw-dylib")]` — fixes OUR crate only, std
  build scripts still demand the real SDK libs.
- Next Windows step: install Visual Studio with the
  "Desktop development with C++" workload + Windows 11 SDK component on a
  network that allows the VS installer payload, OR provision a fresh VM
  image with the SDK preinstalled. Then: `cargo test` → `cargo build
  --release` → `tauri build` (NSIS) → clean-install → CUA user flow.
- Windows test matrix (Phase 19): normal completion, cancel, scanner crash,
  browser crash, app-close-during-scan, repeat-after-failure — all funnel
  through `kill_child` + Job Drop; execution on Windows pending SDK.
