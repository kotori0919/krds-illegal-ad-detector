# Scanner sidecar packaging (Tauri externalBin, reproducible)

`tauri.conf.json` declares `externalBin: ["binaries/scanner-worker"]`.
At build time Tauri requires the per-triple file staged here:

- `scanner-worker-x86_64-pc-windows-gnu.exe` — portable exe lane
  (MinGW gnu toolchain; what the Windows 11 VM builds today)
- `scanner-worker-x86_64-pc-windows-msvc.exe` — NSIS lane
  (needs the Win11 SDK; blocked on this VM — see docs/DESKTOP.md)

Runtime lookup (`sidecar_path` in `src-tauri/src/main.rs`) resolves the
file NEXT TO the installed executable first, then falls back to the
`Resource/binaries/scanner-worker` path — installed location and runtime
resolution cannot drift.

## What the sidecar is

The sidecar is the frozen detection pipeline
(`packages/detection/src/worker.ts` → `scanSite`, ADR-0007) bundled to ONE
JavaScript file. It is NOT a renamed executable: a `.mjs`/`.js` bundle runs
via the fixed invocation `node <sidecar> <args>`; only a `bun build
--compile` artifact (a real PE binary) runs directly. `spawn_sidecar`
chooses by file extension — no caller-controlled shell string either way.

`playwright-core` MUST stay external (`--external:playwright-core`):
bundling it breaks (`chromium-bidi` CJS require fails at bundle time,
verified). Its runtime files MUST be shipped next to the app or
provisioned on first run (see below).

The `--channel` flag is OPT-IN plumbing (default: headless shell).
`--channel msedge` does NOT work under session-0 on this VM (exit 1002
OBSERVED, ADR-0009) — do not document it as the no-download path.

## Reproducible recipe (Windows 11 VM, observed)

Prerequisites (exact, current VM):

- Node.js v22.19.0 at `C:\Program Files\nodejs` (QGA PATH does NOT
  include it; use the absolute path or prepend it)
- `node_modules` installed (`npm ci` in `C:\work\repo`)
- Playwright headless shell already in BOTH caches
  (`ms-playwright/chromium_headless_shell-1243` under SYSTEM and user
  profiles) — provision once with:
  `node node_modules/playwright-core/cli.js install --only-shell`
  (needs network ONCE; subsequent scans are offline)

Build the sidecar bundle (from `C:\work\repo`):

```bat
C:\Program` Files\nodejs\node.exe node_modules\typescript\bin\tsc -p packages\scanner\tsconfig.json
C:\Program` Files\nodejs\node.exe node_modules\typescript\bin\tsc -p packages\detection\tsconfig.json
C:\Program` Files\nodejs\node.exe node_modules\esbuild\bin\esbuild packages\detection\src\worker.ts --bundle --platform=node --format=esm --external:playwright-core --outfile=C:\prov\scanner-worker.mjs
copy C:\prov\scanner-worker.mjs src-tauri\binaries\scanner-worker-x86_64-pc-windows-gnu.mjs
```

Verify before staging (`--help` exits 2; full e2e exits 0, 17 findings):

```bat
C:\Program` Files\nodejs\node.exe src-tauri\binaries\scanner-worker-x86_64-pc-windows-gnu.mjs --help
```

Build the app (gnu lane; needs SYSTEM cargo + MinGW on PATH):

```bat
$env:Path = 'C:\Windows\System32\config\systemprofile\.cargo\bin;C:\mingw64\bin;C:\Program Files\nodejs;' + $env:Path
cd C:\work\repo\src-tauri
cargo +stable-x86_64-pc-windows-gnu build --release --target x86_64-pc-windows-gnu
```

Copy the fresh `target\x86_64-pc-windows-gnu\release\deps\krds_detector-*.exe`
over `target\x86_64-pc-windows-gnu\release\krds-detector.exe`
(the top-level exe is a stale hardlink target — link step fails with
os error 32 while the old app runs; stop it first).

## Clean-machine install test (no repo, no Node, no cache)

1. Copy ONLY: `krds-detector.exe` + staged sidecar `.mjs` +
   `node.exe` (portable) + `node_modules/playwright-core` +
   `ms-playwright/chromium_headless_shell-1243`.
2. WITHOUT `C:\work\repo`, `node_modules`, Bun, or a prefilled cache:
   launch, enter the fixture URL, submit.
3. Expect: progress → result list → evidence → `result.json` export,
   UTF-8 no BOM. Any missing runtime file must surface as an explicit
   form-level error, never a silent freeze.

## Stale instructions (do NOT follow)

- `--channel msedge` as the no-download path: disproven on this VM.
- `bun build --compile` as the ready recipe: produced an 86 MB exe
  locally but was never staged, launched, or scanned on Windows —
  UNVERIFIED until the clean-install test above passes with it.
