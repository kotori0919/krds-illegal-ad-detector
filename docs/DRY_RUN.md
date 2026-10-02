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

4. [~] PARTIAL — URL paste via clipboard failed to land in React state twice
   (placeholder-only at submit → validation banner, correctly shown).
   jsdom tests prove submit-with-valid-URL calls startScan; validation tests
   prove empty shows exactly this banner. Interactive typing (CUA key events
   per character) remains to retry; SendKeys-in-session is the next attempt.
5. [ ] UNVERIFIED (미근거) — progress screen showed real counters on the
   reference build (screenshot). On current builds the ONLY observed
   progress screen is the failure path (`failed`, all counters 0,
   screenshots win11-r2/win11-s2/win11-full): meaningful non-zero
   progress has NOT been observed through the desktop host.
6. [ ] UNVERIFIED (미근거) — cancel mid-scan via packaged app NOT RUN.
   Registry unit tests (cancel unknown/known, terminal-state guards,
   live-sleeper kill) pass on Linux; host survival + Chromium-descendant
   termination + rescan-after-cancel on Windows NOT observed.
7. [x] PASS (PACKAGED APP, OBSERVED 2026-10-02) — full scan via the
   packaged form on build `21E751C1…` (dialog-export lane): session
   `d819fa1d…`, `상태: succeeded`, 17 findings (HOMOGLYPH 5 / JAMO 4 /
   TRANSPARENT 3 / OFFSCREEN 5), table rows with page + `#ad-*`
   locations + technique badges (screenshot win11-x). Prior worker-CLI
   sample `C:\prov\vm-final2.json` (4650 bytes, magic `7B 0A 20 20`)
   also valid. Interactive-user browser cache (`dbsgu` profile +
   provisioned shell + full chromium) + `.mjs`-first resolver were the
   fixes; SYSTEM-cache override was the bug (removed).
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
14. [x] PASS (worker seam, OBSERVED 2026-10-02) — mid-scan worker kill:
    Chromium `chrome-headless-shell` PIDs present during scan, ZERO
    remain after `Stop-Process` on the worker; fixture/vite `node.exe`
    untouched. Job-guard whole-tree kill corroborated (no orphans).
15. [x] PASS (worker seam, OBSERVED 2026-10-02) — mid-scan kill +
    rescan: 4 Chromium PIDs during 200-page scan → ZERO after worker
    `Stop-Process`; fresh rescan exits 0 with output (245 bytes).
    Packaged-app cancel button + failed-scan close:
    [ ] UNVERIFIED (미근거) — registry unit + live-sleeper tests green,
    desktop-button flow NOT exercised.

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
