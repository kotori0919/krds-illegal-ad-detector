# Installation layout (portable Windows package — no dev-VM dependence)

Status: SPEC (implemented in code `a788332`, UNVERIFIED on a clean account —
clean VM creation pending privilege for the libvirt images dir).

## Installed tree

The installer / portable zip places these NEXT TO the executable
(`std::env::current_exe` parent — no username, no PATH, no repo):

```
install-dir/
  krds-detector.exe                        # Tauri host (this repo, src-tauri)
  node.exe                                 # portable Node runtime (shipped)
  scanner-worker-x86_64-pc-windows-gnu.mjs # esbuild bundle (this repo)
  playwright-core/                         # npm package (shipped, external)
  ms-playwright/
    chromium_headless_shell-1243/          # headless shell (shipped)
      chrome-linux/…  (win32 build on Windows)
```

No other files are required. In particular the install does NOT need:

- `C:\work\repo` or any repository checkout;
- `node_modules` outside the shipped `playwright-core/`;
- a separately installed Node/Bun on PATH;
- a prefilled per-user `ms-playwright` cache;
- knowledge of the evaluator's username.

## Resolution order (code: `spawn_sidecar`, `sidecar_path`)

1. **Worker**: exe-adjacent `scanner-worker-x86_64-pc-windows-gnu.mjs`
   (preferred — the staged esbuild JS bundle), then `.exe`-named bundle,
   then Tauri `Resource/binaries/scanner-worker` fallback.
2. **Node**: exe-adjacent `node.exe` when present, else PATH `node`.
   Fixed invocation `node <sidecar> <args>` — no caller shell string.
3. **Browser**: `PLAYWRIGHT_BROWSERS_PATH` when it points at a dir
   (installer sets it to the shared `ms-playwright/`), else exe-adjacent
   `ms-playwright/`, else the default per-user cache. Nothing is
   hard-coded to a username.

## Provisioning

- Build sidecar: `src-tauri/binaries/README.md` recipe (tsc + esbuild,
  `--external:playwright-core`, staged as `.mjs`).
- Browsers: `node playwright-core/cli.js install --only-shell
  --with-deps` once at image time into the shipped `ms-playwright/`
  (needs network ONCE; scans run offline).
- NSIS (pending Win11 SDK on the clean VM): bundles the whole tree
  above; per-user install, no admin, no expanded system permissions.

## Clean-account validation (UNVERIFIED — pending clean VM)

Log on as a standard user with a different name (path with spaces +
Korean characters, e.g. `C:\Users\검증 사용자\KRDS Test\`), WITHOUT repo /
node_modules / caches, and run: scan → results → save; Save cancel;
scan cancel + rescan; dead-URL failure → close; process-tree cleanup;
install/uninstall. Record per docs/DRY_RUN.md gate G.
