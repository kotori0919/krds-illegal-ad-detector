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
- Clean-clone build (OBSERVED 2026-10-03): `C:\work\clean-test`
  (robocopy excl. target/node_modules/.git/dist) + `npm ci` +
  `tsc -b --force` + web build + sidecar bundle + gnu exe
  `43098FEB…` (24984761 bytes) all succeed from the submitted source
  alone. Fixed en route: undeclared `@krds-detector/synth-eval` dep
  (committed) + `BUILD_MANUAL` order (contracts → synth-eval →
  scanner → detection; `tsc -b` prerequisite). Clean portable scan:
  `C:\prov\cleanport` → exit 0, `cleanport-out.json` 4650 bytes,
  `7B 0A 20 20`, `valid=true`, 17 H5/J4/T3/O5.
- Standard-user proxy (OBSERVED 2026-10-03, build `3ED6C5F7…`):
  guest has a single enabled local user (`windows-VM`; Administrator /
  Guest / DefaultAccount disabled) so no second account exists to test
  with; instead ran the portable sidecar from a user-writable path with
  the correct CLI (`--session stduser1 --entry-url … --max-pages 30
  --max-depth 4 --timeout-sec 1500 --settle-ms 1500 --out-file`):
  48.6 s wall, `C:\prov\std-user-scan.json` 4650 bytes, magic
  `7B-0A-20-20`, `valid=true errors=0`, 17 findings
  (H5/J4/T3/O5), zero chromium post-scan. Space+Korean path
  (`C:\prov\한국 광고\scan test\result.json`) copies 4650 bytes
  clean. Full different-username + clean-machine isolation now runs
  on the session clean VM `clean11` (see below).
- Clean-install acceptance: UNVERIFIED (미근거) — clean VM RUNNING
  2026-10-03 via user-space session URI (no privilege needed):
  `qemu:///session` + pool `clean` at `/home/monad/clean-vm` +
  disk `clean11.qcow2` 80G qcow2 + ISO copy `win11-install.iso`
  (5.06 GB, `CESE_X64FREE_EN-US_DV9`). Domain `clean11`: q35 +
  EFI secure-boot (`OVMF_CODE_4M.ms.fd`), 8 GB RAM, 4 vCPU
  host-passthrough, virtio disk/net, TPM emulator, user-mode
  networking, VNC on 127.0.0.1:5902 (RFB 003.008 confirmed),
  autostart marked. Windows 11 Setup REACHED via `virsh send-key`
  boot-key spam (OBSERVED VNC screenshot: `Windows 11 Setup` →
  `Select language settings`, en-US defaults).
- [x] Input delivery UNBLOCKED via USB-tablet (OBSERVED 2026-10-03):
  PS/2 → USB tablet+keyboard in XML fixed VNC clicks (first click
  advanced language → keyboard page, screenshots differ).
  Click-through: language → keyboard → product-key → license terms
  accepted (checkbox 335,370 + Next) → `Select setup option`
  (`Install Windows 11` selected) → `Ready to install` recap
  (`Windows 11 IoT Enterprise LTSC Evaluation`, `Keep nothing`).
- [x] Virtio-disk invisibility DIAGNOSED + FIXED (OBSERVED
  2026-10-03): Setup disk page showed an EMPTY list on the
  virtio (`vda`) disk — WinPE has no virtio driver. Fix: disk →
  SATA (`sdb`), NIC virtio → `e1000e` (same WinPE reason),
  redefined + rebooted + clicked through; disk page now shows
  `Disk 0 Unallocated Space 80.0 GB` selected → Next →
  `Ready to install` recap. Install CONFIRMED started (first
  click 12:19:11 missed — recap screenshot identical; reclick
  VNC screenshot ~12:24 KST, `Your PC will restart several
  times`) → `Installing 94%` on black screen + `Your device may
  restart a few times` (OBSERVED VNC screenshot ~12:27 KST) →
  OOBE `Is this the right country or region?` (`United States`
  selected, OBSERVED VNC screenshot ~12:31 KST).
- [x] OOBE region page PASSED via keyboard Tab-navigate (OBSERVED
  2026-10-03): `send-key KEY_TAB×3 KEY_ENTER` advanced region →
  keyboard-layout page (screenshot differs) → confirmed with
  Tab×3+Enter → `Want to add a second keyboard layout?` → Skip
  via Enter → `Let's check for any updates` spinner (waited
  60+90 s) → `Let's set things up for your work or school`
  Microsoft-sign-in page (OBSERVED screenshot ~12:37 KST).
  Lesson: OOBE needs keyboard focus navigation, not mouse clicks
  (clicks landed, cursor visible, but page ignored them).
