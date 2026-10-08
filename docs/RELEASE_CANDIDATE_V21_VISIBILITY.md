# Updated Product V2.1 user-review candidate

Candidate: `rc-v21-visibility-999c50c-20261008`.
Code commit: `999c50c35cac750f676f0d53181844faf7ffcf5c`, `dev/bootstrap`.
PR #2 remains Draft. This is separate from both the accepted V2.1 checkpoint
`rc-v21-105ce20-20261008` and historical `rc-5e44feb-20261008`.

Local directory:
`/home/monad/.codex/artifacts/illegal-ad/rc-v21-visibility-999c50c-20261008`.
Installer: `불법광고 탐지 도구_0.1.0_x64-setup.exe`, 149,652,131 bytes.
SHA-256: `e81be6b78599cc8e3f2ad736aa0ebfefcd8b7186d87b1c5ff5ed4b3da312f348`.
Unsigned Windows GNU LLVM candidate; no release or submission is authorized.

## Observed changed-path evidence

| Check | Actual result | Candidate evidence |
| --- | --- | --- |
| Supplied offline fixture, built Results UI | 617 official records / 211 affected pages / 19 unchanged groups. At 1366×768, search and three complete rows fit; third row ends at 752.25px. Existing 17px body size retained | `visibility/observed.json`, `visibility/workspace-1366x768.png` |
| Matching follow-up screenshot | At 1440×1000, `/game/baccarat` search shows 616 records / 211 pages / 18 groups with multiple complete rows in the first viewport | `visibility/followup-aggregate-and-ids.png` |
| Targeted interactions | Single-page controls hidden; one multi-page row; scoped review, f372 navigation, keyboard/focus return, narrow reflow, 200% CSS zoom; absent evidence has no retry and failed reads retain isolated recovery | `visibility/`, scoped web tests |
| Operational XLSX from fixture | All 617 records despite filters, 19 groups, original cells/codes/text/selectors retained, Korean technique names and scalar image coverage fields; safe strings, no formula or hyperlink cells | `visibility/report.xlsx`, `report-readback/` |
| Source verification | Nine focused files / 61 interaction and report tests passed; final absence-copy subset 26 passed. TypeScript, changed-file lint and production build passed | `docs/V21_RESULT_VISIBILITY.md` |
| Updated installed Windows 11 app | NSIS exit 0, ordinary user, bundled runtime, all 679 static payload hashes match this candidate | `environment.json`, `installed.json` |
| Remaining successful Windows batch | Real CSV preview/start on example.org and example.com, sequential production public-only transport, two independent successful native sessions; each checked 1 page, failed 0, findings 0. No fixture override or network-policy bypass | `public-batch.json`, `native-screens/batch-running.png` |
| Resulting native batch workbook | Actual native Save As saved seven sheets and two target rows; values match the two canonical sessions, Korean image coverage fields are readable, formula/hyperlink cells 0 | `xlsx.json`, `xlsx-export.xlsx`, `native-workbook-readback.json`, `native-screens/save-ready.png` |

The fixture UI uses explicit offline IPC replay, not native scanning. The
Windows positive batch uses actual public sites and actual installed commands;
its zero findings are not a positive-advertisement detection claim. The stored
official JSON and grouping algorithm were not changed by this follow-up.

## NOT_RUN and environment limits

Opening the resulting workbook in Microsoft Excel or LibreOffice is NOT_RUN.
The Linux host has no usable spreadsheet GUI/runtime or connected Excel
session. The Windows guest's read-only registry and file inventory found no
Excel/LibreOffice installation or `.xlsx` open handler; the Narrator Excel
support package is not a spreadsheet application. That preliminary inventory
was visible; its separate final JSON POST was not executed. No application was
installed to manufacture this check. Actual XLSX bytes were read with ExcelJS,
which is not a claim of real spreadsheet-application rendering.

Unchanged C1–C4 benchmarks and full historical acceptance were not repeated.
Human and assistive-technology review remain NOT_RUN. The historical RC and
accepted checkpoint directories were not changed. Review notes and batch
state remain local to the app session; save before exit.

Build method: offline Tauri release compilation with `--no-bundle`, followed by
the unchanged previously generated NSIS script against current binary/resources,
with installer output on tmpfs. Only an unused ignored GNU debug cache was
removed to provide build space; historical installers and evidence remain.
