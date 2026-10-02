# Clean-machine dry run (Phase 24 — Windows, release-blocking)

Status legend: `[x] PASS` = observed on the named build with listed
evidence. `[ ] UNVERIFIED (미근거)` = claimed or run elsewhere but NOT
observed on the current packaged build — must be re-proven, never
shipped as passing. Ubuntu-only evidence NEVER validates Windows
ACLs, packaging, or GUI behavior.

Run on the cleanest available Windows 11 environment. Record each line
PASS/FAIL with evidence (commit SHA, exe hash, OS/toolchain versions,
command, input, expected/actual, original log or artifact path).

## A. Release unpack (no dev tooling)

Status 2026-10-02 (Windows 11 VM, gnu-lane exe — NSIS PENDING):
reference portable `krds-detector.exe` (23.5 MB, SHA-256
`07FC769A743501ADC43373A55BF6EDB00FEC27C636B0252E1285AE2BBFD2C8BD`)
was the last INDEPENDENTLY VERIFIED distributable. Rebuilds since
(`AF3AED21…`, `DF065B7D…`, `00C96323…`, `07770A7B…`) were produced by
`cargo +stable-x86_64-pc-windows-gnu build --release --target
x86_64-pc-windows-gnu` on the SAME VM but have NOT completed the
A–F gates below — their hashes are build records, not release
evidence. NSIS installer requires the MSVC lane (SDK-gated).

1. [ ] UNVERIFIED (미근거) — portable exe launches from `C:\work\repo\src-tauri\target\…\release`.
   Prior PASS applied ONLY to hash `07FC769A…` (screenshot win11-app13).
   Current build `00C96323…` renders the KRDS start screen (screenshots
   win11-m2, win11-acl, win11-eventfix series) but launch-from-clean-install
   was NOT performed — repo files, node_modules, and caches were present.
2. [ ] UNVERIFIED (미근거) — install size N/A (portable); reference build
   23.5 MB. Current builds report 24.9–25.0 MB (`deps` exe 24950749,
   24901597 bytes); no clean-install size recorded.
3. [ ] UNVERIFIED (미근거) — cold start to first paint, focus ring, Tab
   order were observed on hash `07FC769A…` only. Current builds render
   (screenshots) but timed first-paint + keyboard audit NOT re-run.

## B. Scan flow

4. [x] PASS (PACKAGED APP, OBSERVED 2026-10-02) — manual per-character
   typing (`virsh send-key`, `KEY_LEFTSHIFT+KEY_SEMICOLON` for `:`) lands in
   React state: `http://127.0.0.1:4123/` visible in the input (screenshots
   win11-purl/win11-retype), submit reaches progress. Clipboard paste
   remains unreliable (placeholder-only → validation banner, correctly
   shown). Build `C078BDE2…`: fresh typing → progress → succeeded rescan
   (session `33a5e4de…`, see gate 7b).
5. [x] PASS (PACKAGED APP, OBSERVED 2026-10-03) — live per-page counters
   on build `0AB2BABC…` (commit 7e04bda, Win11 Pro 10.0.26200, SYSTEM
   session via QGA + interactive task KRDSLaunch2): progress shows
   `crawled 6 pages (crawling, 확정된 탐지 0건)`, `방문한 페이지 6`,
   `대기 중인 페이지 13` (real queue depth via `onPageQueued`), `경과 10`
   (screenshots proof-live-progress + proof-queued-13). Worker
   `onPageVisited(snapshot.url)` → `KRDSPROGRESS` stderr → host
   `scan-event` IPC path confirmed end to end. Supersedes the
   `FC8B9406…` observation (same behavior, older build).
5b. [x] PASS (PACKAGED APP, OBSERVED 2026-10-03) — full 17-finding scan
   on build `0AB2BABC…`: session `781e13a0…`, `상태: succeeded · 총 17건`
   (H 5 / J 4 / T 3 / O 5), page + `#ad-*` locations + badges
   (screenshot proof-final-17). Authoritative completion path (terminal
   filter + delayed-result retry) exercised: results rendered, not empty.
