# Scanner sidecar binaries (Tauri externalBin)

Stage the platform sidecar here before `tauri build`:

- `scanner-worker-x86_64-pc-windows-msvc.exe` — Windows (MSVC lane, NSIS)
- `scanner-worker-x86_64-pc-windows-gnu.exe` — Windows (gnu lane, portable)
- `scanner-worker-x86_64-unknown-linux-gnu` — Linux dev/CI sidecar runs

Build from the frozen pipeline (no code drift from the tested seam):

```sh
node node_modules/esbuild/bin/esbuild packages/detection/src/worker.ts \
  --bundle --platform=node --format=esm --external:playwright-core \
  --outfile=src-tauri/binaries/scanner-worker-<triple>(.exe)
```

Single-file (no Node.js on evaluator PC):

```sh
bun build --compile packages/detection/src/worker.ts \
  --target bun-windows-x64 \
  --outfile src-tauri/binaries/scanner-worker-x86_64-pc-windows-gnu.exe \
  --external playwright-core
```

The sidecar drives the inbox Edge via `--channel msedge`
(`scan_start` passes it), so no Playwright browser download is needed.
Evaluators need only WebView2 (Win11 inbox) + Edge (Win11 inbox).
