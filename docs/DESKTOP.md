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

## Verification status — read the per-gate verdicts, not the headline

Source implementation, automated tests, Windows build, installation,
GUI acceptance, and competition submission are SEPARATE gates. A PASS
in one never implies the others. Ubuntu's 99 passing tests do not
validate Rust/Tauri, Windows ACLs, packaging, or GUI behavior.

## Verification status (updated 2026-10-02, HEAD 5adba59, HONEST)

- Packaged scan loop IMPLEMENTED and worker-seam-validated (NOT
  desktop-validated):
  `scan_start` forwards entry-url/topic/limits to the sidecar, waits for
  exit, validates stdout (BOM/JSON/official shape), stores canonical
  `result.json`, emits `session-finished`/`session-failed`; registry gains
  result store + snapshot/readback + `wait_sidecar` (+ `--out-file`
  fallback); `scan_export` writes the validated file; worker routes
  through `scanSite` (ADR-0007); `--channel`/`--no-sandbox` plumbing added
  but Edge channel is opt-in (session-0 exit 1002 OBSERVED, ADR-0009).
- Linux evidence (OBSERVED): typecheck + lint + 16 files/99 tests + vite
  build green; `cargo check --target x86_64-pc-windows-msvc --tests`
  green; CI success on HEAD. This validates SOURCE ONLY — not the
  Windows binary, ACLs, packaging, or GUI.
- VM evidence (OBSERVED, this session): QGA file-push channel proven
  (HEAD files installed byte-identical: session `assign_pid` +
  `PLAYWRIGHT_BROWSERS_PATH`, job `assign_pid`, capability
  `windows:[main]`, host subscribe-first, progress polling, strict
  validator, identity tests) —
  5 scan-loop files + 8 sidecar-delta files + sandbox fix synced,
  `tsc` + contract tests green on VM, worker bundle rebuilt on VM
  (38674 bytes, `--help` exit 2), sidecar staged at
  `src-tauri/binaries/scanner-worker-x86_64-pc-windows-gnu.mjs`;
  `--out-file` worker 17/17 findings valid (`C:\prov\vm-final2.json`).
- VM exe REBUILT with remediation (`00C96323…`, `07770A7B…`,
  `D7C8AEEC…`): launches + renders + submits, but the ONLY observed
  desktop-host terminal state is `failed` (ACL denial → os error 216 →
  missing-browser failure). Full scan→results→export: UNVERIFIED.
- VM exe rebuild BLOCKED on toolchain for a CLEAN package (no cargo
  on PATH by default; resolved via SYSTEM profile path), not channel: no cargo/rustc on
  QGA PATH, no winget, no rustup dirs; MSVC lane needs Win11 SDK import
  libs (all install channels silent). gnu-lane portable exe (23.5 MB)
  remains the validated distributable.
- Web on Windows VM: `npm ci` + typecheck + lint + vite + vitest PASS.
- Next Windows step (needs cargo-capable session): `cargo test`
  → `cargo build --release` (gnu lane) → `tauri build` (NSIS needs MSVC+SDK)
  → clean-install → packaged form-submit + cancel/recovery CUA flow.
- Windows test matrix (Phase 19): normal completion, cancel, scanner crash,
  browser crash, app-close-during-scan, repeat-after-failure — all funnel
  through `kill_child` + Job Drop; packaged execution pending rebuild.

## Worker WARP transport

Windows worker는 고정 usque 4.2.1 `http-proxy`를 세션별 자식으로 실행한다.
실행 파일과 upstream license는 검증된 runtime inventory에 포함하며 검사 중
내려받지 않는다. `--require-warp` 공개 검사는 관리된 실행 파일·등록 설정이
없으면 실패한다. 정확한 소유 원점은 직접 연결하며 해당 세션의 공개 요청은
준비되지 않은 전송으로 나가지 않는다.

준비는 실행 파일 해시, 인증된 loopback 프록시와 고정 HTTPS trace의 `warp=on`
검증을 포함한다. 준비 시간도 검사 deadline에 포함한다. 동적 포트는 소유 자식
PID의 Windows 리스너 정보에서 확인한다. 첫 터널 실패·종료 시 직접 fallback이나
재시작 없이 worker가 정리하고 비밀 없는 `KRDSWARPERROR` 코드로 실패를 전달한다.
자식 출력·전체 argv·trace의 IP·등록 자격 정보는 진단에 넣지 않는다.