6. [x] PASS (PACKAGED APP, OBSERVED 2026-10-02) — cancel button mid-scan:
   progress (`crawled 6 pages`) → `탐지 취소` → start screen `탐지 시작`
   (screenshots proof-live-progress + proof-cancel-start2). Hygiene: zero
   `chrome(.exe)` / `chrome-headless-shell.exe` remain; fixture `node.exe`
   untouched; app relaunches. Post-`0AB2BABC…` re-proof: scan reached
   `succeeded` 17/17 before the cancel keystroke landed (screenshot
   proof-final-17), so the cancel-button flow on the NEW build is
   PARTIAL — re-run with an earlier keystroke or a slower scan.
7. [x] PASS (PACKAGED APP, OBSERVED 2026-10-02) — full scan via the
   packaged form on build `21E751C1…` (dialog-export lane): session
   `d819fa1d…`, `상태: succeeded`, 17 findings (HOMOGLYPH 5 / JAMO 4 /
   TRANSPARENT 3 / OFFSCREEN 5), table rows with page + `#ad-*`
   locations + technique badges (screenshot win11-x). Prior worker-CLI
   sample `C:\prov\vm-final2.json` (4650 bytes, magic `7B 0A 20 20`)
   also valid. Interactive-user browser cache (`dbsgu` profile +
   provisioned shell + full chromium) + `.mjs`-first resolver were the
   fixes; SYSTEM-cache override was the bug (removed).
7b. [x] PASS (PACKAGED APP RESCAN, OBSERVED 2026-10-02) — build
   `C078BDE2…` (progress-forwarding lane, commit 544ff63): fresh typed
   submit → progress → auto-advance → `탐지 결과`, session `33a5e4de…`,
   `상태: succeeded · 총 17건` (H 5 / J 4 / T 3 / O 5), page + `#ad-*`
   locations + badges + evidence text (screenshot win11-pnew2).
8. [x] PASS (PACKAGED APP, OBSERVED 2026-10-02) — evidence panel on
   build `21E751C1…` shows page + `#ad-off-displaynone` selector +
   OFFSCREEN badge + raw evidence text (screenshot win11-xev).
   Observed/derived/inference sections render per KODEX §37.

## C. result.json validation

9. [x] PASS (PACKAGED APP END-TO-END, OBSERVED 2026-10-02) — build
   `FFEF22E3…` (interactive-Documents lane): export screen 6 checks
   green → native save dialog (Documents default) → file on disk
   `C:\Users\dbsgu\OneDrive\Documents\result.json`, 4650 bytes,
   magic `7B 0A 20 20`, `valid=true`, 17 findings
   (H 5 / J 4 / T 3 / O 5), entry `http://127.0.0.1:4123/`,
   tool `0.1.0` (contracts validator on VM; screenshots
   win11-afterenter + dialog series). Desktop scan→terminal→export→
   UTF-8 bytes PROVEN through the actual desktop host.
10. [x] PASS (PACKAGED APP BYTES, OBSERVED 2026-10-02) — desktop
    export `C:\Users\dbsgu\OneDrive\Documents\result.json`: UTF-8,
    no BOM (magic `7B 0A 20 20`), 4650 bytes. Worker-CLI files also
    BOM-free.
11. [x] PASS (worker CLI content) — `meta` + flat `findings`;
    technique ∈ 4 official; ids unique; no duplicate identity.
    Desktop-produced content: [ ] UNVERIFIED (미근거) — the only
    desktop-host result observed is a `failed` session with zero
    findings, which MUST NOT export (export gate now enforces this).
12. [x] PASS (worker CLI) — `valid=true`, 17 findings (H 5 / J 4 /
    T 3 / O 5) via contracts validator; 21 web/contract tests green on
    VM (tsc + result + tauri-host suites). Desktop scan→terminal→export:
    [ ] UNVERIFIED (미근거).

## D. Process hygiene (release-blocking)

13. [x] PASS (PACKAGED APP, OBSERVED 2026-10-02) — post-success scan:
    zero `chrome.exe`/`chrome-headless-shell.exe` remain (WMI observed);
    the 2 `node.exe` are the fixture server + a stale vite build, NOT
    scan residue. App process survives; host outlives the scan.
    Cancel/recovery via desktop: [ ] UNVERIFIED (미근거) — registry unit
    tests green, packaged cancel NOT exercised.
