# Release candidate — 2026-10-08

P1 feature integration is accepted. The complete NSIS candidate below passed
the three remaining release gates and is ready for user review. PR #2 remains
Draft; this record does not authorize merge, publication or contest submission.

## Candidate identity and storage

- Candidate: `rc-5e44feb-20261008`, app version `0.1.0`.
- Executable/package source: `5e44feb718b30d635ea08c615a1c15a5feb49672`.
  The subsequent release documentation commit changes no executable or resource bytes.
- Installer: `불법광고 탐지 도구_0.1.0_x64-setup.exe`, **149,137,501 bytes**.
- Installer SHA-256: `354809d19ee8a7beaf9271cf7ba7de832f7c75d4828553088c3fa6b53aa1cc4e`.
- Host SHA-256: `1b1bb0f95c872b1b1fc6f1b6222c434e97871c132d3c98458cabb2443b048ed0`.
- Scanner SHA-256: `8cdfea07cdd2e2edb79a21bd7e79a31e1db308898fbf68913f1335c673d89cea`.
- Private durable artifact directory:
  `/home/monad/.codex/artifacts/illegal-ad/rc-5e44feb-20261008/` (mode `0700`).
  Its single `manifest.json` inventories the installer, host, worker, loader DLLs,
  Node, browser, Tesseract/WASM, language data, embedded frontend inputs,
  configuration and lockfile hashes, plus evidence references and hashes.
  Large binaries and test helpers remain outside ordinary source commits.

OBSERVED: the repository-defined full `tauri build` ran `beforeBuildCommand`
and produced the NSIS installer; the extracted payload contains 679 files
(483,697,784 bytes, excluding generated uninstall metadata). All 679 installed
files matched that inventory. No installation repair or portable overlay was used.
See [BUILD_MANUAL.md](BUILD_MANUAL.md) and [INSTALL_LAYOUT.md](INSTALL_LAYOUT.md).

## Current verdict

Environment `W1`: reset `clean11` Windows 11 VM, OS `10.0.26100`, 4 vCPU,
8 GiB RAM, normal unelevated user. Development PATH was removed; no development
checkout or per-user Playwright cache was used. WebView2 `154.0.4258.62` was
already installed. The host PID/creation identity remained the same through
all scans and the restart check. Evidence filenames below are relative to the
durable directory's `evidence/`; each row refers only to this installer.

| Gate | Verdict | Candidate / environment | Observed result | Evidence | Remaining issue |
| --- | --- | --- | --- | --- | --- |
| A — clean install, real run, uninstall | PASS | `rc-5e44feb-20261008` / W1 | NSIS exit 0; 679 payload hashes match; two checked pages, one official finding, selected Korean image OCR, retrieved evidence and review; normal close and uninstall exit 0; owned processes absent; external export retained unchanged. | `environment.json`, `installed.json`, `native.json`, `ownership.json`, `uninstall.json` | None within this gate. |
| B — native deadline and disk export | PASS | `rc-5e44feb-20261008` / W1 | Supported 60 s limit with one completed page and unfinished slow links; partial completion shown; stored finding and coverage retained; native Save As wrote a 492-byte official result identical to stored serialization and valid UTF-8 without BOM. | `native.json`, `export.json`, `rc-result.json`, `export-validation.json` | None within this gate. |
| C — non-cooperative host cleanup | PASS | `rc-5e44feb-20261008` / W1 | Owned scanner suspended; real cancellation backstop settled as cancelled; scanner/OCR ownership and browser descendants gone; prior valid results retained; new scan completed while the same host stayed open. Harness killed no processes. | `fault.json`, `ownership.cleanup.json`, `cleanup-validation.json`, `native.json` | None within this gate. |

## Measurements and proof scope

MEASURED on W1 using monotonic time in the installed-app observer (500 ms
terminal polling; UI observation also includes its normal polling delay): the
representative scan reached terminal result in **9.461 s**. The 60 s deadline
scan reached terminal result in **55.089 s**; the UI exposed the validated,
exportable result in **57.111 s** from scan start. Its native Save As completed
later at `2026-10-07T15:27:21.609Z`, including operator interaction; that time
is not counted as scan settlement. The shared policy reserves finalization time
and stops admitting work that cannot fit its minimum page budget. This is the
production deadline path, rather than a replay or a changed safety constant.

OBSERVED: the saved file's SHA-256 is
`22089287c693b4c7322bfef963fca914acb19c02676a16b262b7f2dd9e12d874`.
The canonical official contract validator returned `ok: true, errors: []`.
Its bytes match serialization of the actual stored official result; review
marks left that result unchanged. Uninstall retained the same export hash.

MEASURED: after suspending scanner PID 3304 (with verified owner, parent and
creation time), cancellation reached terminal state in **10.611 s**, exercising
the host's existing ten-second cancellation backstop and Job cleanup. Seven
owned processes, including the scanner, console and browser descendants,
were absent afterward. OCR uses worker threads inside the scanner PID.
No outer watchdog or observer killed those processes. The host and its
WebView2 processes remained alive until normal window close; their tracked
PID-plus-creation identities were then all absent. A fresh scan in the same
host completed in **7.298 s**, with two checked pages and one official finding.

The suspended session never finalized a validated result bundle, so its
terminal state was `cancelled`, `hasResult: false`, with a missing-partial-result
error; the UI returned to setup. The two earlier valid sessions remained
available unchanged. This does not claim retention of an unfinalized bundle.
The initial observer incorrectly expected a separate restart button after
that automatic return. `native.initial.json` preserves that harness error;
the supplement in `native.json` exercises only the missing retention/restart
checks. VM console input recovery and a restarted evidence receiver affected
the harness, without resetting the host or modifying installed resources.

## Limits and user actions

- OBSERVED build lane: Rust 1.98.1, `x86_64-pc-windows-gnullvm`, LLVM MinGW
  UCRT clang 23.1.1, Tauri CLI 2.12.0, NSIS 3.09. GNU LLVM Windows execution
  is not MSVC link acceptance. INFERRED from the inspected requirements:
  current KODEX, GOAL and product requirements
  require Windows execution/distribution, not a specific compiler. Earlier
  SDK-gated MSVC notes describe an unverified historical lane; separate MSVC
  execution is NOT_RUN. No toolchain migration was made.
- The installer is unsigned. Its current-user install was observed; Unicode
  account paths and absent-WebView2 provisioning were NOT_RUN.
- WebView2 uses `downloadBootstrapper` and may require network when absent.
  Offline installation is NOT_RUN. Bundled Korean/English CPU OCR operates
  on selected images with the accepted limits: 8 pages, 8 candidates/document,
  250,000 bytes/page, 6 distinct OCR images, 10,000 elements/document.
  Full image coverage is not promised; learned VLM remains disabled.
- Official and extra results remain separate. Review marks are temporary,
  non-authoritative UI memory and do not alter official exports.
- The fixed 1,650 s supervisor exhaustion path was NOT_RUN separately; Gate C
  exercises the real cancellation backstop/Job cleanup permitted by this gate.
  The unchanged 200-page C1–C4 benchmark and broad product audits were not repeated.
- The user reviews the private artifact and Draft PR, decides any signing or
  further platform acceptance requirements, and performs final submission or
  release approval. No merge, release publication, submission or visibility
  change has been performed.
