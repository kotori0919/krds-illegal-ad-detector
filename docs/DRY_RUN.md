# Clean-machine dry run (Phase 24 — Windows, release-blocking)

Run on the cleanest available Windows 11 environment. Record each line
PASS/FAIL with evidence (screenshot, file hash, tasklist output).

## A. Release unpack (no dev tooling)

1. [ ] Unpack NSIS installer on a machine WITHOUT Node/Rust/Playwright.
2. [ ] Install with default options; note install size: _____ MB.
3. [ ] Launch from Start menu; record cold-start to first paint: _____ s.

## B. Scan flow

4. [ ] Enter test URL; start scan with defaults.
5. [ ] Progress shows real counters (no fabricated percent).
6. [ ] Cancel mid-scan → returns to start; repeat scan works.
7. [ ] Full scan completes; result screen shows technique counts.
8. [ ] Open evidence for one finding: raw text + location + technique visible.

## C. result.json validation

9. [ ] Export → 6 checks all pass → `result.json` saved.
10. [ ] UTF-8, no BOM: `Get-Content result.json -Encoding Byte | Select -First 3`
    is NOT `239 187 191`.
11. [ ] `meta` + flat `findings`; technique ∈ 4 official; ids unique;
    no duplicate `url+location+technique`.
12. [ ] Each `location` resolves in a browser console:
    `document.querySelectorAll(sel).length === 1` per `>>>` segment.

## D. Process hygiene (release-blocking)

13. [ ] Close app mid-scan → no `krds-detector`, `scanner-worker`, or
    headless-Chromium processes remain (`tasklist`).
14. [ ] Repeat close-scan check after a failed scan.
15. [ ] Repeat full scan after failure (recovery).

## E. Build from submitted source

16. [ ] On a second clean machine WITH tooling: follow `docs/BUILD_MANUAL.md`
    from `npm ci`; record every deviation.
17. [ ] `cargo check` + `cargo test` in `src-tauri/` pass on Windows.
18. [ ] Rebuilt NSIS hash matches submitted source tree (`git status` clean).

## F. Submission packet (before 2026-10-23 18:00 KST, freeze 10-22)

- [ ] Windows 11 executable/package
- [ ] Complete source code
- [ ] `docs/BUILD_MANUAL.md` + `docs/USER_MANUAL.md`
- [ ] `docs/PLANNING_DOC.md` + application forms
- [ ] `result.json` (+ `result_extra.json` if extras ship) samples
- [ ] Attachment size / signature / email verification done
