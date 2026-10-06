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
- The initial configuration used `externalBin` for the worker. The
  2026-10-06 amendment below replaces it for the JavaScript bundle.
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

## Amendment 2026-10-06: stage JavaScript as a resource

The tested worker is an esbuild `.mjs` bundle invoked by portable Node,
not a PE executable. `externalBin` requires an executable with a target
triple; renaming the JavaScript bundle to `.exe` caused Windows os error
216. `npm run build:sidecar` now generates the `.mjs` file and Tauri
`bundle.resources` stages it under `binaries/`. The host resolves the
same filename in the Tauri resource directory for an installer or beside
the executable for the proven portable layout, then always invokes Node.

`npm run smoke:sidecar` executed the generated file as a real child
process against the realistic site: five official findings, five matching
details with JPEG evidence, six checked pages, one failed page and valid
official/detail output. A Windows GNU cross-target `cargo check` passed
with the real resource mapping. This did not establish NSIS acceptance:
portable Node, `playwright-core` and the headless shell still needed installer
staging and clean-account runtime verification at that point.

## Amendment 2026-10-06: co-locate the runtime with the resource worker

Node resolves the external `playwright-core` import from the `.mjs` worker's
directory. The installer therefore maps Node v22.19.0, its license,
`node_modules/playwright-core` 1.63.0, and that version's Windows headless
shell/FFmpeg under the same `$RESOURCE/binaries/` directory (on Windows,
`install-dir/binaries/`). The preparation
script checks Node against the official release SHA-256 and uses Playwright's
CLI for its pinned browser revision. The host searches worker-adjacent assets
first; exe-adjacent assets retain the manually proven portable layout.

The relocated Linux worker smoke observed 5 official findings, 5 matching
details and JPEGs, 6 checked pages, 1 failed page, and valid outputs from a
temporary `install-dir/binaries/` tree. The full Windows GNU Tauri source check
passed with the expanded resource map. The actual NSIS installer and clean
Windows account remain unobserved.

## Amendment 2026-10-06: realistic native session smoke

The Linux `smoke:native-session` harness imports the production session and
fallback Job modules, relocates the real bundled worker with `playwright-core`,
and serves the municipal-style fixture. It exercises child spawn, progress
pump, natural exit, result/detail persistence and session readback. The observed
result was 5 known official findings, 5 matching JPEG detail records, 6 checked
pages, 1 failed page and 15 forwarded progress events. This closes the Linux
native process/session integration slice. Tauri command validation, the native
save dialog, NSIS contents and clean-account process cleanup still require a
packaged Windows run.
