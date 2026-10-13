# Product dogfood ledger - 2026-10-14

Status: IN_PROGRESS. This is autonomous operator simulation, not an NIA
staff usability study. The sprint completion criteria are not yet met.

## Scope and provenance

- Task source: user-attached `KRDS_DOGFOOD_SPRINT_20261013.md`.
- OBSERVED: local and remote `dev/bootstrap` HEAD both
  `c7d3c841b01bdb07edeae0b37f09accc23de410e`; initially clean canonical tree
  `/home/monad/develop/illegal_ad`, one worktree, no submodules.
- OBSERVED: Windows installed source
  `565d9f6e49f857c6a0a9aaf2ab3b829452584e1e`, build
  `0.2.1-x86_64-pc-windows-msvc-d33dc9f7c097-20261009T185838006Z`.
- OBSERVED: installed EXE SHA-256
  `7b6fc529fc679974aca2a603dd7de616ba89947fea64945e5c71fc9cc467fbba`.
- Native access: existing `ssh win` and Cua Driver 0.30.1, background actions.
  The unrelated local `clean11` VM has no configured QEMU guest agent.
- Preserve historical candidates, official results, existing cases and exports.
  Only newly created synthetic dogfood cases may receive review edits.
- No push, PR update, deployment, installer change, merge or submission.

## Task outcomes

| ID | Role / task | Evidence class | Expected / observed | Remaining check |
| --- | --- | --- | --- | --- |
| D01 | Novice / URL to automatic scan | OBSERVED_NATIVE, partial | Entered controlled loopback URL and invoked scan start without opening settings. Actual installed worker finished in displayed 3 seconds. Default scope text exposed 200 pages / 25 minutes. | Progress-stage screenshot and novice comprehension remain unassessed. |
| D02 | Reviewer / partial coverage | OBSERVED_NATIVE | Controlled page with hidden and homoglyph offers plus one 404 produced 2 official findings, 1 checked page and 1 failed page. Result explicitly distinguished partial failure and automatic detection from a confirmed violation. | Exercise failed-page destination. |
| D03 | Reviewer / 617 records | OBSERVED_NATIVE_IMPORT_AND_UI; OBSERVED_BROWSER_IPC_REPLAY | Native import displayed 617 records / 211 pages / 19 groups. Twenty-case discovery confirmed DF01. Separately, browser at 1366x768 and 17px body text: third complete row ended at y=748.25; search, grouping and keyboard return exercised. | Exact native CSS viewport remains unmeasured. |
| D04 | Reviewer / twenty consecutive items | OBSERVED_NATIVE; OBSERVED_BROWSER_IPC_REPLAY | In each environment, individually opened/moved through 20 records, wrote distinct synthetic notes, cycled suspected / judged-normal / needs-more-evidence, and marked read. Native file readback retained all 20 notes, all read marks and all three judgment values. New-process reopen restored the first memo; all review bytes retained their hash. | Human interpretation and completion time are not assessed. |
| D05 | Reviewer / edit, close, restart | OBSERVED_NATIVE, partial | Newly created case `700810b0-8ec0-455b-be13-b903bdeaa6dc`: memo persisted, normal Close followed by a new process and reopen restored the final memo at revision 2. | The sub-300ms exit boundary is UNVERIFIED. Timed automation took 187.70ms for the intervening snapshot and 5956.66ms for the Close call; its response timing does not establish when destruction happened. No native data-loss defect confirmed. |
| D06 | Reviewer / graph to source and return | OBSERVED_NATIVE, partial | Real persisted graph: Enter selected CONTAINS relation 4, source action opened f2, result-list action returned to the results. No destination advertisement was visited. | Capture final source identity / focus-return state; verify list alternative. |
| D08 | Administrator / two public targets | NOT_RUN | Exact permitted public URLs requested asynchronously. | Await target selection; then native batch, review, restart and integrated report. |
| D10 | Administrator / delivery and Excel | OBSERVED_NATIVE_EXPORT_AND_EXCEL | Native JSON/XLSX/Case exports; official bytes identical, workbook 617 rows / twenty notes / zero formulas; actual Excel summary and review-sheet observation, workbook hash preserved. | General Excel compatibility and human readability acceptance are not claimed. |

OBSERVED_NATIVE D04 follow-up: completed twenty consecutive records in the
installed inspector, individually entered synthetic notes, changed judgments,
marked read and moved to the next record. Readback of native `review.json`
retained twenty records, twenty read marks and all three requested judgments.
`artifacts/dogfood-20261014/native-twenty-readback.json` contains the receipt.
An initial orchestration attempt inspected during an asynchronous transition;
the probe stopped after one record and resumed only after a fresh snapshot.
No duplicate write or product workaround was introduced.