- [ ] Microsoft-account gate (OBSERVED 2026-10-03): sign-in page
  offers `Sign-in options` link but no visible offline-account
  path. `Shift+F10` OPENS an Administrator `cmd.exe` console
  (OBSERVED screenshot: `Microsoft Windows [Version
  10.0.26100.1742]`). BYPASS EXECUTED (OBSERVED 2026-10-03):
  `KEY_SLASH` sends `/` (wrong — `oobe/bypassnro` → `'oobe' is
  not recognized`; `c /d` → `'c' is not recognized`, proving `/`
  splits tokens). `KEY_BACKSLASH` sends `\` (screenshot shows
  `oobe\bypassnro` on the line). Enter on the backslash form →
  VM REBOOTED into `Just a moment...` spinner (OBSERVED VNC
  screenshot) — the BypassNRO path is accepted. Console typing
  rules: VNC focus-click (400,170) first; `KEY_<UPPER>` only
  (`KEY_o` invalid); ≤5 keys per `send-key` call.
- [ ] Post-bypass: BYPASS INEFFECTIVE on this image (OBSERVED
  2026-10-03): after reboot + region/keyboard/Skip (same
  Tab-navigate path), the work-or-school MS-sign-in page
  RETURNS unchanged — no offline-account option appears, and
  `Sign-in options` click only focuses the link (cursor visible,
  page identical). The `oobe\BypassNRO` reboot ran (spinner +
  region loop) but did not add a local-account path. Image is
  `Windows 11 IoT Enterprise LTSC Evaluation` (recap screen) —
  may ignore BypassNRO or need `BypassNRO` + network-off.
  sign-in page, or `Shift+F10` → direct local-account creation:
- [x] Local account CREATED via console (OBSERVED 2026-10-03):
  slow-typing (2.5 s/key, focus-clicked console) produced exact
  `net user eval eval123 /add` → `The command completed
  successfully.` then `net localgroup administrators eval /add`
  → `The command completed successfully.` (VNC screenshots).
  reboot and pick `eval`). Host-side reboot WORKS (OBSERVED
  2026-10-03): guest `shutdown` kept dropping `/` glyphs and
  `wpeutil` is absent (full-OS console), so `virsh destroy` +
  `virsh start` rebooted cleanly (disk persists). Post-reboot:
  OOBE region page again, `Shift+F10` console again, and — key
  proof — `net user` on machine `DESKTOP-PNG4I6R` lists `eval`
  alongside Administrator/Guest/DefaultAccount/defaultuser0/
  WDAGUtilityAccount (VNC screenshot). The account SURVIVES
  reboot: disk writes persist, install state persists.
  region/keyboard/Skip, then at sign-in the local account
  should be selectable (or reboot-to-logon shows `eval`).
  OOBE LOOPS (OBSERVED 2026-10-03): closing the console reveals
  the region page; Tab-navigate region → keyboard → Skip →
  spinner (~90 s) returns to the SAME work-or-school MS-sign-in
  page (screenshot) — the pre-created `eval` account does NOT
  surface in OOBE. OOBE offers no path to the existing local
  account. Next: at the sign-in page, `Shift+F10` → `regedit` /
  `control userpasswords2` path, or reboot-to-logon (OOBE may
  bypass via `HKLM\SOFTWARE\Microsoft\Windows
  NT\CurrentVersion\Winlogon` `AutoAdminLogon` for `eval`.
  REG-PATH TYPING (OBSERVED 2026-10-03): the full key path is on
  the line but `NT CurrentVersion` lost its inner space
  (`...windows\nt currentversion\winlogon` — screenshot): a
  `KEY_SPACE` was silently dropped inside the long sequence
  (same drop class as `/` mid-command). Rule: VERIFY every space
  glyph in a screenshot before Enter; retype drops with
  `reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion
  \Winlogon" /v AutoAdminLogon /t REG_SZ /d 1 /f` still needs
  the space — no shortcut.
