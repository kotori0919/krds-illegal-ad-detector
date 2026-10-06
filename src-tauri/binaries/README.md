# Scanner worker packaging (Tauri resource)

`tauri.conf.json` maps the generated
`scanner-worker-x86_64-pc-windows-gnu.mjs` into `bundle.resources`.
`npm run build:sidecar` creates that file, and Tauri's
`beforeBuildCommand` runs it before packaging. The file is JavaScript,
so it must not be staged through `externalBin`, which requires a native
executable and previously led to Windows os error 216.

Runtime lookup (`sidecar_path` in `src-tauri/src/main.rs`) prefers the
packaged `$RESOURCE/binaries/scanner-worker-x86_64-pc-windows-gnu.mjs`
(Windows `install-dir/binaries/`),
then checks next to the executable for the portable layout.

## What the sidecar is

The sidecar is the live detection pipeline
(`packages/detection/src/worker.ts` → `scanSite`, ADR-0007) bundled to ONE
JavaScript file. It is NOT a renamed executable: the `.mjs` bundle runs
via the fixed invocation `node <sidecar> <args>`; there is no
caller-controlled shell string.

`playwright-core` MUST stay external (`--external:playwright-core`):
bundling it breaks (`chromium-bidi` CJS require fails at bundle time,
verified). `npm run prepare:windows-runtime` stages it under the same
`$RESOURCE/binaries/` directory as the worker, with Node and the browser.

Offline OCR additionally requires `ocr-worker.mjs`, `ocr-data/kor.traineddata.gz`,
`ocr-data/eng.traineddata.gz` and the staged Tesseract Node dependency closure
(including its WASM). `build:sidecar` builds the OCR worker and copies the pinned
language data; `prepare:windows-runtime` stages all runtime modules and licenses.
Tauri includes these resources next to the scanner, so recognition does not
download language data or require a separate Tesseract installation.

After staging, run the narrow integration smoke with the packaged Node:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = "$PWD\src-tauri\binaries\ms-playwright"
& .\src-tauri\binaries\node.exe .\benchmarks\windows-v2-integration.mjs
```

It serves a real non-ID text/image fixture, checks actual Korean OCR output,
then cancels a second scan and checks partial artifacts and Windows descendant
cleanup. This smoke does not replace installed Tauri or full A-F acceptance.

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

Build and exercise the sidecar bundle (from `C:\work\repo`):

```powershell
npm run build:sidecar
npm run smoke:sidecar
```

The smoke copies the built worker and staged `playwright-core` into a temporary
`install-dir/binaries/` path, then starts the worker as a separate process. It
validates real Node module resolution, the official result, detail joins,
JPEG evidence and progress on a local realistic site. It does not validate
NSIS content or a Windows launch.

Build the app (gnu lane; needs SYSTEM cargo + MinGW on PATH):

```bat
$env:Path = 'C:\Windows\System32\config\systemprofile\.cargo\bin;C:\mingw64\bin;C:\Program Files\nodejs;' + $env:Path
cd C:\work\repo\src-tauri
cargo +stable-x86_64-pc-windows-gnu build --release --target x86_64-pc-windows-gnu
```

This direct Cargo command builds a portable host executable only. Run
`npm run build:sidecar` and `npm run prepare:windows-runtime` first; use
`tauri build` to produce an installer with the resource map.

Copy the fresh `target\x86_64-pc-windows-gnu\release\deps\krds_detector-*.exe`
over `target\x86_64-pc-windows-gnu\release\krds-detector.exe`
(the top-level exe is a stale hardlink target — link step fails with
os error 32 while the old app runs; stop it first).

## Clean-machine install test (no repo, no separate Node install, no cache)

1. Install the NSIS package containing `install-dir/binaries/` with the `.mjs`,
   `node.exe`, `ocr-worker.mjs`, `ocr-data/`, all staged `node_modules/` and
   `ms-playwright/`.
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