14. [x] PASS (PACKAGED APP, OBSERVED 2026-10-02) — cancel button mid-scan:
    progress screen (`탐지 진행`, crawling, zero counters) → `탐지 취소`
    → app returns to start screen; zero `chrome-headless-shell` remain
    (WMI observed); fixture/vite `node.exe` untouched; new app PID
    `8520` survives (host outlives cancel). Screenshots win11-fprog
    (progress) + win11-cancelled (start screen after cancel).
15. [x] PASS (worker seam, OBSERVED 2026-10-02, repeated) — mid-scan
    kill on 200-page scan: 4 Chromium PIDs mid-scan → ZERO after worker
    `Stop-Process` (second run confirms first); fixture/vite `node.exe`
    untouched. Fresh rescan exits 0 with output.
15b. [x] PASS (PACKAGED APP, OBSERVED 2026-10-02) — failed-scan close:
    dead URL `http://199.9.9.9:9999/` → `탐지 진행`, `현재 단계 failed`,
    `탐지가 실패했습니다: sidecar exited exit code: 1:` (screenshot
    proof-failed-close) → app close → zero `krds-detector.exe`, zero
    `chrome(.exe)` / `chrome-headless-shell.exe`; fixture `node.exe`
    (pid 7808) untouched. Export gate holds: only `succeeded` sessions
    export (unit-tested + code path `scan_export`).

## E. Build from submitted source

16. [x] PASS — `tsc -b` + `vitest` contract/host suites green on the VM
    (Node v22.19.0; 17 contract + 4 tauri-host tests OBSERVED this
    session). Full-suite counts on VM NOT re-run for this slice.
17. [x] PASS (gnu lane, OBSERVED 2026-10-02) — `cargo
    +stable-x86_64-pc-windows-gnu test` in `C:\work\repo\src-tauri`:
    14 passed / 0 failed (session lifecycle incl. live-sleeper cancel
    + 6 strict-validation tests). Toolchain: cargo/rustc 1.98.1,
    MinGW GCC 16.2, Win11 Pro 10.0.26200 x64. Env fix was MinGW
    `C:\mingw64\bin` on PATH (`dlltool.exe` previously not found).
    Log: `C:\prov\cargo-test2.log` on the VM.
18. [ ] NOT RUN — rebuilt NSIS hash match (needs MSVC-lane `tauri build`).

## F. Submission packet (before 2026-10-23 18:00 KST, freeze 10-22)

- [ ] UNVERIFIED (미근거) — Windows 11 executable: reference hash
  `07FC769A…` only; current builds (`07770A7B…`, `00C96323…`,
  `D7C8AEEC…`) launch and render but have NOT passed A–F.
- [x] Complete source code (dev/bootstrap, tree clean)
- [x] `docs/BUILD_MANUAL.md` + `docs/USER_MANUAL.md`
- [x] `docs/PLANNING_DOC.md` (+ application forms: user to attach)
- [x] `result.json` worker-CLI sample (`C:\prov\vm-final2.json`,
  17 findings, valid) + `result_extra.json` engine (validated
  separately). Desktop-produced `result.json`: [ ] UNVERIFIED (미근거).
- [ ] Attachment size / signature / email verification (user step)
- [ ] NSIS installer (MSVC-lane, SDK-gated)

## G. Current runnable + blockers (2026-10-03)

- [x] Current runnable: build `3ED6C5F7…` (commit afc6136, Win11 Pro
  10.0.26200) + fresh sidecar (39287 bytes, staged exe-adjacent) +
  bundle `index-nm2rQJej.js` (poll-only + mounted cancel + autofocus).
- Code CI: PASS on `afc6136` (typecheck + lint + vite build + vitest
  18/110 + msvc check; GH runs green).
- Windows execution (dev VM): PASS — live counters incl. mid-analysis
  15-visited/17-confirmed + nested-iframe `>>>` location, full 17/17
  scans ×7 (H5/J4/T3/O5; latest session f344bcd2 on the cancel-fix
  build `3ED6C5F7…`, proof-rescan-fix-17; zero chromium orphans, app
  survives), cancel→start on the cancel-fix build
  (proof-cancel-fix-start), failed→close. Rust suite on VM: 20/20 PASS
  (gnu lane, incl. 5 pump + 1 cancel-race test).
