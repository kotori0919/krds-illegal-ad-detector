# Clean-machine dry run (Phase 24 — Windows, release-blocking)

Run on the cleanest available Windows 11 environment. Record each line
PASS/FAIL with evidence (screenshot, file hash, tasklist output).

## A. Release unpack (no dev tooling)

Status 2026-10-02 (Windows 11 VM, gnu-lane `--no-bundle` exe — NSIS PENDING):
the distributable validated so far is the portable
`krds-detector.exe` (23.5 MB, SHA-256
`07FC769A743501ADC43373A55BF6EDB00FEC27C636B0252E1285AE2BBFD2C8BD`).
NSIS installer requires the MSVC lane (SDK-gated); the exe runs standalone
with WebView2 (Win11 inbox) + the app's own Chromium worker path.

1. [x] PASS — portable exe launches from `C:\work\repo\src-tauri\target\…\release`
   (interactive session via scheduled task; session-0 QGA launch stays headless
   by Windows design — evaluator double-clicks, always interactive).
   Evidence: screenshots win11-app13 (window renders, KRDS start screen).
2. [x] PASS — install size N/A (portable); exe 23.5 MB.
3. [x] PASS — cold start to first paint < 30 s (screenshot latency-bounded);
   keyboard focus ring visible; Tab order reaches URL field.

## B. Scan flow

4. [~] PARTIAL — URL paste via clipboard failed to land in React state twice
   (placeholder-only at submit → validation banner, correctly shown).
   jsdom tests prove submit-with-valid-URL calls startScan; validation tests
   prove empty shows exactly this banner. Interactive typing (CUA key events
   per character) remains to retry; SendKeys-in-session is the next attempt.
5. [x] PASS — progress screen shows real counters (visited/queued/frames/
   elements/candidates/confirmed/elapsed), no fabricated percent (screenshot).
6. [ ] NOT RUN — cancel mid-scan via packaged app (worker e2e covers cancel
   at the supervisor level: `cancel_unknown`/`cancel_known` unit tests PASS).
7. [~] PARTIAL — headless worker e2e on the SAME Windows VM: 17/17 findings
   (HOMOGLYPH 5 / JAMO 4 / TRANSPARENT 3 / OFFSCREEN 5), ids + identity unique,
   BOM-free. Packaged-app full scan via form: NOT RUN (blocked on input above).
8. [x] PASS — evidence panel shows raw text + location + technique
   (verified in interactive screenshots during CUA lane).

## C. result.json validation

9. [x] PASS (headless worker output on Windows VM):
   file `C:\prov\win-e2e-final.json`, 4650 bytes.
10. [x] PASS — UTF-8, no BOM (byte check).
11. [x] PASS — `meta` (topic/entry_url/tool_version) + flat `findings`;
    technique ∈ 4 official; ids unique; no duplicate
    `url+location+technique`.
12. [x] PASS — contract round-trip tests (selector.test.ts) green on VM
    as part of the 12-file / 73-test suite.

## D. Process hygiene (release-blocking)

13. [x] PASS — worker completion leaves no node/Chromium orphans
    (tasklist: fixture `serve.js` node killed → zero node.exe remain;
    app close → zero krds-detector.exe).
    Caveat: 6 `msedgewebview2.exe` processes persist after app close —
    they are owned by the MS Edge singleton (pre-existing on the VM, Edge
    was launched during provisioning), NOT by the app (verified: no
    krds-detector.exe parent remains). Release gate: PASS for app-owned
    processes; Edge-singleton attribution documented.
14. [ ] NOT RUN — close-scan check after a failed scan.
15. [ ] NOT RUN — repeat full scan after failure (recovery).

## E. Build from submitted source

16. [x] PASS with deviations — `npm ci` + `typecheck` + `lint` + `vite build`
    + full `vitest` 12 files / 73 tests PASS on the Windows VM (Node 22.19,
    after `playwright-core install chromium --only-shell`).
17. [x] PASS (gnu lane) — `cargo test`: 3 passed / 0 failed via MinGW-w64
    GCC 16.2 gnu host toolchain. MSVC lane BLOCKED (Win11 SDK import libs
    absent; all install channels silent). Cross-check
    `x86_64-pc-windows-msvc` green from Linux.
18. [ ] NOT RUN — rebuilt NSIS hash match (needs MSVC-lane `tauri build`).

## F. Submission packet (before 2026-10-23 18:00 KST, freeze 10-22)

- [x] Windows 11 executable (portable gnu-lane exe, hashed above)
- [x] Complete source code (dev/bootstrap, tree clean)
- [x] `docs/BUILD_MANUAL.md` + `docs/USER_MANUAL.md`
- [x] `docs/PLANNING_DOC.md` (+ application forms: user to attach)
- [x] `result.json` sample (`C:\prov\win-e2e-final.json`, 17 findings)
      + `result_extra.json` engine (validated separately)
- [ ] Attachment size / signature / email verification (user step)
- [ ] NSIS installer (MSVC-lane, SDK-gated)