- [x] SHORTER PATH WORKED — `control userpasswords2` GUI
  (OBSERVED 2026-10-03): short command typed clean (no drops —
  screenshot shows exact `control userpasswords2`) → Enter
  opens the **User Accounts** dialog listing `defaultuser0`
  AND `eval`, both `Administrators; Users` (VNC screenshot).
  GUI proof that `eval` is a real admin account on this
  machine. DIALOG LIMIT (OBSERVED 2026-10-03): this OOBE-phase
  User Accounts dialog shows NO `Users must enter a user name
  and password` checkbox — only user list + Add/Remove/
  Properties + password-reset hint. So no auto-logon toggle
  here. VNC-CLICK LIMIT (OBSERVED 2026-10-03): clicks PASS
  THROUGH the User Accounts dialog to the console behind it —
  `eval`-row double-click syntax unsupported (`unknown cmd
  "doubleclick"`), two rapid clicks leave `defaultuser0`
  highlighted, and an OK-button click at (260,485) closed the
  DIALOG but left the console window (screenshot: dialog gone,
  `control userpasswords2` console on top). The USB-tablet
  pointer reaches the console, not the dialog list — dialog
  Tab-to-list + arrows + Enter in the dialog, or `Alt+O` OK
  accelerator, then registry AutoLogon with per-word verify.
  `Alt+O` NO-OP (OBSERVED 2026-10-03): `send-key KEY_LEFTALT
  KEY_O` on the console-topped screen typed a stray `o` on the
  console line (screenshot) — chorded Alt does NOT reach the
  (already closed) dialog; confirms `send-key` multi-key calls
  deliver keys SEQUENTIALLY, not as chords. QUOTELESS RETRY
  (OBSERVED 2026-10-03): aborted `oreg add hklm` line, CLS
  cleared, refocused, slow retype: `reg add hklm` verified
  exact in screenshot, then `\software` verified exact
  (`hklm\software` in screenshot) — per-word capture VERIFY
  rule WORKS. Quoteless form avoids the `"` drop entirely.
  `\microsoft` + `\windows` + `\nt` all verified exact per-word
  (screenshots: `...\microsoft`, `...\windows\nt`). SPACE-DROP
  CONFIRMED (OBSERVED 2026-10-03): the very next `KEY_SPACE`
  after `\nt` produced NO glyph (screenshot shows `...\nt`
  with no trailing space) — spaces drop even in isolation at
  2.5 s settle. `send-key KEY_SPACE` is unreliable on this
  console. Workarounds: (a) `KEY_KP_SPACE` INVALID keycode
  (OBSERVED 2026-10-03 — qemu `send-key` rejects it);
  `KEY_KP0` accepted but types `0` (screenshot shows
  `...\nt0`, removed via Backspace — line restored exact);
  `KEY_NUMERIC_SPACE` INVALID. So (a) is DEAD — reg path
  unreachable); drive the `userpasswords2` dialog by keyboard
  (Tab/arrows+Enter — no spaces needed), or set `eval`
  passwordless via `net user eval ""` (quotes drop — use
  `net user eval *` interactive?) + reboot-to-logon.
  DIALOG KEYBOARD (OBSERVED 2026-10-03): relaunched dialog via
  console (typed clean, no drops); `KEY_TAB×5` moved focus to
  the Cancel button (screenshot: Cancel dotted-focus, list
  still on `defaultuser0`); `KEY_DOWN` reached the BUTTON ROW
  (Cancel), NOT the user list. Letter-jump `KEY_E` no-op
  (list unchanged, screenshot); Tab×6 cycle returns to Cancel
  (screenshot) — Tab order is dialog-chrome-only, the LIST is
  never in the Tab order while the console owns focus.
  CONSOLE-CLOSE BREAKTHROUGH (OBSERVED 2026-10-03): `exit`+Enter
  in the focused console CLOSED it (screenshot: console gone,
  dialog + MS-sign-in only). Post-close: Tab walks the DIALOG
  (OK dotted-focus, screenshot); VNC click on `eval` (140,230)
  LANDS with NO console behind (cursor ON the `eval` row,
  screenshot — vs pass-through before). STUCK (OBSERVED
  2026-10-03): highlight stays on `defaultuser0` through Down,
  click+Down, second click — the dialog LIST does not take
  selection by mouse or arrows in this OOBE session (3
  screenshots). The dialog PROVES `eval` exists as admin but
  the install; the logon screen should list `eval` (or accept
  `.\eval` + `eval123`). Host-side reboot is proven safe.
  ESC-CLOSE + REBOOT (OBSERVED 2026-10-03): `KEY_ESCAPE`
  rejected (use `KEY_ESC`); `KEY_ESC` CLOSED the accounts
  dialog (screenshot: dialog gone, MS-sign-in only).
  Host `destroy`+`start` reboot → back at OOBE REGION page
  (`United States`, screenshot 15:16+45s), NOT a logon screen
  — OOBE never completed, so there is no logon yet. The loop
  is structural: OOBE gates on MS-sign-in, `eval` exists but
  OOBE will not hand off.
  NIC-DETACH OFFLINE OOBE (OBSERVED 2026-10-03): live
  `detach-device` with `<link state='down'/>` SUCCEEDED
  (`Device detached successfully`, interface count 1→0).
  Region → keyboard → Skip navigated clean, then OOBE shows
  `Let's connect you to a network` with `I don't have
  internet` link (screenshot). Mouse click on the link only
  focuses (cursor visible, page identical); TAB×5+Enter opened
  a `Select Folder` driver dialog instead (screenshot: This
  itself, not Install-driver). TAB×10 lands Install-driver +
  one more TAB lands ON the link (focus rect, screenshot);
  Enter ACTIVATES it (OBSERVED 2026-10-03) → **`Who's going to
  use this device?`** local-account page with focused `Name`
  field (screenshot).