- NSIS deps (OBSERVED 2026-10-03): VS BuildTools VC 14.44.35207
  present BUT no `link.exe`/`cl.exe` (C++ workload absent); Windows
  Kits 10 present BUT no `um\x64\kernel32.lib` found; no NSIS
  `makensis.exe`; no `cargo tauri-cli`. NSIS stays BLOCKED on
  toolchain install (needs approval for VS C++ workload + SDK +
  NSIS on the VM).
- Save dialog + save-to-disk: PASS (OBSERVED 2026-10-03, build
  `6576A7D1…`) — native dialog at Documents default with `result.json`
  prefilled (proof-save-dialog); Esc cancel is a silent no-op, no file,
  no error, no download (proof-save-cancel-noop; unit-tested);
  dialog-confirmed save writes
  `C:\Users\dbsgu\OneDrive\Documents\result-dialog.json`, 4650 bytes,
  magic `7B 0A 20 20`, `valid=true`, 17 findings H5/J4/T3/O5,
  ids+identity unique (contracts validator on VM; screenshots
  proof-save-dialog2 + proof-save-disk). Worker-CLI byteproof
  `C:\prov\byteproof.json` identical bytes.
- Diagnostics proof (OBSERVED 2026-10-03, build `3ED6C5F7…`): dead URL
  `http://199.9.9.9:9999/` → `탐지가 실패했습니다: sidecar exited exit
  code: 1: sidecar stderr: page.goto: Timeout 20000ms exceeded…`
  (proof-failed-stderr; bounded stderr now surfaces in the failure
  detail instead of a bare exit code). App close after failure → zero
  `krds-detector.exe`, zero chromium; fixture `node.exe` 7808 untouched.
- 6-green export validation + evidence panel: PASS on final flow
  (proof-6green-final, proof-evidence-offscreen; nested-iframe run
  proof-6green-adv, proof-nested-iframe).
- Overwrite save (OBSERVED 2026-10-03, build `3ED6C5F7…`): existing
  `result.json` → confirm-replace dialog (proof-overwrite-confirm) →
  saved path shown `저장됨: C:\Users\dbsgu\OneDrive\Documents\result.json`
  (proof-saved-path); on-disk bytes re-verified 4650, `7B 0A 20 20`,
  `valid=true`, 17 findings.
- Portable layout (OBSERVED 2026-10-03, build `3ED6C5F7…`):
  `C:\prov\portable` (exe + node.exe v22.19.0 + sidecar `.mjs` +
  `node_modules/playwright-core/` 13.5 MB + `ms-playwright/` via env)
  → full scan exit 0, `C:\prov\portable-out.json` 4650 bytes,
  `7B 0A 20 20`, `valid=true`, 17 H5/J4/T3/O5. Bare
  `playwright-core/` sibling does NOT resolve (`ERR_MODULE_NOT_FOUND`);
  layout corrected to `node_modules/`.
- Clean-install acceptance: UNVERIFIED (미근거) — NOT RUN. ISO
  `CESE_X64FREE_EN-US_DV9` (5.06 GB, `~/index.html?linkid=…`) ready.
  Blocker (reproducible): `ls /var/lib/libvirt/images/` →
  `Permission denied`; `sudo -n true` → `a password is required`.
  Dev Win11 XML uses EFI + secure-boot (`OVMF_CODE_4M.ms.fd`,
  `Win11_VARS.fd`); same firmware needed for the clean VM. Then:
  different-username standard account, space/Korean paths, SDK
  install, NSIS build, full flow.
- Competition submission: NOT SUBMITTED (freeze 2026-10-22, deadline
  2026-10-23 18:00 KST; no merge/release/deploy without authorization).
- [ ] BLOCKED — clean install: NOT RUN (privilege blocker above).
- [ ] BLOCKED — NSIS installer + uninstall: SDK-gated (MSVC lane needs
  Win11 SDK import libs; approved — pending clean VM).
