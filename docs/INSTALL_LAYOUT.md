# Installation layout (portable Windows package — no dev-VM dependence)

Status: PROVEN on dev VM 2026-10-03 (`C:\prov\portable`, build
`3ED6C5F7…`): exe-adjacent `node.exe` (v22.19.0) +
`scanner-worker-x86_64-pc-windows-gnu.mjs` + `node_modules/playwright-core/`
(13.5 MB) + `ms-playwright/` (env override) → full scan exit 0,
`C:\prov\portable-out.json` 4650 bytes, `7B 0A 20 20`, `valid=true`,
17 findings H5/J4/T3/O5. No repo/PATH/user-cache dependence.
Total tree ~407 MB (node 85 MB + shell 283 MB); trimmable to
~110 MB (node + mjs + playwright-core + shell-only).

## Target installed tree

The proven manual portable tree places these next to the executable
(`std::env::current_exe` parent — no username, no PATH, no repo).
The NSIS resource map now stages the same relative tree under Tauri's
`$RESOURCE/binaries/` path, which resolves to `install-dir/binaries/` on
Windows:

```
install-dir/
  krds-detector.exe
  binaries/
    scanner-worker-x86_64-pc-windows-gnu.mjs
    node.exe                               # pinned Node v22.19.0
    node-LICENSE
    node_modules/playwright-core/
    ms-playwright/
      chromium_headless_shell-1243/
      ffmpeg-1011/

portable-dir/
  krds-detector.exe                        # Tauri host (this repo, src-tauri)
  node.exe                                 # portable Node runtime (shipped)
  scanner-worker-x86_64-pc-windows-gnu.mjs # esbuild bundle (this repo)
  node_modules/playwright-core/            # npm package (Node ESM resolution)
  ms-playwright/
    chromium_headless_shell-1243/          # headless shell (shipped)
```

Node ESM resolves `playwright-core` via `node_modules/` — a bare
`playwright-core/` sibling does NOT resolve (OBSERVED on VM:
`ERR_MODULE_NOT_FOUND`). The layout MUST use `node_modules/`.

No other files are required. In particular the install does NOT need:

- `C:\work\repo` or any repository checkout;
- a separately installed Node/Bun on PATH;
- a prefilled per-user `ms-playwright` cache;
- knowledge of the evaluator's username.

## Resolution order (code: `spawn_sidecar`, `sidecar_path`)

1. **Worker**: Tauri `$RESOURCE/binaries/scanner-worker-x86_64-pc-windows-gnu.mjs`
   in the installer layout, then exe-adjacent
   `scanner-worker-x86_64-pc-windows-gnu.mjs` in the portable layout.
   No JavaScript file is renamed to `.exe`.
2. **Node**: worker-adjacent `node.exe`, then exe-adjacent `node.exe`,
   then PATH `node`.
   Fixed invocation `node <sidecar> <args>` — no caller shell string.
3. **Browser**: `PLAYWRIGHT_BROWSERS_PATH` when it points at a dir,
   then worker-adjacent `ms-playwright/`, then exe-adjacent
   `ms-playwright/`, then the default per-user cache. Nothing is
   hard-coded to a username.

## Provisioning

- Build sidecar: `npm run build:sidecar` (esbuild with external
  `playwright-core`); `npm run smoke:sidecar` relocates it under a temporary
  `install-dir/binaries/` tree and checks real Node module resolution and scan.
- Stage Windows runtime: `npm run prepare:windows-runtime` copies the locked
  `playwright-core`, downloads Node v22.19.0 with pinned SHA-256 verification,
  and installs Playwright 1.63.0's Windows headless shell and FFmpeg into the
  resource tree. Tauri `beforeBuildCommand` runs both steps. The browser
  download needs network once; scans run offline.
- The resource map passed a Windows GNU Rust `cargo check` and the relocated
  sidecar passed a Linux worker smoke. NSIS content, packaged launch, and
  clean-account behavior still require Windows verification before release.

## Clean-account validation (UNVERIFIED — pending clean VM)

Log on as a standard user with a different name (path with spaces +
Korean characters, e.g. `C:\Users\검증 사용자\KRDS Test\`), WITHOUT repo /
node_modules / caches, and run: scan → results → save; Save cancel;
scan cancel + rescan; dead-URL failure → close; process-tree cleanup;
install/uninstall. Record per docs/DRY_RUN.md gate G.
