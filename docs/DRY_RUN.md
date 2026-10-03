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
  scrollback above is the OLD poisoned line). DEST C-COLON
  (OBSERVED 2026-10-03): destination space ×2 shows `…exe`
  + trailing space (12:13 PM), then `c` + holdtime `:` →
  screenshot). NODE COPIED (OBSERVED 2026-10-03): full line
  `xcopy e:\node.exe c:\prov\` verified exact (12:20 PM) →
  Enter → **`E:\node.exe`, `1 File(s) copied`** (screenshot
  12:25 PM). node.exe 85 MB now on `C:\prov`. SHELL XCOPY
  SPACE (OBSERVED 2026-10-03): fresh `xcopy` + ONE space →
  **`xcopy ` with trailing space** (12:32 PM screenshot).
  one-per-call verify), Enter, `dir` both + hash-check.
  SHELL SOURCE EXACT (OBSERVED 2026-10-03): `E:` (holdtime
  colon) + `\shell` letters → **`xcopy e:\shell`** all exact
  space + `/E` (slash one-per-call), Enter, verify dir copy.
  SHELL DEST STUCK (OBSERVED 2026-10-03): THREE space
  retries (first + 2 more) ALL bare `xcopy e:\shell`
  (12:40→12:46 PM screenshots — NOTE the scrollback: the
  `1 File(s) copied` line is the OLD node copy, this line is
  still sourceless). Same poisoned-line pattern as the node
  retype (fresh lines take spaces), then dest path. FRESH
  ABORT PROOF (OBSERVED 2026-10-03): Ctrl+C aborted the
  3-stuck line; fresh `xcopy` + ONE space → **`xcopy ` with
  trailing space** again (12:53 PM screenshot — and the OLD
  `xcopy e:\shell` bare line is visible just above, proving
  `E:\shell` + space + `C:\prov\shell\` + space + `/E`.
  FRESH SHELL SOURCE (OBSERVED 2026-10-03): on the aborted
  fresh line, `E:` + `\shell` letters → **`xcopy e:\shell`**
  all exact again (1:00 PM screenshot — and the PRIOR
  `xcopy e:\shell` bare line is visible just above, same
  one-per-call), Enter, verify dir copy. DESTINATION DOUBLED
  (OBSERVED 2026-10-03): `c` + colon + `\prov\shell\` typed
  clean per-glyph, but the screenshot shows EVERY glyph
  TWICE — `c::`, `\\`, `prov` doubled, `shell\\` (`xcopy
  e:\shell  c::\\prov\shell\\`, 1:14 PM). A stuck Shift or
  repeat delivered each key twice (the `c::` + `\\` pattern).
  keys without holdtime where possible. SHORTER SETTLE
  (OBSERVED 2026-10-03): Ctrl+C aborted the doubled line OK
  (fresh prompt, 1:15 PM); `xcopy` + space + `e:\shell`
  retyped with 1 s settles → **`xcopy e:\shell` MISSING the
  `x`** (1:21 PM screenshot). Shorter settle trades doubling
  `x` alone until it lands, then continue. SHELL COPY DONE
  (OBSERVED 2026-10-03): medium settle (~1.5 s) works both
  ways — missing `x` backspaced OK (1:27 PM), ` c:\` + holdtime
  colon + `\` all single glyphs (no double), then
  `\prov\shell\` + space + `/e` all exact → **`290 File(s)
  copied`** (1:28 PM screenshot, locales/resources tail).
  Medium settle is the rule: 1 s drops, 2.5 s doubles.
  DIR VERIFIED (OBSERVED 2026-10-03): `dir c:\prov\shell`
  typed exact first-try with medium settle (1:29 PM), Enter
  → **full listing: 13 File(s) 237,684,144 bytes, 6
  Dir(s)** — `chrome-headless-shell.exe` 211,550,720,
  dlls, `locales/`, `resources/`, `hyphen-data` all present
  check of the exe, then provision letter hunt. HASH
  VERIFIED (OBSERVED 2026-10-03): full `certutil -hashfile
  c:\prov\shell\chrome-headless-shell.exe sha256` typed
  exact with medium settle (1:40 PM), Enter →
  **`addfa79abb060e1e514e155ed745d4bf96140bca402735958bb4e223aea0b98c`**,
  `CertUtil: -hashfile command completed successfully`
  (screenshot). Host-side sha256 comparison inconclusive
  letter hunt (`E:`, provision media), then worker + fixtures.
  LETTER MAP SOLVED (OBSERVED 2026-10-03): the `e:` probe
  SWITCHED cleanly to `E:\>` (1:42 PM screenshot — medium
  settle colons keep working), `dir` → **`Volume PULL`,
  `node.exe` 85268464 + `shell\`** (1:48 PM). E: is the
  PULL disk (`sdd`), NOT the provision ISO. Disk map:
  `sda`=install ISO, `sdb`=system, `sdc`=provision ISO,
  `sdd`=PULL. So the provision ISO media must own another
  letter (`D:` still install ISO? `F:`?). Back on
  `C:\Users\cleanval>` clean (1:48 PM). Next: hunt the
  `contracts/` + `ground-truth.json`. D IS INSTALL ISO
  (OBSERVED 2026-10-03): `d:` switched to `D:\>` (1:49
  PM), `dir` → **`Volume CESE_X64FREE_EN-US_DV9`**,
  `autorun.inf`/`boot`/`bootmgr`/`efi`/`setup.exe`/`sources`/
  `support`, 0 bytes free (1:55 PM screenshot). D: is the
  install ISO (`sda`), NOT provision. So provision ISO
  (`sdc`, `ISOIMAGE`) owns another letter — `F:` most
  likely (2 unmounted volumes in the mountvol list). Next:
  `c:` back, `f:` + `dir` for `contracts/` + fixtures.
  F MISSING (OBSERVED 2026-10-03): back on
  `C:\Users\cleanval>` clean (1:56 PM); `f:` + Enter →
  **`The system cannot find the drive specified`**
  (2:01 PM screenshot). Only C:/D:/E: exist — the provision
  ISO (`sdc`, defined SATA cdrom unit-2, converted
  cdrom→disk) has NO letter. The 2 unmounted mountvol
  volumes include it (needs mount or online). Next:
  colonless `mountvol` to re-list volumes + GUIDs, then
  mount/assign or `diskpart` letter hunt. MOUNTVOL PROOF
  (OBSERVED 2026-10-03): bare `mountvol` printed its own
  usage + **`Possible values for VolumeName`**: `d0f3d79c`
  → `C:\`, `81bcc58c` → `E:\` (PULL), `3602a8c6` → `D:\`
  (install ISO), plus TWO `*** NO MOUNT POINTS ***` —
  `9c547e4d` and **`26581c6c`** (2:02 PM screenshot). The
  `sdc` provision ISO (raw ISO9660 as SATA `disk`, no
  partition table the guest mounts) is one of the two
  unmounted volumes. POWERED OFF (OBSERVED 2026-10-03):
  graceful `shutdown` ignored (still running 75 s),
  `destroy` → **`shut off`** (host confirms). Next: cold
  XML fix — `sdc` back to `device='cdrom'` + `readonly`
  (SATA cdrom mounts ISO9660 natively), `start`, `F:` hunt.
  CDROM FIX WORKS (OBSERVED 2026-10-03): reboot to desktop
  (build stamp, 2:16 PM), Start → `terminal` → Command
  Prompt open at `C:\Users\cleanval>`, `f:` + Enter →
  **`F:\>`** (2:17 PM screenshot), `dir` → **`Volume in
  drive F is ISOIMAGE`, `contracts/` + `detection/` +
  `ground-truth.json` 5620 B + `scanner/` + `synth-eval/`,
  1 File(s) 5620 bytes, 4 Dir(s)** (screenshot).
  Host→guest channel RESTORED. Next: copy worker +
  fixtures to `C:\prov\`, then node + shell acceptance.
  WORKER COPIED (OBSERVED 2026-10-03): full
  `xcopy f:\scanner c:\prov\scanner\ /e` typed exact
  first-try with medium settle (2:25 PM), Enter →
  **`10 File(s) copied`** — `crawl.d.ts`/`crawl.js`/
  `index.d.ts`/`index.js`/`queue.d.ts`/`queue.js`/
  `selectors.d.ts`/`selectors.js`/`urls.d.ts`/`urls.js`
  (2:25 PM screenshot). CONTRACTS COPIED (OBSERVED
  2026-10-03): first fixtures attempt dropped the colon
  (`xcopy fcontracts`, aborted clean via Ctrl+C, 2:27-2:30
  PM); careful retype `xcopy f:\contracts
  c:\prov\contracts\ /e` exact → **32 File(s) copied**
  (evidence/host/result/scan/selector/technique, 2:32 PM
  `synth-eval/`, then node check. DETECTION COPIED
  (OBSERVED 2026-10-03): `xcopy f:\detection
  c:\prov\detection\ /e` typed exact → **27 File(s)
  copied** — homoglyph/index/jamo/pipeline/result-engine/
  scan/semantic/visibility/worker (2:40 PM screenshot).
  node check. GROUND-TRUTH COPIED (OBSERVED 2026-10-03):
  `copy f:\ground-truth.json c:\prov\` typed exact →
  `synth-eval/` xcopy, then node check. SYNTH STUCK-KEY
  (OBSERVED 2026-10-03): the `xcopy f:\synth` prefix
  retype DOUBLED again (`xxcopy`, 2:48–2:54 PM —
  medium-settle `xcopy` doubled TWICE, then a shorter
  retype doubled again). Ctrl+C aborts clean each time
  but every `xcopy` attempt now doubles the `x`
  (guest key-repeat stuck after ~20 commands this
  session). Even a mangled `cls` errors `'cl' is not
  recognized` (dropped `s`, 2:55 PM). Fresh prompt at
  `F:\>`. Next: pause typing (let repeat settle), or
  reboot, then single `xcopy f:\synth-eval
  c:\prov\synth-eval\ /e`. SETTLE FIXES IT (OBSERVED
  2026-10-03): after the 2-min pause + reboot-screen
  settle, a single `xcopy` attempt lands **`xcopy`
  EXACT, no doubling** (3:03 PM screenshot — fresh
  `F:\>xcopy` line, cursor after `y`). The stuck repeat
  cleared. Next: continue ` f:\synth-eval
  c:\prov\synth-eval\ /e` on this clean line.
  SYNTH-EVAL SKIPPED (DECISION 2026-10-03): the source
  continuation re-doubled instantly (`xcopy f:\synth`
  with the extra `x` back, 3:04 PM — and the abort line
  above shows this is the FIFTH doubled attempt this
  session). The stuck repeat is per-`xcopy`-line, not
  cleared — only the bare `xcopy` word landed once.
  synth-eval is NOT acceptance-blocking (small harness
  dir, rebuildable from repo; worker 10 + contracts 32
  + detection 27 + ground-truth 1 are all staged). No
  QGA channel (`not configured`) to bypass send-key.
  then shell acceptance with staged payload.
  NODE RUNS (OBSERVED 2026-10-03): `e:` switched to
  `E:\>` cleanly despite the stray `e:` glyph line above
  (3:10 PM); `node.exe --version` typed exact (3:16 PM),
  Enter → **`v22.19.0`** (3:17 PM screenshot). The
  reverse-pulled PULL `node.exe` executes on the clean
  VM. Next: shell acceptance — headless-shell smoke
  from `C:\prov\shell\`, then worker run. TYPEFILE
  CHANNEL (OBSERVED 2026-10-03): back on `C:` clean
  (3:17 PM); per-glyph `chrome-headless` prefix typed
  exact, but `vncdotool typefile` of the FULL 49-char
  path lands **`chrome-headless` + `c;\prov\shell\...`**
  (3:24 PM) — the bulk channel concatenates onto the
  existing line and mangles BOTH quotes (`'c;\prov...exe'
  --version`, second attempt). typefile is fast but
  unreliable mid-line: it replays at 10 ms without
  per-glyph settle. Next: abort, then type the FULL
  path via typefile on a FRESH line only (no per-glyph
  prefix), or short `cd` + bare exe name. QUOTES MANGLE
  (OBSERVED 2026-10-03): fresh-line typefile ALSO
  duplicates the quote — `'c;\prov\shell\...exe'`
  THREE times (3:25 PM), and a `typefile 'E:'` probe
  lands `E:;_` (semicolon for colon, 3:30 PM) while a
  quoted `"E:\node.exe" --version` lands `E';\node.exe'`
  (3:31 PM). Root cause: typefile sends `:`/`"` via raw
  VNC keysyms WITHOUT the hold-time Shift chord, so the
  guest sees `;`/`'` instead. Per-glyph send-key (holdtime
  colon, fresh lines) is the ONLY reliable channel.
  Next: abort, `cd c:\prov\shell` + bare
  `chrome-headless-shell --version` per-glyph.
  SHELL RUNS (OBSERVED 2026-10-03): `cd c:\prov\shell`
  typed exact per-glyph (3:37 PM), Enter →
  `c:\prov\shell>`; bare `chrome-headless-shell.exe
  --version` typed exact (3:39 PM), Enter →
  **`Google Chrome for Testing 153.0.8010.12`**
  (screenshot). The copied shell binary executes on
  the clean VM. Next: worker acceptance run from
  `c:\prov\` with node + shell. WORKER CLI SCOPED
  (OBSERVED 2026-10-03): guest sits at `c:\prov\shell>`
  after a bare `c:\prov` typo (`'c:\prov' is not
  recognized`, 3:40 PM — expected, `cd` needs the
  verb). Host payload check: `/tmp/prov2/worker/` =
  `dist/` (full scan/detect/validate bundle) +
  `sidecar.mjs` CLI (`--session/--entry-url/--topic/
  --max-pages/--max-depth/--timeout-sec/--settle-ms/
  --executable-path/--channel/--out-file`, stdout =
  result.json only, progress on stderr). Fixtures at
  `/tmp/prov2/fixtures/synthetic/` (adversarial/
  negatives/positives/posts/structural + ground-truth).
  against a local fixture page. PROV STAGED (OBSERVED
  2026-10-03): guest at `c:\prov>` (3:53 PM — the `cd`
  landed), `dir` → **`contracts/` + `detection/` +
  `ground-truth.json` 5620 B + `node.exe` 85268464 +
  `scanner/` + `shell/`, 2 files 85274084 bytes, 5
  dirs** (screenshot). Full acceptance payload is on
  the clean VM. Next: launch the fixture page +
  worker run with node + shell. SERVE GAP (OBSERVED
  2026-10-03): the e2e harness serves fixtures via
  `@krds-detector/synth-eval/serve.js`
  (`startFixtureServer(PORT)` → `base` URL, readiness
  poll + `crawlSite({entryUrl: base...})`), but
  `synth-eval/dist/` was NEVER staged — provision ISO
  has `synthetic/` fixtures only (the synth-eval
  xcopy was skipped after 5 stuck-key doubles). The
  guest `c:\prov\` has worker + node + shell + fixtures
  but NO serve module and NO playwright-core on
  `NODE_PATH`. Next: EITHER stage synth-eval dist +
  playwright-core (needs ISO rebuild on host — no
  `file://` fixture URL directly. V3 LAYOUT (OBSERVED
  2026-10-03): v1 ISO top level = `contracts/` +
  `detection/` + `ground-truth.json` + `scanner/` +
  `synth-eval/` (FLAT dist layout, no `worker/` or
  `fixtures/` wrapper — `scanner/*.js` at root of
  `scanner/`, `sidecar.mjs` where?). Host `/tmp/prov2/`
  uses `worker/dist/` + `fixtures/synthetic/` WRAPPERS
  that do NOT match the ISO. v3 staging at `/tmp/prov3/`
  (worker 61 files + playwright-core 14 MB + serve.js
  44 KB + fixtures 92 KB) needs the FLAT layout +
  bare-import resolution (`@krds-detector/*` in
  scan.js) before `xorriso -as mkisofs`. Next: resolve
  flat vs wrapper + imports, build v3 ISO, cold-swap
  `sdc`, `F:` + `xcopy synth-eval`. IMPORTS RESOLVED
  (OBSERVED 2026-10-03): flat `/tmp/v3/` =
  `contracts/8` + `detection/9` + `scanner/5` +
  `synth-eval/3` + `evidence/5` js + `ground-truth.json`
  + `run-accept.mjs` (serve 4123 + `scanSite` + shell
  exe path) + `playwright-core@1.63.0` 14 MB +
  `node_modules/@krds-detector/*` symlinks +
  `node_modules/playwright-core` copy →
  **`node import scan.js`: `imports-ok`** (host).
  cold-swap `sdc`, `F:` verify + run. V3 SWAPPED
  (OBSERVED 2026-10-03): `destroy` → shut off;
  dumpxml `sdc` source `provision.iso` → patched to
  `provision3.iso` (defined OK, dumpxml confirms);
  `start` → running. Next: desktop verify, `F:` +
  `dir` for `run-accept.mjs` + flat layout, then
  `xcopy` v3 payload + `run-accept`. V3 LIVE (OBSERVED
  2026-10-03): desktop back via Win+R `cmd` (Start
  search ignored the keystrokes, 4:26 PM); `f:` →
  `F:\>` (4:27 PM), `dir` → **`Volume ISOIMAGE3`,
  `contracts/` + `detection/` + `evidence/` +
  `ground-truth.json` 5620 B + `node_modules/` +
  `package.json` 73 B + `playwright-core/` +
  `run-accept.mjs` 554 B + `scanner/` +
  `synth-eval/`, 3 files 6247 bytes, 7 dirs**
  (4:29 PM screenshot). The v3 flat payload + runner
  are on the guest. Next: `xcopy` v3 to `c:\prov\v3\`
  + `run-accept` with node + shell. XCOPY BLOCKED x6
  (OBSERVED 2026-10-03): the `xcopy f:` prefix lands
  COLONLESS (`xcopy f:`, aborted, 4:30 PM), then the
  minimal `xcopy f:\synth` re-DOUBLES
  (`xxcopy f:\synth`, 4:36 PM — SIXTH doubled line
  this session). The per-`xcopy` repeat is session-
  persistent (settle helped once, never twice). The
  v3 payload is FULLY READABLE in place on `F:`
  (ISOIMAGE3 `dir` above) — `run-accept.mjs` needs NO
  copy: run it from `F:` with node + shell. Next:
  holdtime and the path needs no `xcopy`. RUNNER GAPS
  (OBSERVED 2026-10-03): guest line shows
  `e:\node.exe` EXACT (4:37 PM screenshot — the `e:`
  holdtime colon + `\node.exe` all single glyphs, NO
  doubling on this non-`xcopy` line). Host review of
  `/tmp/v3/run-accept.mjs`: serves 4123 + `scanSite`
  entry `/` + shell `c:\prov\shell\...exe` — but (a)
  NO fixtures on v3 (`synthetic/` missing — v3 has
  flat dists, not the fixture pages), (b) NO
  `NODE_PATH`/cwd wiring for `@krds-detector/*` +
  `playwright-core` from `F:` (symlinks are host
  paths, dead on ISO9660), (c) shell path points at
  `c:\prov\shell\` (staged, OK). Next: fix runner
  (embed fixtures or copy them in) + `f:\run-accept`
  arg, Enter, observe. V4 BUILT (OBSERVED 2026-10-03):
  `/tmp/v4/` = flat dists (copies, NO symlinks) +
  `fixtures/synthetic/` 92 KB embedded +
  `node_modules/@krds-detector/*` real dirs +
  `node_modules/playwright-core` copy →
  **`v4-imports-ok`** (host). `fixtureRoot()` was
  `../../../fixtures` (repo-relative) → patched to
  `../fixtures` for the flat ISO → root resolves +
  `index.html` exists (host). `run-accept.mjs`
  rewritten (serve 4123 + `scanSite` + shell path).
  `xorriso -as mkisofs` → **`provision4.iso` 14 MB,
  `ISOIMAGE4`**, flat layout verified. Next:
  cold-swap `sdc`→v4, `F:` verify, guest
  `e:\node.exe f:\run-accept.mjs`. V4 SWAPPED
  (OBSERVED 2026-10-03): VM was shut off; dumpxml
  `sdc` source `provision3.iso` → patched to
  `provision4.iso` (defined OK, dumpxml confirms);
  `start` → running. Next: desktop verify, `F:` +
  `dir` for `fixtures/` + `run-accept.mjs`, then
  guest `e:\node.exe f:\run-accept.mjs`. V4 LIVE
  (OBSERVED 2026-10-03): VNC on `::5900` after the
  swap (5902 refused ×2 — new display `:0`); black
  screen → Start key → desktop (build stamp, 5:04
  PM); Win+R `cmd` → console; `f:` → `F:\>`;
  `dir` → **`Volume ISOIMAGE4`, `contracts/` +
  `detection/` + `evidence/` + `fixtures/` +
  `ground-truth.json` 5620 B + `node_modules/` +
  `package.json` 73 B + `run-accept.mjs` 553 B +
  `scanner/` + `synth-eval/`, 3 files 6246 bytes, 7
  dirs** (5:05 PM screenshot). `fixtures/` present
  this time. Next: guest `e:\node.exe
  f:\run-accept.mjs`, observe serve + scan.
  RUN STAGED (OBSERVED 2026-10-03): full
  `e:\node.exe f:\run-accept.mjs` typed EXACT
  per-glyph on `::5900` (5:06–5:13 PM — space +
  `f:\run` + `-accept.mjs` all single glyphs, NO
  doubling on this non-`xcopy` line). Runner CWD
  risk: `run-accept.mjs` uses RELATIVE
  `./synth-eval/serve.js` + `./detection/scan.js`
  imports — node resolves them against the SCRIPT
  path (`f:\`), NOT the `F:\>` cwd, so in-place
  execution is correct. Next: Enter, observe
  `serving 127.0.0.1:4123` + scan + result.json.
  ACCEPTANCE SCAN DONE (OBSERVED 2026-10-03): Enter
  → `serving http://127.0.0.1:4123`
  (5:14 PM); after ~2 min the display slept (blank
  captures ×2) — Start key woke it to a COMPLETED
  scan: **`F13` HOMOGLYPH
  `board.html?id=101` `#ad-query-hg`**,
  **`F14` HOMOGLYPH `comments.html`
  `#comment-2`**, **`F15` OFFSCREEN same page**
  (5:21 PM screenshot, result.json tail on screen,
  back at `F:\>`). The v4 flat payload (serve +
  scan + shell) runs end-to-end on the clean VM.
  Next: scroll up for full finding count + export
  `result.json` to `C:\prov\`, then A–F gates.
  SCROLL LOCKED (OBSERVED 2026-10-03): PageUp AND
  Shift+PageUp both leave the console on the SAME
  `F13`–`F15` tail (5:27 PM screenshots) — the
  window shows the result.json TAIL only (closing
  `]` + `}` + `F:\>` prompt, scan COMPLETED).
  `run-accept.mjs` prints json to STDOUT (console
  only, no `--out-file`): full count needs either a
  re-run with `> c:\prov\result.json` (UTF-16 risk —
  use `--out-file` variant) or ground-truth
  comparison on host. Next: re-run with file
  output, or validate the tail count (≥15) as the
  acceptance floor. V5 BUILT (OBSERVED 2026-10-03):
  `/tmp/v5/` = v4 + `run-accept.mjs` writes
  `c:\prov\result.json` via `writeFileSync` (UTF-8,
  bypasses PowerShell `>` UTF-16) + stderr byte log
  + stdout json → **`v5-imports-ok`** (host).
  `xorriso -as mkisofs` → **`provision5.iso` 14 MB,
  `ISOIMAGE5`**, flat layout verified. Guest is
  mid-session on v4 (scan completed) — swap needs
  power off. Next: `destroy` + define `sdc`→v5 +
  `start` + `F:` verify + guest re-run. V5 SWAPPED
  (OBSERVED 2026-10-03): VM was shut off; dumpxml
  `sdc` source `provision4.iso` → patched to
  `provision5.iso` (defined OK, dumpxml confirms);
  `start` → running. Next: desktop verify on VNC,
  `F:` + `dir` for `ISOIMAGE5`, then guest
  file-output re-run. V5 LIVE (OBSERVED 2026-10-03):
  desktop direct on `::5900` (build stamp, 5:45
  PM); Win+R `cmd` → console; `f:` → `F:\>`;
  `dir` → **`Volume ISOIMAGE5`, `contracts/` +
  `detection/` + `evidence/` + `fixtures/` +
  `ground-truth.json` 5620 B + `node_modules/` +
  `package.json` 73 B + `run-accept.mjs` 785 B +
  `scanner/` + `synth-eval/`, 3 files 6478 bytes,
  7 dirs** (5:46 PM screenshot). Runner is the v5
  file-output variant (785 B vs v4 553 B). Next:
  guest `e:\node.exe f:\run-accept.mjs` file-output
  re-run, validate `c:\prov\result.json`. V5 STAGED
  (OBSERVED 2026-10-03): full `e:\node.exe
  f:\run-accept.mjs` typed EXACT per-glyph on
  `::5900` (5:47–5:52 PM — space + `f:\run` +
  `-accept.mjs` all single glyphs, NO doubling on
  this non-`xcopy` line, v5 `dir` above as
  context). Next: Enter, ~2 min scan, wake +
  validate `c:\prov\result.json` on disk. V5 RERUN
  TAIL (OBSERVED 2026-10-03): Enter → `serving
  127.0.0.1:4123` (5:53 PM); ~2.5 min scan sleeps
  the display (blank ×1); Start key wakes to the
  SAME `F13`–`F15` tail (6:00 PM screenshot —
  identical HOMOGLYPH/OFFSCREEN findings, back at
  `F:\>`). Reproducible. The `wrote
  c:\prov\result.json` stderr line scrolled off —
  file validation still open. Next: `dir
  `c:\prov\result.json` + hash, then A–F. FOCUS FIX
  (OBSERVED 2026-10-03): the `dir c:\prov\...`
  line never echoed — keystrokes went nowhere
  (stale tail only, 6:01–6:07 PM). A VNC
  `move 500 500 + click 1` refocused the console:
  fresh `dir` typed → **`F:\>dir`** visible with
  cursor (6:07 PM screenshot). Window focus is a
  real input gate after display sleep. Next:
  finish the `c:\prov\result.json` path + Enter.
  FILE ON DISK (OBSERVED 2026-10-03): full
  `dir c:\prov\result.json` typed exact on the
  refocused console (6:08 PM), Enter →
  **`Directory of c:\prov`, `4,133 result.json`,
  `1 File(s) 4,133 bytes`** (6:12 PM screenshot).
  The v5 runner's `writeFileSync` landed the file —
  UTF-8 via node, no PowerShell redirect. Next:
  via contracts), then A–F gates. HASH RECORDED
  (OBSERVED 2026-10-03): full `certutil -hashfile
  c:\prov\result.json sha256` typed exact (6:13–
  6:19 PM), Enter →
  **`6aa74d80ca6871a001f571e647a825be60de4ffd2d27e86de791c1a2fbd2c062`**,
  `CertUtil: -hashfile command completed
  successfully` (6:20 PM screenshot). Content
  still shows the `F13`–`F15` tail (same scan).
  Next: pull the file to host for contracts
  validation (reverse `PULL` channel or retype),
  then A–F. PULLED (OBSERVED 2026-10-03): full
  `copy c:\prov\result.json e:\` typed exact
  (6:26 PM), Enter → **`1 file(s) copied`**
  (screenshot). The guest file is on the
  host-readable PULL disk (`sdd`). Next: detach
  `sdd`, host-mount/read `e:\result.json`,
  contracts-validate + hash-compare. DETACHED
  (OBSERVED 2026-10-03): VM was shut off; dumpxml
  `sdd` pull.img block removed via regex (1 block),
  defined OK — `grep pull.img` = 0, `domblklist`
  = sda/sdb/sdc only. MOUNT BLOCKED (OBSERVED
  2026-10-03): `pull.img` is FAT32 (`mkfs.fat`,
  MBR boot sector) but `sudo mount -o loop,ro`
  needs a terminal password (no askpass) and no
  unprivileged FAT reader is staged (`fattools`
  pipx has no importable module path, no `mtools`).
  File bytes are ON the image (guest `1 file(s)
  copied` + 4133 B `dir` + SHA `6aa74d80…`).
  Next: passwordless loop mount (askpass/polkit)
  or reattach `sdd` + guest `type` the file, then
  contracts validation. TYPE PREFIX (OBSERVED
  2026-10-03): post-reboot black screen → Start key
  → desktop (6:40 PM); Win+R `cmd` → console at
  `C:\Users\cleanval>`; `type c:\` typed EXACT
  per-glyph (6:41 PM screenshot). Console focused
  and taking input. Next: finish
  `prov\result.json`, Enter, capture head.
  CONTENT PROVEN (OBSERVED 2026-10-03): full
  `type c:\prov\result.json` typed exact (6:42
  PM), Enter → **`F13` HOMOGLYPH
  `board.html?id=101` `#ad-query-hg`
  `is_violation true`**, **`F14` HOMOGLYPH
  `comments.html` `#comment-2`**, **`F15`
  `OFFSCREEN` same page/location** (6:48 PM
  screenshot, file TAIL on screen). Official
  schema (`id/url/is_violation/location/
  evidence_text/technique`) renders from the
  ON-DISK file — not console stdout. Next:
  head capture (meta + F1) + contracts
  validation, then A–F. HEAD PATH (OBSERVED
  2026-10-03): Up-recall reprints the TAIL
  (F7 history shows ONLY `0: type
  c:\prov\result.json` — one entry). `more ` was
  typed onto the recalled line by mistake
  (`...result.jsonmore`, 6:54 PM) — abort before
  Enter. Correct path: FRESH `more
  c:\prov\result.json` (paged head: meta + F1–F3
  first), NOT Up-recall. Next: Ctrl+C, fresh
  `more` + path, Space-paged captures.
  2026-10-23 18:00 KST; no merge/release/deploy without authorization).
- [ ] BLOCKED — clean install: input-delivery blocker above (system
  privilege blocker bypassed via session URI).
- [ ] BLOCKED — NSIS installer + uninstall: SDK-gated (MSVC lane needs
  Win11 SDK import libs; approved — pending clean VM).
