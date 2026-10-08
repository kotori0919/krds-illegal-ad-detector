# Product V2.1 user-review candidate

Candidate: `rc-v21-105ce20-20261008`, built from
`105ce201e112fe2c33346103a4549c5d55c882d8` on `dev/bootstrap`.
Draft PR: <https://github.com/snowman0919/krds-illegal-ad-detector/pull/2>.

Local artifact directory:
`/home/monad/.codex/artifacts/illegal-ad/rc-v21-105ce20-20261008`.
Installer: `불법광고 탐지 도구_0.1.0_x64-setup.exe`, 149,627,858 bytes.
SHA-256: `c254d4a9f51039e9c9ee098e5c322ff8a463de39408757aeff81199e2ca473d7`.
The manifest hashes the installer and 679 static installed files; NSIS generates
its uninstaller at installation, so it is excluded from static payload hashes.

## Observed acceptance

| Actual execution | Observed result | Candidate evidence |
| --- | --- | --- |
| Integrated source checks | Typecheck, lint, build; 56 files / 336 tests pass; latest bundled worker native-session smoke passes; both GitHub verify jobs pass at candidate commit | `integrated-tests.log`, `current-worker-native.log` |
| Built offline Results UI, primary supplied fixture | 617 original records / 211 affected URLs / 19 conservative patterns; 197 occurrences and 197 pages shown separately; f372 navigation; keyboard, 360px, 200% CSS zoom, review scope and full XLSX; canonical JSON bytes unchanged | `offline-617/` |
| Independent automated operator exercise, visible controls only | Uninstructed f372/link/group/page/evidence/XLSX tasks completed; actual workbook has 617 detail rows and local memo. Follow-up confirms affected-page aggregate and distinct representative IDs | `operator-review/` |
| Two owned normal sites, actual canonical scanner and built batch UI | All four offline imports, peak one site, independent official JSON, seven-sheet aggregate, session-isolated notes, cancellation keeps first result; IPC/native export explicitly harnessed on Linux | `two-site-batch/` |
| Installed Windows 11, 4 vCPU / 8 GiB, ordinary unelevated user | NSIS exit 0; all 679 static files match; bundled runtime only, development PATH stripped | `environment.json`, `installed.json` |
| Installed ordinary single-URL scan | Two checked pages / one TRANSPARENT finding; original source text and exact `#ad` selector remain | `normal.json` |
| Actual Windows native XLSX Save As | Cancel preserves results; manual retry saves real six-sheet workbook; host read-back preserves official finding and coverage | `xlsx.json`, `xlsx-export.xlsx`, `native-screens/` |
| Actual Windows official JSON Save As and directory picker | Saved JSON equals original native session; independent normal/challenge outputs and coverage match their sessions; normal file SHA-256 matches standalone export | `json-save.json`, `json-export.json`, `folder-export.json` |
| Installed HTTP 200 challenge | Checked 0 / failed 1 / findings 0; typed non-retryable challenge; visible access-limit explanation | `challenge.json`, `native-screens/challenge-result.png` |
| Installed XLSX / CSV / JSONL / XML preview | Each valid 1 / invalid 0; no batch start during previews | `imports.json` |
| Installed public-only batch command | Two distinct native sessions from real batch UI; reserved nonexistent DNS names fail with ENOTFOUND, no result/coverage claimed. Existing completed state captured without retry | `public-batch.json`, `native-screens/batch-error-observed.png` |

The original official contract, TOPIC, four technique enums, single-entry
evaluation and raw evidence are preserved. The owned ordinary-comment/menu
regressions now pass while concealed offers and fragmented advertising remain
positive. The external sanitized sample is not reclassified without its DOM.

## Boundaries and reproducibility

This is an unsigned GNU LLVM Windows candidate. Tauri release compilation
succeeded. Disk exhaustion stopped automatic NSIS bundling; the **unchanged
Tauri-generated NSIS script** was then successfully compiled with output on
tmpfs. Only regenerable project debug build caches were removed for disk space;
source, historical RC and saved evidence were preserved.

Two disposable Windows observer defects were observed and corrected: a function
passed to `getByText` became a literal selector and timed out; an initial React
root fiber read missed the completed state. Initial/fixed harnesses and failure
evidence are preserved in `evidence/harness/` and `failure.json`. The app was
neither rebuilt nor relaunched for observer recovery, and the completed batch
was captured without starting or retrying another scan. These failed harness
attempts are not counted as passing checks.

Windows successful two-site public scanning is NOT_RUN: no owned public test
origin was available. The successful owned two-site smoke is explicitly Linux;
Windows separately proves native batch launch and independent startup failures.
Native directory export uses actual registered IPC with two standalone sessions,
not a claim of a Windows successful two-site batch. Actual XLSX files were read
with ExcelJS, not Microsoft Excel. Human participant and assistive-technology
evaluation are NOT_RUN; automated visible-UI evidence is identified as such.
Review notes and batch state are local to this app session; save before exit.

The historical `rc-5e44feb-20261008` remains separate. Its installer SHA-256 is
`354809d19ee8a7beaf9271cf7ba7de832f7c75d4828553088c3fa6b53aa1cc4e`;
manifest SHA-256 is
`c04a18bad998f77d83fbd2705016837accb1c4eca6652686d866ba5a187fd32b`.
Final equality verification and normal-close observations are recorded in the
candidate's `acceptance.json`.

Before the October 22 freeze / October 23 18:00 KST submission: user review,
human/assistive-technology validation, and explicit release/submission approval
remain. Draft stays Draft; this record does not authorize publication or submission.