- [x] DESKTOP AS `cleanval` (OBSERVED 2026-10-03): Enter on the
  focused Next advanced privacy (keyboard activates where
  clicks only focus) through pages to Accept → `This might
  take a few minutes` finalize → **Windows 11 desktop as
  `cleanval`** (VNC screenshot: taskbar + Start menu open,
  `cleanval` account footer, `Windows 11 IoT Enterprise LTSC
  Evaluation / valid for 90 days / Build 26100.6584`). Clean
  VM is a REAL isolated machine: different username
  (`cleanval`, not `windows-VM`), no dev tools, OOBE-built.
  Next: SDK + NSIS toolchain (net back — see below), copy
  source, clean build + install + acceptance A–F.
- [x] NIC RE-ATTACHED live (OBSERVED 2026-10-03):
  `attach-device` with user/e1000e XML → `Device attached
  successfully`, interface count 0→1. Display was ASLEEP at
  first capture (black frame); a `KEY_SPACE` wake restored the
  desktop (screenshot: Start menu open from earlier session,
  taskbar clock 11:53 PM, build stamp intact). EDGE LAUNCH
  (OBSERVED 2026-10-03): single VNC click only SELECTS the
  Edge icon (tooltip `Browse the web`, screenshot), 2nd click
  selects the label text (screenshot), Enter does NOT launch
  the VNC round-trip cannot deliver, or `Win+R` → `msedge`.
  WIN-KEY CODES (OBSERVED 2026-10-03): `KEY_LEFTMETA` sends
  clean but does NOT open Start; `KEY_SUPER_L`/`KEY_META_L`
  INVALID. Taskbar Search click (450,705) no-op. BUT
  `Ctrl+Esc` OPENS START (OBSERVED 2026-10-03): `send-key
  KEY_LEFTCTRL KEY_ESC` in one call works (OS sees the chord):
  Start opens search-focused, Pinned Edge/Settings/Explorer,
  footer `cleanval` (screenshot). Pinned-Edge clicks
  (335,155 + 335,152) both no-op — Start tiles ignore VNC
  clicks. BUT SEARCH+ENTER WORKS (OBSERVED 2026-10-03):
  typed `edge` (Best-match Microsoft Edge, screenshot) →
  Enter LAUNCHES **Edge** (welcome page, taskbar icon live,
  screenshot). Keyboard-only path proven — tiles unneeded.
  Next: `Start without your data` → address bar → net verify,
  then toolchain downloads (VS Build Tools, SDK, NSIS).
  WELCOME KEYBOARD (OBSERVED 2026-10-03): ESC dismissed the
  sign-in dialog (welcome only); TAB×5+Enter did NOT activate
  no-data — it opened a Copilot page CONTEXT MENU
  (`Summarize page / Chat / Talk to Copilot + Share tab`,
  screenshot). Focus went to the page canvas, not the
  buttons. TAB×12 lands ON `Start without your data`
  (focus rect + bing status-URL, screenshot) — but Enter did
  NOT advance (next capture: Translate popup over unchanged
  welcome, screenshot). Button focused but Enter misfires.
  SPACE ALSO STUCK (OBSERVED 2026-10-03): clean retry (ESC →
  TAB×14, no context menu this time) + SPACE on the focused
  button leaves the welcome page UNCHANGED (screenshot
  identical incl. status URL). Welcome buttons dead by all
  inputs in this session — PIVOTED to cmd (done, see below).