D05 fast-close follow-up: the background Alt+F4 attempt was refused with
`background_unavailable`, target class `Tauri Window`, event kind `key_combo`.
The process remained alive and the sentinel subsequently saved. This is NOT
a successful close test. Foreground delivery approval was requested; no
foreground action or permission change has been performed.

OBSERVED_NATIVE D10 follow-up: installed Save As exported a 40,847-byte XLSX
with 617 official rows, twenty distinct native review memos and zero formula
cells. Actual Microsoft Excel opened it without an observed repair warning;
Korean summary, header/filter controls, reviewed state and synthetic memos
rendered. Excel was closed without saving; the workbook hash remained
`c2bdb0bd42687bca62f74f652a76697cc54bb87ec1915cbc2363258e76371414`.
The native JSON export was 166,609 bytes and exactly matched the imported
official bytes, SHA-256
`801c68f54a7da2bb0ffd8dfd542f4c035b8e93ab78bb6e924eaf905d7fdd41fc`.
Receipts: `native-workbook-validation.json` and `native-json-validation.json`
under the curated evidence folder. Actual native portable Case export also
completed: manifest, official result and review each matched source bytes;
`native-case-delivery-validation.json`. The task-owned loopback fixture was
then stopped, so subsequent reopen checks cannot depend on its availability.
Private Excel screenshots contain a local path and are excluded from the
curated evidence folder. No workbook was uploaded or shared externally.

## Issue ledger

No native P0/P1 issue has yet been confirmed in the exercised paths. This is not a
claim that the remaining paths are free of defects. Source hypotheses remain
separate from observations:

- H01: BatchWorkspace warning says notes remain in the current screen. Durable
  case persistence and report fallback exist in source. Verify the current
  native batch before changing the warning.
- H02: review writer debounces for 300ms and no close flush/guard was found in
  source. The executed native Close preserved the note; fast-close loss remains
  a hypothesis, not an observed native bug. OBSERVED_BROWSER_IPC_REPLAY:
  filling a sentinel and immediately reloading the built UI reopened an empty
  note and revision 0. This demonstrates pending edits lost on renderer reload
  in the replay, not a measured Windows destruction boundary. Receipt:
  `artifacts/dogfood-20261014/browser-fast-reload-observed.json`.
- H03: saved cases are below scan setup. At the first smaller native frame,
  scan start and saved cases required scrolling, but OS scaling means that
  physical 1382x815 frame is not a 1366x768 CSS viewport. Do not report it as
  the required viewport measurement. Follow-up with twenty actual native
  cases confirmed P2 DF01 below.

### DF01 - saved-case discovery requires scrolling through scan setup and unrelated cases

- Role: administrator reopening the oldest retained 617-record case.
- OBSERVED_NATIVE: twenty cases (fourteen preserved historical, two dogfood,
  four explicitly synthetic empty navigation fixtures). First reopen control
  was below the initial visible screen; six PageDown commands reached the
  oldest case. Native frame: 2104x1559 physical pixels. Screenshot verified the
  final visible control independently of stale UIA frame geometry; the probe
  stopped on that discrepancy rather than misreporting it as a product error.
- Expected: a direct route to retained work and a way to find the desired
  case without paging through unrelated cards.
- Impact: P2, avoidable navigation. No official data or engine defect.
- Minimal local fix: desktop start-screen anchor to the saved-case search;
  address/date/case-number filter before the existing twenty-item pagination,
  with empty-result count and reset. Reuses the review text normalization.
  Existing reopen/export/delete behavior, schema and scan contracts retained.
- Files: `apps/web/src/App.tsx`, `screens/ScanStart.tsx`,
  `screens/SavedCases.tsx` under `apps/web/src/`.
- Regression: `apps/web/test/saved-cases.test.tsx` first failed because the
  accessible searchbox did not exist, then passed. It finds record 22 by
  address, date and case ID, checks no-match and restores the first twenty
  cases on reset; it does not merely assert host forwarding.
- OBSERVED_BROWSER_IPC_REPLAY before: at 1366x768, first reopen button bottom
  1016.70px and oldest bottom 4690.83px. After: keyboard Enter on the shortcut
  focused search; the filtered oldest reopen control bottom was 717.27px,
  inside the viewport, and keyboard Enter opened it. At 320px, no horizontal
  overflow and the same keyboard/search route completed. These figures are
  browser measurements and must not be substituted for native scroll counts.
- Evidence: `saved-cases-before-start-1366.png`,
  `saved-cases-after-filtered-1366.png`, `saved-cases-after-filtered-320.png`
  and matching observed JSON under `artifacts/dogfood-20261014/`.
- OBSERVED: web typecheck, scoped ESLint, all 109 web tests in nineteen files,
  production web build, navigation DOM/keyboard smoke, and changed-built-UI
  617-record smoke passed. The latter retained three visible rows, official
  canonical bytes, workbook notes and zero formula cells, zero remote
  requests and zero page errors.
