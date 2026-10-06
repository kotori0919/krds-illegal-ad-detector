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
(`std::env::current_exe` parent — no username, no PATH, no repo). The
installer currently stages only the worker `.mjs` resource; the other
runtime assets are an open packaging gate:

```
install-dir/
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

1. **Worker**: Tauri `Resource/binaries/scanner-worker-x86_64-pc-windows-gnu.mjs`
   in the installer layout, then exe-adjacent
   `scanner-worker-x86_64-pc-windows-gnu.mjs` in the portable layout.
   No JavaScript file is renamed to `.exe`.
2. **Node**: exe-adjacent `node.exe` when present, else PATH `node`.
   Fixed invocation `node <sidecar> <args>` — no caller shell string.
3. **Browser**: `PLAYWRIGHT_BROWSERS_PATH` when it points at a dir
   (installer sets it to the shared `ms-playwright/`), else exe-adjacent
   `ms-playwright/`, else the default per-user cache. Nothing is
   hard-coded to a username.

## Provisioning

- Build sidecar: `npm run build:sidecar` (esbuild with external
  `playwright-core`); `npm run smoke:sidecar` checks the actual bundle.
- Browsers: `node playwright-core/cli.js install --only-shell
  --with-deps` once at image time into the shipped `ms-playwright/`
  (needs network ONCE; scans run offline).
- NSIS still needs a verified resource mapping for portable `node.exe`,
  `node_modules/playwright-core/` and `ms-playwright/` in addition to the
  bundled `.mjs`. Until these are present and exercised on a clean Windows
  account, the installer is not an accepted distribution.

## Clean-account validation (UNVERIFIED — pending clean VM)

Log on as a standard user with a different name (path with spaces +
Korean characters, e.g. `C:\Users\검증 사용자\KRDS Test\`), WITHOUT repo /
node_modules / caches, and run: scan → results → save; Save cancel;
scan cancel + rescan; dead-URL failure → close; process-tree cleanup;
install/uninstall. Record per docs/DRY_RUN.md gate G.