- [x] GUEST NET PROVEN (OBSERVED 2026-10-03): `Ctrl+Esc` →
  type `cmd` (Best-match Command Prompt, screenshot) → Enter
  opens `cmd.exe` as `C:\Users\cleanval>` (10.0.26100.1742);
  `ipconfig` shows **Ethernet: IPv4 10.0.2.15/24, gateway
  10.0.2.2** (user-mode NAT, screenshot). PING TYPO (OBSERVED
  2026-10-03): typed `ping 8.8..2` (screenshot) — a `KEY_DOT`
  silently DROPPED mid-command (same class as space/slash/
  quote), ping ran against literal `8.8..2` → `could not find
  alphanumerics reliable. PING GATEWAY SUCCESS (OBSERVED
  2026-10-03): retyped per-segment with screenshot verify
  after EACH dot (`ping 10.` then `10.0.2.` then `10.0.2.2`,
  all glyphs exact) → Enter → **4 replies from 10.0.2.2,
  0% loss, 1 ms, TTL 255** (screenshot). Dots land when typed
  ONE per `send-key` call + verified — batching drops them.
  Guest↔host NAT path proven. OUTBOUND TIMEOUT (OBSERVED
  2026-10-03): exact `ping 8.8.8.8` (per-dot verified,
  screenshot) → 4× `Request timed out`, 100% loss
  (screenshot). ICMP egress blocked at the host/network
  level (user-mode NAT passes gateway ping, not internet
  an http(s) address, or `curl -I` a toolchain URL (TCP 443
  usually passes where ICMP does not), then downloads.
  NO HTTP CLIENT (OBSERVED 2026-10-03): the `curl`+`cls`
  line ran as one token (missing space — screenshot shows not
  recognized) because `KEY_SPACE` dropped again — same class.
  Worse: the HTTP downloader binary itself is ALSO absent on
  this LTSC image (not in PATH/system32 of IoT Enterprise
  LTSC). TCP check needs the built-in `certutil` fetch mode
  (in-box since XP: `certutil` + verified space + `-urlcache`)
  or the Edge address bar. Next: `certutil` with per-glyph
  verify, or finish Edge welcome → address bar.
- [ ] HOST PROVISIONING (DECISION 2026-10-03): guest downloads
  are blocked on all fronts (ICMP egress timeout, no HTTP
  downloader on LTSC, Edge welcome stuck, `send-key` drops
  space/slash/dot/quote). Instead: host builds a FAT32
  `provision.fat` (256 MB, `mkdosfs` OK) with the portable
  worker (dists staged at `/tmp/prov-mnt/worker/`) + Node
  portable + fixtures, attaches it as a second `virtio` disk
  (XML pattern staged at `/tmp/prov2.xml`), guest mounts it
  read-only and runs acceptance WITHOUT any guest download.
  Needs: FAT writer — `pipx install fattools` SUCCEEDED for
  `ls` but `cp` crashes (`IndexError` on empty short name).
  ISO9660 WON (OBSERVED 2026-10-03): `xorriso -as mkisofs -J
  -R worker` → `provision.iso` 610304 bytes (298 sectors);
  SATA hotplug REJECTED (`disk bus 'sata' cannot be
  hotplugged`) but `virtio` attach SUCCEEDED (`Device
  attached successfully`, `vde`). WMIC LOOP (OBSERVED
  2026-10-03): `wmic logicaldisk get caption` needs TWO
  spaces; first landed (`wmic logicaldisk`), second dropped
  (`getcaption`), fix retype appended a SECOND ` get caption`
  while the bad `getcaption` REMAINS (line now has both —
  screenshot). Spaces drop ~50% mid-command even at 2.5 s.
  SPACELESS drive check — `fsutil fsinfo drives` has ONE
  space; or `powershell -c` ... also spaced. `vol` RETRY
  (OBSERVED 2026-10-03): aborted wmic via Ctrl+C, `vol`
  typed, space verified MISSING again (bare `vol`), retry
  space landed (`vol d.` — screenshot) but colon resisted:
  `KEY_DOT`=period, `KEY_COLON` INVALID, plain `Shift+;`
  lands 2nd period (`vol d..`). COLON VIA HOLD-TIME (OBSERVED
  2026-10-03): `send-key --holdtime 500 KEY_LEFTSHIFT
  KEY_SEMICOLON` in ONE call delivers a REAL `:` —
  screenshot shows **`C:\Users\cleanval>:`** on the fresh
  prompt (the `d..` line above is stale scrollback). Chords
  WORK with `--holdtime` (sequential delivery holds Shift
  colon) to switch to the provision drive, `dir` it, copy
  2026-10-03): typed `d` + hold-time `:` → line shows `d:`
  BUT prompt ALSO echoes — Enter executes `d:` against the
  STALE `mountvol` context and the shell prints a second
  prompt line, ending with bare `C:\Users\cleanval>` (no
  `D:\>` — screenshot). RETRY WORKED (OBSERVED 2026-10-03):
  fresh `d:` + Enter → **`D:\>`** (screenshot). BUT the
  drive is NOT the provision ISO: `dir` shows
  `CESE_X64FREE_EN-US_DV9` (the INSTALL ISO:
  `autorun.inf`/`boot`/`bootmgr`/`efi`/`setup.exe`,
  the install ISO (sda) still owns D:, provision is
  unmounted or took another letter. E: MISSING (OBSERVED
  2026-10-03): `e:` + Enter → `The system cannot find the
  drive specified` (screenshot) — only C: and D: exist.
  ROOT CAUSE: the provision ISO is attached as `virtio`
  (`vde`) but this SATA-installed Windows has NO virtio
  block driver (disk was switched vda→sdb/sata to satisfy
  Setup) — the device is invisible to the guest. ISO itself
  is VALID (host `xorriso` reads 83 nodes, PVD `ISOIMAGE`).
  FIX: shutdown + cold-attach the provision ISO as a second
  SATA cdrom (`sdc`, needs offline define — SATA cannot
  hotplug), reboot, `E:` + `dir` should show `worker/`.
  SATA FIX WORKS (OBSERVED 2026-10-03): destroyed, removed
  `vde`, defined `sdc`/unit-2 SATA cdrom with provision ISO,
  rebooted to desktop (build stamp, screenshot). Fresh
  `mountvol` (colonless, typed clean) now lists **`E:\` =
  `{986ea472-bf43-11f1-a6c3-806e6f6e6963}`** (screenshot) —
  FIVE volumes (D: install ISO `{3602a8c6…}`, E: provision).
  E: SWITCH + PAYLOAD VISIBLE (OBSERVED 2026-10-03): `e:`
  (hold-time colon) + Enter → **`E:\>`** (screenshot); `dir`
  shows **`Volume in drive E is ISOIMAGE`, `contracts/` +
  `detection/` + `ground-truth.json` (5620 B) + `scanner/` +
  `synth-eval/`** (screenshot). Host→guest channel PROVEN.
  fixtures + acceptance run. V2 PINS (OBSERVED 2026-10-03,
  dev-VM `C:\prov\portable`): **Node v22.19.0**
  (`995A3FB3CEFAD590…`), headless shell
  `chromium_headless_shell-1243\chrome-headless-shell-win64\`
  (same rev the worker uses: `chromium` 1243 +
  `chromium-headless-shell` 1243 per local browsers.json).
  v2 ISO = v1 worker payload + Node portable dir +
  `playwright-core` (14 MB) + headless-shell win64 dir +
  fixture site. STAGED (OBSERVED 2026-10-03): host
  `/tmp/prov2/` has worker dists + `playwright-core` 14 MB +
  fixtures (14 MB total); MISSING: `node.exe` 85 MB +
  headless-shell win64 ~230 MB (Windows binaries, live ONLY
  on the dev VM at `C:\prov\portable\`). DEVVM ISOLATED
  (OBSERVED 2026-10-03): guest IP is `192.168.122.13`
  (system `default` NAT, DHCP lease confirmed); a PowerShell
  TCP listener on 8413/8414 + firewall ALLOW still gives
  host-side `Connection refused` — the system libvirt network
  does not route inbound to guests, and the transient
  `Start-Job` listener dies with its QGA session (no jobs
  listed after). `node.exe` staged to `C:\prov\share\` on the
  dev VM (85 MB copy OK) but unreachable from host.
  REVERSE PULL WORKS (OBSERVED 2026-10-03): blank `pull.img`
  1 GB live-attached to DEV Win11 as `Red Hat VirtIO` 1 GB
  (disk 1, was MBR-unpartitioned — `New-Partition P:` +
  NTFS `PULL` OK, 770 MB free listed); `Copy-Item node.exe`
  → `P:\node.exe` 85268464 bytes OK; `robocopy` shell dir →
  `P:\shell\chrome-headless-shell.exe` 211550720 bytes, exit
  0. Both Windows binaries now sit on host-readable
  `pull.img` (ownership flipped to libvirt-qemu while
  attached). Next: detach from DEV, host-mount read
  (`fattools ls` NTFS? or loop — needs privilege... try
  `guestfish`? absent. Fallback: `qemu-img convert` the NTFS
  to a host dir? No — simplest: `xorriso` v2 ISO built from
  `P:` via a SECOND pass... host cannot read NTFS without
  DEV, attach SAME image to clean11, copy there directly.
  VIRTIO INVISIBLE ON CLEAN11 TOO (OBSERVED 2026-10-03):
  `pull.img` detached from DEV, live-attached to clean11 as
  `vdf` virtio — but fresh `mountvol` shows the SAME 5
  volumes (C:, D: install `{3602a8c6…}`, E: provision
  `{986ea472…}`, 2 unmounted) — NO new volume appeared
  (screenshot). Same root cause: no virtio block driver on
  the SATA install. SATA RE-ATTACH DONE (OBSERVED 2026-10-03):
  detached `vdf`, shutdown, defined `pull.img` as SATA disk
  `sdd`/unit-3 (plus converted provision `sdc` cdrom→disk —
  `readonly` SATA unsupported, dropped the flag), rebooted.
  your device on.`, screenshot) — first boot after the disk
  change triggered update finalization. UPDATE DONE (OBSERVED
  2026-10-03): desktop back (build stamp, screenshot), fresh
  `mountvol` shows a NEW **`81bcc58c-0000-0000-…` → `E:\`**
  (screenshot) — FIVE volumes again but E: CHANGED HANDS:
  disk (SATA `sdd` enumerated first). PULL PAYLOAD VISIBLE
  (OBSERVED 2026-10-03): `E:` + Enter → `E:\>`; `dir` shows
  **`Volume in drive E is PULL`, `node.exe` 85268464 bytes
  + `shell\` `<DIR>`** (screenshot) — the reverse-pulled
  Windows binaries are on the clean VM. C-SWITCH CLEAN
  (OBSERVED 2026-10-03): aborted the stray `mkdir` line
  (Ctrl+C), `c` + hold-time `:` + Enter → back at
  `C:\Users\cleanval>` (screenshot — no garble this time,
  verify-then-Enter split works). MD-SPACE STUCK (OBSERVED
  2026-10-03): `md` typed, TWO `KEY_SPACE` retries 5 min apart
  both produce NO glyph (screenshots: bare `md`, bare `md` —
  scrolled but identical). Space is now 0-for-3 on this
  GUI (Ctrl+C/Ctrl+V need no spaces), or `robocopy` via a
  BATCH FILE written with `echo` redirects... also spaced.
  EXPLORER VIA START DEAD (OBSERVED 2026-10-03): multi-word
  `file explorer` + Enter dismissed Start (no Explorer);
  single-word `explorer` + wait: Start NEVER OPENED at all
  (screenshot: desktop + taskbar only, no menu — the
  `Ctrl+Esc` chord itself was swallowed this time, 10:48 AM
  clock). Start via keyboard is now flaky (worked 5×
  before). WIN+E WORKS (OBSERVED 2026-10-03): `send-key
  --holdtime 500 KEY_LEFTMETA KEY_E` opens File Explorer at
  Home (Quick access + This PC + `CD Drive (D:) CE...` in
  nav, taskbar Explorer icon live, screenshot). Meta chords
  WORK with `--holdtime` (like Shift+; colon did). Start menu
  no longer needed. THIS-PC CLICK NO-OP (OBSERVED 2026-10-03):
  double-click on `This PC` row (215,620 ×2) leaves Explorer
  on Home (screenshot: same Home + nav, 10:58 AM) — the
  nav-pane row ignores VNC clicks like Start tiles did.
  the drive tree in place), or double-click `CD Drive (D:)`
  row, or address-bar `E:` typed + Enter (colon proven).
  ALT+D HOLDTIME ALSO NO-OP (OBSERVED 2026-10-03):
  `--holdtime 500 KEY_LEFTALT KEY_D` leaves the address bar
  UNFOCUSED too (screenshot: breadcrumb `Home` still, 11:05
  AM) — unlike Meta+E and Shift+;, Alt+D does not form even
  with holdtime (Alt may need LEFTALT-as-Meta mapping this
  console lacks). Explorer keyboard path is EXHAUSTED for
  addressing. PIVOT: drive the CONSOLE (proven: `E:`+Enter
  works there, PULL dir listed) — copy needs spaces, so use
  `Ctrl+C`... needs selection. REALISTIC: `xcopy` with
  Tab-completion (type `x`, Tab to `xcopy`? still needs
  spaces) — OR PowerShell `Copy-Item` via ISE GUI? OR
  accept: provision v2 ISO REBUILD on host with the binaries
  ALREADY KNOWN (node+shell sizes known) — no. BEST: ask
  the console `cmd` for `doskey` macros? All spaced.
  CONSOLE BODY-CLICK FOCUSES (OBSERVED 2026-10-03): with
  Explorer CLOSED, clicking the console BODY (400,500)
  focuses it — `send-key KEY_C` lands as `c` appended to the
  stale `md` line (`md c_`, screenshot 11:24 AM). Taskbar
  click (450,735) did NOT focus (screenshot unchanged).
  `/`/`"`/`.` mid-sequence) drops. SPACE BREAKTHROUGH
  (OBSERVED 2026-10-03): cleared stale line, fresh `md` +
  THREE space retries → **`md c ` with trailing space**
  (screenshot 11:31 AM: `md` line shows `md c ` — second
  token is `c`, the SPACE after it LANDED). Retry loops
  WORK: spaces are intermittent (~1-in-3), not impossible.
  `prov` letters + Enter; then `xcopy` E payload with
  per-space retries each. C:PROV CREATED (OBSERVED
  2026-10-03): Enter on `md c\prov` produced NO error and a
  fresh prompt (screenshot 11:39 AM) — `C:\prov` EXISTS
  (silent success, the md-into-nothing pattern). XCOPY SPACE
  (OBSERVED 2026-10-03): `xcopy` verb typed clean (11:40
  AM), ONE space retry → **`xcopy ` WITH trailing space**
  (11:46 AM screenshot) — spaces land ~1-in-2 on retry.
  verify (colons via holdtime, dots one-per-call), Enter,
  hash-check the copy. SOURCE PATH EXACT (OBSERVED 2026-10-03):
  `xcopy e:` (11:47 AM) + `\node.exe` letters + dot + `exe`
  → **`xcopy e:\node.exe`** all glyphs exact (11:54 AM
  screenshot — backslash + dot both landed this time).
  Next: space + `C:\prov\` destination with per-glyph verify,
  Enter, `dir C:\prov` + hash-check. FRESH-LINE SPACES LAND
  (OBSERVED 2026-10-03): aborted the stuck line (Ctrl+C),
  retyped `xcopy` + space + `E:` (holdtime colon) FRESH —
  screenshot 12:06 PM shows **`xcopy e:` WITH trailing
  space**. Old line was poisoned (11 stuck); new line takes
  spaces. Lesson: ABORT stuck lines early, retype fresh —
  do not grind one line past ~3 misses. FULL SOURCE LINE
  (OBSERVED 2026-10-03): `\node.exe` (backslash + letters +
  dot + exe, each verified) on the fresh line gives
  **`xcopy e:\node.exe`** complete and exact (12:07 PM
  screenshot — the earlier garbled `xcopy e:\node.exe`
  scrollback above is the OLD poisoned line). Next:
  destination space + `C:\prov\` + Enter + `dir` hash-check.
- Competition submission: NOT SUBMITTED (freeze 2026-10-22, deadline
  2026-10-23 18:00 KST; no merge/release/deploy without authorization).
- [ ] BLOCKED — clean install: input-delivery blocker above (system
  privilege blocker bypassed via session URI).
- [ ] BLOCKED — NSIS installer + uninstall: SDK-gated (MSVC lane needs
  Win11 SDK import libs; approved — pending clean VM).