- NOT_RUN: updated native candidate. Installed Windows remains the original
  identified 565 build; no binary rebuild, installer or publication occurred.
  This local UI fix is not claimed to be installed/native-verified.

Read-only scoped review found no actionable issue; this is STATIC_REVIEW /
INFERRED evidence only, not an independent runtime verification.

## Evidence locations and execution limits

Local private working evidence (not suitable for external sharing without
redaction): `/tmp/nia-dogfood-*.json` and Windows `NIAAdoption/dogfood-*.png`.
Native trees/screenshots can contain the local account path; do not publish them.

Curated receipts and the sanitized fixture screenshots are retained in
`artifacts/dogfood-20261014/`. OBSERVED_NATIVE preservation comparison:
all 123 historical persistent files in 14 cases retained their SHA-256;
`historical-preservation.json`. Current candidate manifest SHA-256 remains
`dc216c083f2e7d803f49357c86af1c811406cadfd75d42cf80a68859a00fa69d`.

OBSERVED_NATIVE D03 follow-up: the actual installed folder picker imported a
new synthetic portable case wrapping the unchanged sanitized 617-record
official fixture. The installed UI displayed 617 records / 211 pages / 19
groups. The source fixture has no native detail/coverage files; none were
fabricated, and the native screen explicitly displayed unknown coverage.
This is real native import and review UI execution over a historical fixture,
not a new 617-finding scan. `native-provenance.json` identifies its case ID.
The native frame is 2104x1559 physical pixels; the exact CSS viewport remains
unmeasured. The 1366x768 measurement above is browser evidence only.

OBSERVED_NATIVE restart: host 46164 closed normally; new host 37688 reopened
the 617 fixture and displayed the first synthetic memo. All twenty review
records remained, official and review SHA-256 matched their pre-close export
hashes. Receipt: `native-restart-preservation.json`. The controlled scan
fixture had already stopped. This does not settle the sub-300ms close case.

Browser evidence: `/tmp/nia-dogfood-browser-20261014/`,
`/tmp/nia-dogfood-twenty-20261014/`, and
`/tmp/nia-dogfood-twenty-outcome.json`. Browser commands were:

```sh
npm run build -w apps/web
V21_EVIDENCE_DIR=/tmp/nia-dogfood-browser-20261014 node benchmarks/ui-v21-workspace-smoke.mjs
V21_EVIDENCE_DIR=/tmp/nia-dogfood-twenty-20261014 node /tmp/nia-dogfood-twenty.mjs
```

The twenty-item probe is throwaway orchestration of the existing production
UI replay; it changes no product code. Both browser runs returned exit 0,
zero remote requests and zero page errors. No full historical suite, repeated
installer matrix, benchmark C1-C4, human usability study or accessibility
technology acceptance was run.

## Continuation handoff

Goal remains ACTIVE / INCOMPLETE. The first sprint is not declared complete.
Current source changes are solely DF01 plus its regression and this ledger.
The native candidate is unchanged. Detector and Excel were closed normally;
the task-owned loopback fixture is stopped. Final preservation comparison
retained all 123 original files in fourteen historical cases. Twenty native
cases now exist; six are explicitly task-created synthetic dogfood fixtures.
`final-historical-preservation.json` records the final process/data state.

Pending user inputs already requested asynchronously (do not ask again):

1. Exact permitted public targets for D08, with example.org/example.com each
   one page offered. If approved targets produce no findings, record that
   limitation rather than inventing batch judgment/memo coverage.
2. Foreground delivery permission for the D05 immediate-close Alt+F4 probe.
   Background delivery was rejected; do not bypass or change driver policy.

Exact next actions:

1. Run `git status --short` and `git log -1 --oneline`; preserve the local DF01
   commit and any subsequent user work.
2. When foreground permission arrives, use the existing Cua MCP route through
   `ssh win`, launch the identified installed EXE, take a fresh exact-window
   snapshot, reopen only a task-created case, and rerun the timed edit/close
   probe in `/tmp/nia-dogfood-altf4-probe.py` with newly observed pid/window IDs
   and `delivery_mode: "foreground"` on only the approved Alt+F4 action.
   Capture edit-to-close timing and saved note readback; no forced termination.
3. When exact public targets are approved, create a fresh CSV for those targets
   only, use the native batch file picker, select one page/depth 0/60 seconds,
   and perform D08 through restart/report. Verify the stale-warning hypothesis
   against that actual flow before changing BatchWorkspace.
4. Use `artifacts/dogfood-20261014/SHA256SUMS` and this ledger for evidence.
   Private `/tmp`/Windows screenshots may contain account paths; do not publish
   them. Browser IPC replay is never native evidence. No remote push/PR update,
   installation, release, merge, signing or submission has been authorized.
