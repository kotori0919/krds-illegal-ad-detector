# Product dogfood ledger - 2026-10-14

Status: SOURCE_IMPLEMENTED_REVIEWED; BLOCKED_NATIVE_VERIFICATION.
Current local source is56fd3563e031ef1850e88b4fdac0c39ead08eea5. App-scoped
WARP source and packaging correction are implemented and reviewed; the latest
Windows package and end-to-end acceptance have not run. Pocket4 remains offline.
Standalone tunnel efficacy with official WARP disconnected and a live finding
are historical observations described below. This is autonomous operator
simulation, not an NIA staff usability study. Sprint completion criteria are
not yet met.

## Scope and provenance

- 2026-10-14: user explicitly approved the detailed app-scoped WARP design
  and requested implementation planning. Plan saved to
  `docs/superpowers/plans/2026-10-14-app-warp-transport.md`; implementation
  was not started at that point. User subsequently approved the plan and chose
  task-by-task implementation/review agents. Tasks1-4 source implementations
  and Task5 source/fixture checks are complete; cross-task native acceptance
  remains pending.

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
  Only task-created dogfood cases may receive explicitly synthetic review edits.
- No push, PR update, deployment, installation/removal, merge or submission.

## Task outcomes

| ID | Role / task | Evidence class | Expected / observed | Remaining check |
| --- | --- | --- | --- | --- |
| D01 | Novice / URL to automatic scan | OBSERVED_NATIVE, partial | Entered controlled loopback URL and invoked scan start without opening settings. Actual installed worker finished in displayed 3 seconds. Default scope text exposed 200 pages / 25 minutes. | Progress-stage screenshot and novice comprehension remain unassessed. |
| D02 | Reviewer / partial coverage | OBSERVED_NATIVE | Controlled page with hidden and homoglyph offers plus one 404 produced 2 official findings, 1 checked page and 1 failed page. Result explicitly distinguished partial failure and automatic detection from a confirmed violation. The failed-page control opened the actual /missing URL and HTTP 404 coverage record. | Human interpretation remains unassessed. |
| D03 | Reviewer / 617 records | OBSERVED_NATIVE_IMPORT_AND_UI; OBSERVED_BROWSER_IPC_REPLAY | Native import displayed 617 records / 211 pages / 19 groups. Twenty-case discovery confirmed DF01. Separately, browser at 1366x768 and 17px body text: third complete row ended at y=748.25; search, grouping and keyboard return exercised. | Exact native CSS viewport remains unmeasured. |
| D04 | Reviewer / twenty consecutive items | OBSERVED_NATIVE; OBSERVED_BROWSER_IPC_REPLAY | In each environment, individually opened/moved through 20 records, wrote distinct synthetic notes, cycled suspected / judged-normal / needs-more-evidence, and marked read. Native file readback retained all 20 notes, all read marks and all three judgment values. New-process reopen restored the first memo; all review bytes retained their hash. | Human interpretation and completion time are not assessed. |
| D05 | Reviewer / edit, close, restart | OBSERVED_NATIVE_INSTALLED_BEFORE_AND_SOURCE_CANDIDATE_AFTER | Installed565 lost a UIA-confirmed memo on foreground Alt+F4 at276.25ms. Fixed e833 candidate closed at218.54ms, retained revision4/final memo, and a new process reopened it. Official bytes unchanged. | Fixed source candidate was exercised directly; installed565 was preserved and still has the old behavior. Forced kill/OS shutdown is outside this normal-close check. |
| D06 | Reviewer / graph to source and return | OBSERVED_NATIVE, partial | Real persisted graph: Enter selected CONTAINS relation 4, source action opened f2, result-list action returned to the results. Follow-up expanded the list alternative, used Enter to select f2/open its fullwidth source text, and Enter to return. No advertisement destination was visited. | Native DOM focus-return remains unverified; UIA does not expose activeElement. Browser focus-return smoke passed separately. |
| D08 | Administrator / two public targets | OBSERVED_NATIVE_INSTALLED_565, partial | Two public-target batches produced independent persisted cases and integrated XLSX. A later BlackToon batch-origin case has1 official finding; its synthetic memo, needs-more-evidence judgment and read mark survived normal close/new-process reopen and were present in the native XLSX exported after restart. | The finding-bearing case was a one-target batch. The complete two-target integrated report containing saved judgments after restart remains NOT_RUN; batch grouping restoration is not claimed. |
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
foreground action had been performed at that earlier stage. See the approved continuation below for the subsequent authorized probe.

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

DF02 confirms native P1 pending-memo loss on installed565 normal close; the
fixed source candidate passes the same boundary. No P0 was observed in the
exercised paths. This is not a claim about unexercised paths. The earlier
hypotheses below are historical and are superseded by the approved continuation:

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
- Follow-up OBSERVED_BROWSER_IPC_REPLAY: the changed search also completed
  keyboard jump/filter/reset at683px and CSS200% zoom, with no horizontal
  overflow; reset retained input focus and Enter reopened the filtered case
  at200%. `saved-cases-reflow-observed.json` and its two images record this
  browser-only D11 impact check; native window zoom is not claimed.
- OBSERVED: web typecheck, scoped ESLint, all 109 web tests in nineteen files,
  production web build, navigation DOM/keyboard smoke, and changed-built-UI
  617-record smoke passed. The latter retained three visible rows, official
  canonical bytes, workbook notes and zero formula cells, zero remote
  requests and zero page errors.
- At the first local fix: updated native candidate was NOT_RUN. The follow-up
  below identifies the subsequently built and executed native candidate.
  The original installed565 remains unchanged; no installation or publication
  has occurred.

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

## Native follow-up for the local fix

OBSERVED: clean existing Windows receiving source fast-forwarded from565 to
`bc4d11f8548ff390c80c5e5652289e5a16b0117d` using a local git bundle, without a
remote push, new clone, dependency installation or topology change. One
canonical `npm run package:windows` and Windows/local `verify:artifact` each
returned exit0. Seven prior Windows candidate directories retained every
top-level file hash; seven local historical manifest hashes also remained.

| New internal candidate | Value |
| --- | --- |
| build ID | `0.2.1-x86_64-pc-windows-msvc-e0b518754aaf-20261013T165637491Z` |
| source SHA-256 | `e0b518754aaf63e0f13bc2626b653fd6566d39c5a0ee21256bdb82cfb4c17ef7` |
| manifest SHA-256 | `c73eeaf6abb574aea503d6eadd27719ea9a1b72372298d32b45628d41220577e` |
| standalone/direct release EXE SHA-256 | `eb86bfd2f70b87e722cae155b216d262a8cd41d3f9d69f90e7c0705887b8b65a` |
| installation / signing / publication | NOT_RUN; unsigned internal artifact only |

The direct release EXE and its adjacent build manifest matched the packaged
candidate. OBSERVED_NATIVE_RELEASE_UIA: Enter on the saved-case shortcut
changed the document hash to `#saved-case-search`; entering `sample.invalid`
rendered one reopen control; Enter reopened the617 result. A controlled
loopback scan then exposed real progress and completion and saved a new case
with this source build, two findings, one checked page and one HTTP404 failure.
This was a new bounded scan, not a repeated historical benchmark. With21
cases, the retained617 case was outside the first twenty rendered cards;
search found it and keyboard Enter reopened it. Original installed565 and
all123 files in fourteen historical cases retained their hashes afterward.

Native screen-capture limitation: a post-shortcut `get_window_state` capture
request stopped returning. The live window was independently enumerated and
fresh UIA-only snapshots returned its actual hash, search value, filtered
control and reopened result. The app was not restarted to hide that failure.
The pending capture is not evidence of a completed screenshot or an app defect.
After normal app closure, the task-owned capture client was cancelled and
closed; the global driver service and its policy were not changed.
Existing browser before/after screenshots remain separate. UIA-only native
observations do not prove DOM focus, exact CSS viewport or visual rendering.

Receipts in `artifacts/dogfood-20261014/`: `native-D02-followup.json`,
`native-D06-followup.json`, `native-bc4d11f-build-summary.json`,
`native-bc4d11f-release-identity.json`, `native-bc4d11f-search-observed.json`,
`native-bc4d11f-progress-scan.json`, `native-bc4d11f-progress-labels.json`,
`native-bc4d11f-search-boundary.json`, and
`native-bc4d11f-final-preservation.json`. The617 case's manifest, official and
twenty-record review bytes also matched their pre-build exported hashes;
`native-bc4d11f-retained-review-preservation.json`. The candidate is retained separately
under `artifacts/candidate-0.2.1-x86_64-pc-windows-msvc-e0b518754aaf-20261013T165637491Z/`.

## Historical blocked handoff (superseded by approved continuation)

Goal is BLOCKED / INCOMPLETE pending the two user inputs below. The first sprint is not declared complete.
Current source changes are solely DF01 plus its regression and this ledger.
Original installed565 is unchanged. A separate bc4 native candidate was
built and exercised as described above, without installation. Detector and
Excel closed normally; both task-owned loopback fixtures are stopped. Final
preservation retained all123 files in fourteen historical cases. Twenty-one
native cases now exist; seven are explicitly task-created synthetic dogfood
fixtures/results. `native-bc4d11f-final-preservation.json` records the latest
process/data state. Receiving source remains clean bc4; later ledger commits
must not be represented as the binary source or trigger another build.

Pending user inputs already requested asynchronously (do not ask again):

1. Exact permitted public targets for D08, with example.org/example.com each
   one page offered. If approved targets produce no findings, record that
   limitation rather than inventing batch judgment/memo coverage.
2. Foreground delivery permission for the D05 immediate-close Alt+F4 probe.
   Background delivery was rejected; do not bypass or change driver policy.

Blocked audit: these same missing inputs remained at the end of the original
goal turn, the native follow-up turn, and the next revalidation turn. Safe
independent work was completed before blocking. Fresh revalidation found
local HEAD fed3375 clean, Windows receiving HEAD bc4 clean, no running detector,
and no completed delayed capture file. No build, scan or capture process is
being treated as a live wait. The retained receipts still prove the observed
native search boundary and historical preservation, but do not prove D05 or
D08 completion. No additional scan, rebuild or unchanged-test repetition can
supply the missing user authorization. Resume on the user's answers; retain
the exact viewport/focus/capture limitations rather than declaring them passed.

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

## Approved continuation - 2026-10-14

The user explicitly approved both pending requests: foreground D05 Alt+F4
and D08 example.org/example.com, one page each. The prior blocked audit is
historical; its missing authorizations are now resolved.

OBSERVED_NATIVE D05: installed565 reopened the previous revision2 memo. An
initial foreground close returned within239.43ms but input readback was not
confirmed, so that attempt alone does not prove loss. A subsequent verified
memo survived a slower3026.31ms close at revision3. The final probe read the
new `D05 VERIFIED FAST 2` suffix in UIA224-228ms after edit, then foreground
Alt+F4 returned at276.25ms. The window disappeared and disk review remained
revision3 without that suffix. This confirms P1 DF02: visible pending memo
lost on immediate normal application close. Official data was not edited.
Receipts: `native-D05-approved-before.json`, `native-D05-approved-fast2.json`;
raw Cua logs remain private in /tmp.

DF02 correction in progress: the native HostBridge registers the Tauri close
request handler; it awaits the existing per-case serialized writer for all
pending edits and in-flight successor writes. A save conflict/error retains
the window and the unsaved record. Window destroy is allowed only through
the native window API after that handler succeeds. Three regression cases
cover immediate debounce, in-flight successor and conflict retention. RED
observed missing prepareClose; GREEN7 writer tests, web typecheck/scoped lint,
production build and existing617 built-UI IPC replay (zero errors/remote
requests, official canonical unchanged, workbook617 rows/note/formula0).
Native fixed-candidate verification is still pending; no fix success claim.

D08 started on installed565 using the native file picker and a fresh CSV
containing exactly https://example.org/ and https://example.com/. Preview
accepted2/error0/duplicate0; UIA confirmed entry-only1page/depth0/60seconds
selected before start. Results, restart and report are still pending.

## DF02 native after-check and current handoff

OBSERVED_NATIVE_FIXED_SOURCE_CANDIDATE: build
`0.2.1-x86_64-pc-windows-msvc-1213f2cbd294-20261013T222947184Z`, source
`e8336ddeea2f7c84d746ecbd9f18f8cca766573e`, source digest
`1213f2cbd294b36feeb6db3d931bca86ea2f6cdce127ac874ae0f3dd828f09bc`.
The existing clean Windows receiving tree fast-forwarded from bc4 through a
local git bundle; no network remote was pushed. One canonical package build
and Windows artifact verifier exited0, preserving all eight earlier Windows
candidate top-level payload/manifest hashes. An initial bundle-path mismatch
failed before source mutation/build; the exact path was corrected. A Cua
session-expired launch was refused without launching; a fresh connection
then launched the exact new release EXE. No global driver policy changed.

Release EXE and packaged EXE hashes both
`d668214252f33a897bff5418f6ca9024ce59cadadb541a1934ecf24a311603b1`;
manifest hash `bbb549f51ad3f1beffcff4b38d762e14e7e9adff01f9ffd165cbc3e45429fe0f`.
This was a direct source-candidate run, not installation or upgraded-installed
acceptance. Original installed565 remains byte-identical.

MEASURED native after: UIA saw the final suffix171.27ms after edit;
foreground Alt+F4 returned218.54ms after edit. Disk retained final suffix and
revision4; the old process exited. A new process reopened the same final
memo and then closed normally. Official result hash stayed
`75eef9e6761126f0cfcc45bad8ab631d8ff2fc8944b70ca57d52e039c14ddf21`.
Receipts: `native-D05-fixed-close.json`, `native-D05-fixed-disk-readback.json`,
`native-D05-fixed-restart.json`, `native-close-fix-release-identity.json`,
`native-close-fix-build-report.json`. Native before loss receipt:
`native-D05-loss-receipt.json`. Cua command/observation logs are private in /tmp.

OBSERVED regression/impact: seven writer transaction tests pass, including
three new consumer-visible close cases (immediate debounce, in-flight newer
edit and conflict retention). All nineteen web test files passed before the
last direct-debounce case was added (111 tests); the final writer file7/7
passed after it was added. Root typecheck, scoped ESLint, production web build
and the built617 DOM/keyboard/export replay passed. Replay stayed network-free,
with zero page errors, canonical official bytes unchanged, and617 workbook
rows/retained memo/zero formulas. It remains browser replay evidence.
INFERRED independent read-only review found no actionable code issue;
it did not execute native close or failure injection. Native error/conflict
close retention has unit transaction evidence only, not failure-injection smoke.

OBSERVED D08: installed565 CSV preview2/0/0, entry-only scope confirmed before
start; public worker produced two distinct durable cases:
`01343cf9-e98e-4bf6-b3ea-dff241c0b23d` (example.org) and
`e6f553aa-3df4-48cd-825f-c015843fe191` (example.com). Each checked1/failed0,
HTTP200, zero official findings. The native integrated workbook SHA256 is
`384bff3eaa3e34d2f2fdd072cbaf790d3b34cd0e47a0800880cb64f3988fbb7d`;
seven sheets, both targets, zero review rows and zero formulas. The workbook
was exported BEFORE restart; both cases then reopened in a new installed
process with revision0 and no findings. Do not claim batch group restoration
or integrated report export after restart. The workbook contains local paths
and is kept privately; only sanitized receipts are curated. Receipts:
`native-D08-public-sessions.json`, `native-D08-workbook-validation.json`,
`native-D08-restart.json`.

Current acceptance: DF01 and DF02 implementation/changed-path verification
are complete. The Sprint remains INCOMPLETE: D08 has no actual finding to
exercise saved judgment/memo through native batch/restart/report. The user
has been asked for an additional target/fixture choice; no additional public
scan or fake finding is authorized by silence. H01 batch-warning hypothesis
is still unverified on a native batch containing a reviewable finding; no
wording change was made. Exact native1366x768 CSS viewport and DOM focus
remain unmeasured; browser measurements never substitute for them. Human
usability is a separate later activity, not a success claim from automation.

Next action: on a qualifying explicitly permitted public target, continue
D08 through actual judgment/memo, normal restart, retained review and report;
if a local/replay supplement is chosen, label it separately and retain the
native public-batch limitation. Do not rebuild for ledger-only changes. No
push, PR update, shared-branch merge, installation, signing or publication.

Final OBSERVED preservation: all123 files in fourteen historical cases stayed
byte-identical, the retained617 case manifest/result/twenty-record review
hashes stayed identical, both public case official hashes stayed identical,
and the installed EXE hash stayed identical. There are23 cases, including
nine task-created cases. No detector process remained after the final normal
close. `native-approved-final-preservation.json` records this final readback.

Resumed blocked audit: the approved-continuation turn completed DF02 and the
two public zero-finding cases, but ended awaiting a qualifying D08 target or
supplement choice. Two subsequent goal turns revalidated the same missing
input and clean local tree without receiving an answer. No live job is being
treated as a wait. The three-turn threshold is now met; the goal is BLOCKED,
not complete. A local/browser supplement cannot prove the public native batch
judgment path. Resume with the user's answer and preserve the remaining native
viewport/focus limitations recorded above.

## Broader public target discovery - pending scan approval

The user requested discovery around Nunu/Newtoki, then rejected the proposed
Newtoki/Manatoki pair as the same family and requested broader cross-checks.
Discovery is authorized; the pending scan approval was not granted. No native
scan, advertisement click, media opening, login or access bypass was performed.

Public web retrieval identified the following separate named candidate groups.
Different names/source domains do not establish independent ownership. Search
index freshness and a fetched document do not prove current native reachability
or the presence of an actual detector finding.

| Group | Exact candidate | Discovery / cross-check | Web-tool observation |
| --- | --- | --- | --- |
| TVWiki / streaming | https://tvwkwk1.tv/ | Root page, indexed search page, separate Anyflip references and BuiltWith listing | Root document retrieved259lines; no native reachability/finding claim |
| 11Toon2 / comics and animation | https://11toon2.com/ | Root page, https://ts.devbj.com/373 and separate domain-directory references | Root document retrieved664lines; no native reachability/finding claim |
| BlackToon / webtoon | https://blacktoon423.com/ and https://blacktoon424.com/ | https://t.me/s/blacktoonlink names423; ts.devbj.com/373 responses disagree between423/424 | 423 redirected to blacktoonadd.com; a later retrieval could not access that destination.424 retrieval failed. Retain conflict; do not invent a current number |
| Wolf / webtoon | https://wfwf513.com/ | ts.devbj.com/373, indexed older-domain notices and public @wftoon channel | Direct retrieval failed; not proof of Windows failure |
| Funbe / webtoon | https://funbe680.com/ | ts.devbj.com/373 and https://itset.co/funbe agree | Direct retrieval failed; not proof of Windows failure |
| Nunu-named / streaming | https://noonootvx8.store/ | https://tvindex.store/s/noonootv and root document | Initial document available; subsequent retrieval returned503. Source claims July21 update, not verified original Nunu ownership |

Other exclusions: TVWiki12 root initially returned a document but later503;
TVWiki43 returned403; Tkor067 exposed only a redirect placeholder. Common
TVindex x8.store brands were not counted as independent corroboration of one
another. The earlier newto23/mato23 proposal is superseded as a test pair.

PROPOSED first cross-category native pair: https://tvwkwk1.tv/ and
https://11toon2.com/, exactly one entry page/depth0/60seconds each. These have
retrievable root documents and different named content groups, but ownership,
current native access and findings remain unverified. Obtain exact-target
approval before the native batch; do not automatically follow changed domains
or substitute unapproved candidates. No build is needed for this ledger update.

## Approved cross-family native batch - 2026-10-14

The user explicitly approved the limited pair above. Fresh installed EXE
hash matched the original565 candidate. A fresh CSV contained exactly
https://tvwkwk1.tv/ and https://11toon2.com/. The native picker imported it,
entry-only1page/depth0/60seconds scope was selected and read back, then the
batch ran sequentially to two completed independent sessions without bypass,
login, advertisement clicks or media selection.

OBSERVED_NATIVE_INSTALLED_565: TVWiki case
`b3b48aa6-fe9f-4d50-bb79-10cee9d3ab05` finished in4.582seconds;
11Toon2 case `2bdb1661-d93e-48c3-a1d8-091a31e2430c` in3.787seconds.
Both checked1/failed0, HTTP200, final URL unchanged and zero official findings.
Both recorded `html-snapshot-truncated`. The native coverage tab explicitly
explained that this is partial omission of the archived HTML copy, not a
failure of live detection performed beforehand. Do not infer an engine
failure or a clean/safe site from these observations.

Native integrated XLSX was saved, SHA256
`fe4124580a6ad15708739f1df4a7e9a5054d32d99fb18f384a601424717015a3`.
Parsing confirmed seven sheets, both target/session identities, checked1/
failed0/findings0 for each, HTTP200 and archival truncation on both coverage
rows, zero formulas and zero review rows. The workbook contains local paths
and remains private. It was saved before normal close. A new installed
process reopened both saved cases with revision0 and the empty finding state,
then closed normally. Batch group restoration or integrated export after
restart is not claimed.

One restart probe initially passed the old HWND because a throwaway Python
default argument captured it; Cua refused the nonexistent window before an
action. The probe was corrected using the already-launched new process/window;
the app was not relaunched to hide that orchestration error. No product fix
was inferred from it. No source/binary change or rebuild was needed.

Final readback compared all160 files of23 preexisting cases: unchanged.
The installed EXE remained identical,25 cases now exist and no detector
process remained. Receipts: `native-D08-cross-family-sessions.json`,
`native-D08-cross-family-ui.json`, `native-D08-cross-family-workbook.json`,
`native-D08-cross-family-restart.json`, `native-D08-cross-family-preservation.json`.

D08 judgment/memo and saved-judgment integrated reporting remain NOT_RUN:
there was no actual finding in either approved public pair. Neither a fabricated
finding nor another site scan is silently substituted. All earlier viewport,
native DOM-focus and human-usability limitations remain as recorded above.

## Direct advertisement inspection and algorithm check - 2026-10-14

The user explicitly requested direct inspection of the proposed sites for
advertisements and review of the detection algorithm. This authorizes those
read-only page visits, not a code change or access bypass. Earlier discovery
proved address references/retrievable documents, not actual advertisement
presence; selecting them as finding-bearing candidates was unsupported.

OBSERVED_WINDOWS_BROWSER: the in-app browser was unavailable (no enabled
browser surfaces). Cua Driver prepared a separate owned isolated Chrome
profile on the existing Windows host; no personal profile was attached or
copied. An isolated-profile error notice was dismissed without enabling its
feedback checkbox. Exact PID/window binding was verified. Browser operations
initially refused an omitted explicit session; they succeeded with the same
session explicitly supplied. No driver approval policy was changed.

| Requested page | Direct observation | Advertisement conclusion |
| --- | --- | --- |
| blacktoon424.com | Chrome navigation failed with ERR_CONNECTION_RESET and showed the corresponding error page | Unknown; page not inspected successfully |
| wfwf513.com | ERR_CONNECTION_RESET with error page | Unknown |
| funbe680.com | ERR_CONNECTION_RESET with error page | Unknown |
| noonootvx8.store | Browser automatically redirected to noonootvx25.store; screenshots of top, middle and footer showed a programme catalogue | No gambling/loan offer observed in those sampled viewports; not proof of absence throughout the site |
| tvwkwk1.tv (previous scanned target) | Loaded top screenshot showed programme cards/navigation | No gambling/loan banner observed in the top viewport |
| 11toon2.com (previous scanned target) | Loaded top screenshot showed a Telegram banner and multiple broken image placeholders | Contents of failed images unknown; do not call them inspected advertisements or an ad-free result |

No advertisement or programme link was clicked, no media was opened, and no
VPN/DNS/security settings were changed. Native browser screenshots and the
sanitized `native-browser-ad-inspection.json` are under the evidence folder;
screenshots are from the isolated window with no personal account contents.
Initial one-node browser snapshots during navigation were not treated as
loaded-page proof; loaded semantic states and matching images were inspected.

INFERRED_FROM_SOURCE: installed565 and current source have identical runtime
files under packages/detection and packages/scanner (the only diff in those
trees is a cancellation test). Official DOM findings require the semantic
gate AND one of HOMOGLYPH/JAMO/TRANSPARENT/OFFSCREEN, not simply a visible ad.
See pipeline.ts:177,187,195-225. semantic.ts:12 defines supported terms and
semantic.ts:113 onward evaluates local offers/destinations/public context.

Image selection is separately restricted to visible marked-ad elements or
images linked to an external HTTP destination (creative.ts:51-99), at most8
candidates/document and6 distinct OCR images. A same-site/onclick-only image
without a marker can therefore be excluded; that is a source-derived coverage
limitation, not a reproduced miss on these pages. OCR alone is insufficient:
visual-decision.ts:6-25 also requires corroboration and no equivalent visible
DOM ad text. Matching image cases enter IMAGE_ONLY_ILLEGAL_AD in the extra
result, not one of the four official categories (scan.ts:399, extra.ts:50).

OBSERVED_PERSISTED_NATIVE_EVIDENCE: both earlier public cases recorded0 visual
candidates,0 acquired images,0 attempted OCR,0 image analysis records and0
extra findings. They did not attempt OCR and fail recognition; no missing
model/backend can be inferred from these counts. Archived HTML truncation is
separate from live visual candidate selection. Receipt:
`native-D08-visual-coverage-review.json`.

OBSERVED_VERIFICATION: targeted existing operator-rules and visual-decision
tests passed40/40 in two files. They exercise semantic precision, supported
obfuscation and image corroboration/visible-text/missing-OCR guards. They do
not prove recall on any live site's failed images. No product code changed.
The remaining D08 review/judgment path is still unexercised because no
qualifying live finding was observed. Repeatedly selecting sites by reputation
or treating official0 as no advertisements would not resolve that gap.

## User-authorized WARP and live BlackToon inspection - 2026-10-14

The user supplied a screenshot with casino/betting banners, confirmed the
same blacktoon424.com URL, and explicitly requested DNS/WARP reconfiguration
and continued inspection. This supersedes the earlier no-bypass scope for
this network configuration change. No advertisement destination was opened.

OBSERVED: default DNS, Cloudflare 1.1.1.1 and Google 8.8.8.8 all returned
104.21.49.181 and 172.67.165.134. The installed Cloudflare WARP client was
disconnected in Warp mode. Before connecting, HTTPS failed with a connection
reset. After connecting the existing client, status was Connected / healthy
and Cloudflare trace returned warp=on. A command-line HEAD request received
403, but the isolated native Chrome browser loaded the actual page and its
casino/betting banners. HEAD status alone therefore does not establish
browser accessibility. Adapter DNS addresses were not changed. WARP remains
connected for the continued investigation; no client installation, account
registration, terms acceptance or browser security setting change occurred.

OBSERVED_NATIVE_INSTALLED_565: a new bounded scan (1 page, depth0,60 seconds,
public-pinned) produced case cffaeb83-5d00-4090-80d8-1d8bf4c2a38d. The root
returned200; checked1, failed0, official1, extra0. The official OFFSCREEN
finding is hidden navigation text "보증토토", with ancestor display:none and
zero geometry. It is not a detection of the visible image banners. The
native result and finding detail were opened without editing review records.

OBSERVED_IMAGE_ANALYSIS:8 candidates were acquired;6 OCR operations completed,
0 attempted operations were unavailable, and2 further images were skipped
because of the OCR cap. Both candidate-limit and ocr-image-limit were reached.
Five completed OCR outputs had no supported ad semantics; their recorded
confidence was0.26-0.40. A sixth read "첫충70%" at confidence0.45 and passed
ad semantics, but scored2/3 because independent corroboration failed. An
external link alone does not satisfy that rule: the external-offer branch
also requires a supported category term, which its OCR output lacked.
Thus the actual image misses have evidence at OCR recognition, bounded
coverage and the corroboration gate; they are not absent advertisements or
an uninstalled OCR backend. These observations do not prove a sole cause,
site-wide recall, or that removing the gate would preserve precision.

Receipts: native-blacktoon-warp.png and native-blacktoon-warp-analysis.json
under the existing evidence directory. No detector code changed. The earlier
D08 finding-availability blocker is resolved; the two-target saved judgment,
memo/restart and integrated-report acceptance path still requires execution.

## Standalone MASQUE probe preparation - 2026-10-14

The user explicitly requested disabling official WARP and testing the
standalone tunnel method. OBSERVED: warp-cli disconnect succeeded, status
became Disconnected, and direct Cloudflare trace returned warp=off. A direct
GET of blacktoon424.com failed with curl35 / connection reset, HTTP000,
elapsed0.081397 seconds. The official client remains off as requested.

OBSERVED: upstream usque v4.2.1 Windows amd64 archive was downloaded into a
task-specific temporary probe directory and verified against the GitHub
release SHA256 f6f7f0a1a2bc9bcc15cf563ec1f892d00690a92c086b23ed3211b802209099e7.
The extracted portable EXE SHA256 is
122f2e40208e81bb814fcb4be4fbbbdc9246860f1f3784f72ae4512b97667e91.
Windows execution reported version4.2.1, commit
6aa03fc97d12848dce34eedbd187fb1077b5d1ea, and exposed HTTP proxy flags.
No service, driver, product dependency or OS network setting was installed.

NOT_RUN_PENDING_USER_CONSENT: the tunnel has not been registered or started.
Pinned upstream api/cloudflare.go Register explicitly requires acceptance of
https://www.cloudflare.com/application/terms/ before creating a WARP account;
cmd/register.go then enrolls a device key. This is an external account/terms
action under the user's engineering contract, requiring specific consent.
No accept-tos flag was supplied, no account was created, and no existing
official-client credentials were read or repurposed. Proxy/Playwright efficacy
remains unverified pending this registration step. Planned proxy binding is
loopback only, authenticated, with no insecure TLS/certificate options.

## Additional network methods with official WARP off - 2026-10-14

The user requested continued comparison of multiple methods. Registration
and terms acceptance have not received specific consent; no new account,
enrollment, or acceptance flag was used. Reachable independent probes were
completed instead of treating DNS changes as a proven tunnel substitute.

OBSERVED_WINDOWS: Cloudflare DoH at https://1.1.1.1/dns-query returned DNS
status0 and the same two IPv4 addresses. HTTPS GET with each address pinned
via curl --resolve retained the correct hostname/SNI and certificate checks;
both failed with curl35 / HTTP000. TLS maximum1.2 and1.3 comparisons also
failed with curl35. No certificate checks or browser isolation were disabled.

OBSERVED_PLAYWRIGHT: a throwaway Windows Node probe imported the canonical
scanner's compiled PublicNetworkPolicy and startPublicNetworkProxy, supplied
a Cloudflare DoH resolver, and launched the installed Playwright browser with
the existing authenticated loopback proxy and direct-DNS blocking arguments.
Public IP validation stayed enabled; no fixture/private-network exception was
used. Three DNS lookups returned4 addresses each, the selected upstream was
104.21.49.181, and root navigation failed with ERR_CONNECTION_CLOSED. Browser
and proxy were closed in finally. This is a real transport probe using the
scanner boundary, not a native app scan or a product implementation.

OBSERVED_CONTROL: Linux direct HTTPS also failed with curl35 / connection
reset. Official Windows WARP configuration field names were inspected locally
without printing values or exporting credentials. That configuration had no
directly usable private-key field for usque. No credential store extraction,
key reenrollment or alteration of the official registration was attempted.

INFERRED: the compared resolver and TLS-version changes do not resolve this
environment's observed failure. This does not identify a particular network
operator or prove a specific blocking mechanism. MASQUE and WireGuard tunnel
efficacy remain NOT_RUN because they require usable registered credentials.
Receipt: network-method-comparison.json. Product source remains unchanged.

## Saved public finding review and report after restart - 2026-10-14

Previous goal turn classification: progress. Direct network-method comparison
produced new evidence; no registration/terms action was authorized. The
remaining independently reachable task was review of the already persisted
BlackToon case, which needs no live site connection or WARP tunnel.

OBSERVED_NATIVE_INSTALLED_565: process15308 opened saved case
cffaeb83-5d00-4090-80d8-1d8bf4c2a38d. The official finding was inspected, a
clearly labeled synthetic DOGFOOD ONLY D08 memo was entered, judgment changed
to needs-more-evidence, and the finding marked reviewed. No enforcement
decision was made. ComboBox ValuePattern reported success without changing
the value; fresh UIA readback caught that no-op. Expand plus keyboard End
changed the actual value, which was verified before continuing.

Native persistence reached revision3 with one record. Process15308 closed
normally and was independently confirmed absent. New process53112 reopened
the case and its finding detail. Actual UIA readback showed the same memo,
needs-more-evidence judgment, reviewed state and revision3. The native Save
As flow then exported a new XLSX after restart; process53112 closed normally.
Receipt: native-D08-blacktoon-saved-review.json.

OBSERVED_NATIVE_EXPORTED_XLSX_XML: six sheets,1 finding row and1 review row;
synthetic memo, judgment, read mark and source case ID included;0 formulas.
Workbook SHA256:
c630519d0b673eddbc4e7c27690a9b237fa6f783b6e3cd031e399e931a6a190e.
Receipt: native-D08-blacktoon-workbook.json. This workbook was structurally
inspected; no new actual-Excel rendering claim is made. Earlier D10 actual
Excel evidence remains separate. The workbook contains a local storage path
and remains private, not a curated share artifact.

OBSERVED_PRESERVATION: all160 files in the pre-public-target baseline retained
their SHA256, missing0/changed0. BlackToon official JSON remained
7b5e98dbf94bc64e27bf4479aa4d602faa086fa352d0d52cea4eccebb97b996a;
review SHA256 before and after restart/export remained
c89ddbf6c5984b5e2b0d49f7e33477ec9fe0aaa7e37a01f8def482ccc2efdfa0.
No detector process remained running. No product code changed.

This closes the saved finding's note/judgment/read-mark restart and subsequent
single-case report gap. It does not replace the specified two-target batch
integration check. The complete D08 path, exact native viewport/focus evidence
and the separate standalone-tunnel probe remain incomplete as recorded above.

## Actual Excel and remaining-work audit - 2026-10-14

Previous goal turn classification: progress. Native saved-case review and
after-restart report export closed a real storage/export gap. This turn
completed the remaining independent actual-Excel check for that report.

OBSERVED_NATIVE_EXCEL: registry resolved the installed Excel executable and
there were0 existing Excel processes. Cua launched a separate process38496
with /x /r and the exact new workbook. The window title explicitly reported
read-only. The summary sheet exposed Korean headers, filters and saved review
revision3. The actual review sheet's D2 cell contained the synthetic memo.
Using the native name box to select G2 revealed its actual displayed judgment
"추가 근거 필요". No file repair prompt was observed during this bounded open
and sheet navigation. Excel closed normally; the owned process was confirmed
absent and workbook SHA256 remained
c630519d0b673eddbc4e7c27690a9b237fa6f783b6e3cd031e399e931a6a190e.
Screenshots/complete UIA contain Office account or storage-path information
and remain private; the curated receipt contains only the test observations.

Completion remains unproven. D01/D02 have native task observations; human
comprehension is not claimed. D03 has native import/navigation and separate
browser viewport proof; exact native CSS viewport remains unmeasured. D04 has
native20-record review and restart preservation. D05 has installed-before and
source-candidate-after normal-close evidence; the original installed binary
is intentionally unchanged. D06 has native graph/source/list navigation, but
native DOM focus remains unverified. D10 has actual Excel and preservation
evidence, including this new after-restart report. D08 still lacks the exact
two-target integrated workbook containing saved judgments after restart;
single-case proof is not promoted to that full requirement.

The independent reachable storage/export/Excel checks are now exercised.
Official WARP is confirmed disconnected. DoH, pinned-IP and TLS-version
comparisons failed; they do not supply the missing network route. Standalone
MASQUE/WireGuard still lacks registered credentials. The specific request
for one test registration and Cloudflare terms acceptance remains unanswered
across the multi-method user turn and two goal continuations. No acceptance,
new account, key extraction, existing enrollment mutation or new site scope
was inferred from automatic goal continuation. Mark goal blocked rather than
repeat unchanged attempts or claim the full Sprint complete.

## Authorized standalone WARP tunnel efficacy - 2026-10-14

The user explicitly answered "동의" to the specific one-test-device
registration and Cloudflare Application Terms acceptance request. This
authorizes that registration and the already proposed standalone transport
probe, not a product integration, package publication or additional accounts.
OBSERVED: usque v4.2.1 register completed with exit0 and created one new
configuration. The official client's existing enrollment was not modified.
Credentials remained on Windows; no private key, access token or proxy
password was printed, copied to Linux, or included in curated evidence.
Configuration ACL readback confirmed inheritance disabled and access limited
to the current user and SYSTEM. Official WARP remained Disconnected.

OBSERVED_WINDOWS_TRANSPORT: two modes of the same registered MASQUE identity
were tested sequentially with an authenticated127.0.0.1:19081 proxy:

| Mode | Proxied Cloudflare trace | Actual headless Playwright root navigation |
| --- | --- | --- |
| http-proxy | warp=on, curl exit0 | blacktoon424.com HTTP200, unchanged final URL, loaded casino/betting banners observed in screenshot |
| l4-http-proxy | warp=on, curl exit0 | blacktoon424.com HTTP200, unchanged final URL, loaded casino/betting banners observed in screenshot |

Both browser probes used the existing installed Playwright browser, Chromium
sandbox, direct-DNS/QUIC/non-proxied-WebRTC blocking launch arguments,
popup suppression, downloads disabled and no advertisement/media-link clicks.
Both recorded1066 image elements and1065 loaded images; these are document
image counts, not advertisement counts or recall measurements. Screenshot
viewing confirmed the visible casino/betting banner rows separately.
MEASURED: whole probe durations2803ms and2957ms, each including browser launch,
navigation, a fixed1500ms settle, capture and close. Single samples are not a
performance benchmark and do not establish one mode as faster.

OBSERVED_CONTROLS: an unauthenticated CONNECT received407. The listener was
bound only to127.0.0.1. After stopping the owned proxy, the same Playwright
configuration failed with ERR_PROXY_CONNECTION_FAILED instead of successfully
falling back to direct navigation. Final direct trace returned warp=off,
official client status remained Disconnected, usque process count0 and probe
listener absent. An initial proxy process was absent after its launching SSH
command exited; subsequent probes kept the owning SSH process live and then
explicitly stopped the exact owned child. This launch-lifetime correction
used the same registration, not another account or tunnel downgrade.

Scope: these are actual Windows headless browser transport probes, not native
detector scans. The existing production IP-pinning proxy was not chained to
usque in this spike; both result receipts explicitly say
productionPinnedProxyIntegrated=false. No product code changed, no detection
accuracy improvement or full D08 completion is claimed. Product integration
must retain the existing public-IP validation and pinned destination, manage
the sidecar lifetime, and verify failure behavior before native acceptance.

Receipts: standalone-usque-playwright.json,
standalone-usque-l4-playwright.json, standalone-usque-stopped-control.json,
standalone-usque-verification.json, blacktoon-usque.png and
blacktoon-usque-l4.png. Registration consent and standalone connectivity
blockers are resolved. App integration and the full D08 path remain pending.

## Integration boundary reconstruction - 2026-10-14

Previous goal turn classification: progress. Specific consent resolved the
registration gate and both standalone proxy modes loaded actual advertisements
with official WARP off. This continuation inspected the canonical integration
paths before proposing product changes.

OBSERVED_SOURCE: PublicNetworkPolicy.resolveTarget validates all DNS answers
and selects a numeric public address. Browser HTTP forwarding and HTTPS
CONNECT currently dial that validated address directly. Policy.fetch is a
third outbound path, used by sitemap.ts:140; changing only the Playwright
proxy would leave that path direct. All three paths must use the selected
transport while preserving Host/SNI, certificate validation and the pinned IP.
See public-network.ts:112-156,202,227 and crawl.ts:229-244,272.

OBSERVED_SOURCE: Tauri assigns the Node worker to the existing Windows
kill-on-close Job (session.rs:1080 onward). worker.ts already has cancellation
and finally cleanup. A tunnel child launched by that worker can use the
existing session ownership boundary; a shared app-wide tunnel would require
additional cross-session ownership and lifetime coordination.

PROPOSED_FOR_DESIGN_REVIEW: ship the verified usque binary as an inventoried
resource, start one authenticated loopback tunnel per public scan under the
worker, and route every validated outbound path through CONNECT to the exact
numeric address. Keep device registration separate and explicit; never ship
test credentials. Fail the scan on tunnel loss instead of silently falling
back. Preserve official result schema and record transport provenance in case
settings. Validate private-address/redirect rejection, upstream failure,
cancel/normal-close cleanup and native two-target batch review/report.

This is a new transport subsystem rather than the initially discussed simple
installed-client preflight. Product implementation has not started. The
brainstorming architectural path requires design review, then written-spec
review and an implementation plan before code; automatic goal continuation
does not approve those artifacts. No new consent for the already approved
test registration is requested.

## Design approval blocked audit - 2026-10-14

Previous goal turn classification: no progress. It revalidated that no owned
usque/detector process or probe listener remained, official WARP was off, and
the worktree still had only the task-authored ledger modification. It did not
complete another requirement and is not classified as a live-process wait.

The new integration-design approval condition has now persisted across three
consecutive goal turns: integration reconstruction/design presentation, state
revalidation with the same unanswered design question, and this continuation.
The user's latest direct consent authorized the specific test registration;
no subsequent direct message approved the proposed transport design. The
earlier registration gate is resolved and is not counted as this new gate.

No independent required execution remains reachable without product changes
or changing the selected test route. Per the applied brainstorming skill,
architectural design review must precede the written spec/plan and product
implementation. Do not write product code, treat automatic continuations as
approval, rerun unchanged probes, or mark the original Sprint complete.
Set the persistent goal to blocked pending that design review. All recorded
D08 integration and native viewport/focus limitations remain explicit.

## Approved direction and written transport specification - 2026-10-14

The user explicitly approved the proposed per-scan tunnel plus existing IP
validation design direction. The conversational design gate is resolved.
The detailed Korean specification is
docs/superpowers/specs/2026-10-14-app-warp-transport-design.md. It records all
three outbound paths, numeric-IP CONNECT with original Host/SNI and TLS
validation, worker/Job ownership, explicit per-user registration, restricted
ACL storage, secret redaction, failure behavior, inventoried binary provenance
and native acceptance. The credential JSON is plaintext under the restricted
Windows user ACL; the document does not claim stronger at-rest isolation.

Self-review addressed creation-time folder permissions, registration failure
and duplicate registration behavior, and the distinction between host-worker
managed paths and ephemeral usque authentication arguments. No product code,
dependency installation, registration or packaging change was made. The
written specification remains for user review before implementation planning,
as required by the applied brainstorming architectural workflow. It is not
reported as an approved implementation or a completed D08/Sprint.

## Written specification review blocked audit - 2026-10-14

Previous goal turn classification: no progress, not a live-process wait.
The new written-spec review gate has persisted for three consecutive turns:
specification creation and review request, unchanged-state revalidation, and
this continuation. The user's earlier direction approval was used to write
the specification; it did not review an artifact that did not yet exist.
No later direct message approves the written specification. Current source
state still has only the task-authored ledger and new specification changes.
No independent required action remains before the skill's written-spec review
gate. Set goal blocked pending that review; retain the complete original
Sprint objective and all outstanding native/D08 requirements.

## App WARP plan execution - approved 2026-10-14

User approved the implementation plan and selected task-by-task implementation
and review agents. Task 1 is in progress. No product/native WARP integration
success is claimed yet; no new live device registration is authorized or run.

OBSERVED: baseline packages rebuilt after stale TypeScript build metadata left
contracts dist missing. Existing owned-fixture opt-in
`KRDS_TEST_UNSANDBOXED=1 npm test -- --reporter=dot` passed 80 test files /
497 tests, with one skipped file/test. Production Linux Chromium fails with
`No usable sandbox`; that setting remains unchanged. Fixture opt-in is not
native sandbox evidence. Logs: `/tmp/nia-warp-baseline-fixture-tests.log`.

OBSERVED: pinned usque 4.2.1 `http-proxy -b 127.0.0.1 -p 0` created one owned
loopback listener on an OS-selected port, while its startup log reported
`127.0.0.1:0`. Exact-PID Windows listener discovery returned the actual port.
The owned process was stopped in finally; no new registration was performed.
Receipt: `artifacts/dogfood-20261014/usque-dynamic-port-observation.json`.
Plan corrected to bounded exact-PID listener discovery. This is a standalone
runtime property check, not a native detector result.

INFERRED from pinned upstream source: the backend keeps its process alive and
can reconnect after tunnel loss. Worker implementation must privately classify
first connection failure/loss and stop its owned backend, in addition to
monitoring child exit. Raw output/config/credentials will not be diagnostic data.

Windows canonical source remains clean at e8336dd; original installation and
existing cases are preserved. Local commits are deferred because the required
repository-discipline skill is unavailable; task-scoped working-tree snapshots
and per-task reports will carry review evidence in the meantime.

OBSERVED Task1: pinned transport implemented; fresh review reproduced a socket
leak when browser HTTP disconnected during delayed upstream CONNECT. Fix adds
per-request cancellation and explicit pre-agent socket ownership. Regression
failed before and passed after; scoped fresh re-review approved the correction.
Linux four-file fixture suite passed36. Actual Windows bundled Node22.19.0
and Chromium passed the same four files /36 tests in14.22s, with production
sandbox configuration and no KRDS_TEST_UNSANDBOXED override. TLS fixture used
existing Git-bundled OpenSSL; no software installed or private key committed.
Chromium's temporary fixture certificate uses only a test SPKI allowlist;
ordinary Node TLS separately rejects a wrong-host certificate. This is native
scanner fixture evidence, not the app/usque integration gate. Receipt:
`artifacts/dogfood-20261014/warp-task1-native-tests.log`. Task2 is in progress.

OBSERVED Task2: source review approved. Actual Windows bundled Node22.19.0
ran the unmodified four-file suite through a Node subprocess harness:39 tests
passed in6.67s. A raw PowerShell5 redirection run timed out during cancellation;
the cause is unresolved and the actual native app/Job cancellation gate remains
required. No speculative source fix or app-level success is claimed.

MEASURED: actual production runtime with official WARP disconnected reused the
authorized test configuration, prepared in2967ms and closed by2974ms total.
Startup cancellation at150ms rejected and cleaned by169ms; owned child count
after exit was0. No new device registration occurred. Receipts:
`warp-task2-actual-runtime.json`, `warp-task2-startup-cancel.json` and
`warp-task2-native-tests.log` under `artifacts/dogfood-20261014/`, indexed in
SHA256SUMS. Pinned Windows resource inventory verified672 files.

OBSERVED: the required engineering-profile skills were found under
`/home/monad/develop/engineering-profile/skills`; the earlier commit deferral
is superseded. Reviewed Task1 and Task2 changes are local commits
`0b93263c2c07c80c5a99c5fcfdb36db80110c09e` and
`fa98c3382d402e006242c19d37cb9b5482aab1b0`. Task3 is in progress.
Windows source now contains task-owned source changes; original installation
is preserved. Native app integration, complete D08 and Sprint completion remain
unverified.

OBSERVED Task3 native tests: revised Windows source ran8 WARP/registration
tests (2 owned child entries ignored) and21 session tests (1 owned child entry
ignored). Actual protected DACL creation and verification ran using local
registration fixtures; no live device was registered. Initial Windows compile
error was corrected before these runs. Receipts:
`warp-task3-native-warp-green.log`, `warp-task3-native-session-green.log`.
Independent review then found an import boundary gap: succeeded Cases could
contain incomplete transport-failure metadata. Correction and scoped re-review
are in progress; these runs do not claim final Task3/app acceptance.

OBSERVED preservation before Task5: all160 baseline files were present and
byte-identical; original installed EXE SHA256 remained
`7b6fc529fc679974aca2a603dd7de616ba89947fea64945e5c71fc9cc467fbba`.
Receipt `warp-task3-preservation.json`; SHA256SUMS indexed. Baseline paths are
relative to canonical app-data cases; an initial comparison without that root
reported160 missing paths and was corrected before this preservation claim.

OBSERVED source integration: Tasks3 and4 are reviewed local commits81a60e6
andee3ccc9. Task5 source harness migration and lint corrections are8fc00a4.
Whole-source review reproduced an initial-public/later-private DNS policy gap;
the original prepared entry policy is now carried through crawling, with
per-request public DNS validation retained. Correction4f23cab passed real
HTTP/Chromium regressions and a fresh scoped review. Automatic cancellation,
deadline and backend-loss tests now observe cleanup before explicit close.

OBSERVED final Linux gates after4f23cab: npm run check passed556 tests with1
skip, typecheck and lint passed; build:scanner, smoke:sidecar and
smoke:native-session passed. The sidecar emitted5 official detections and the
native seam passed its real worker/session test. Linux Chromium used a temporary
fixture-only sandbox preload, removed after execution. These are source and
fixture results, not Windows packaged-app acceptance. Four logs are archived
as warp-post-security-fix-*.log with SHA256SUMS entries.

OBSERVED packaging gap: src-tauri/tauri.conf.json explicitly maps bundled
resources but omitted usque.exe and usque-LICENSE.md. The prepared resource
inventory alone did not establish installer payload inclusion. Task2 owner is
correcting this boundary; native payload verification remains required.

OBSERVED packaging correction56fd356: both resources now map to their required
installed paths. Canonical prepare:windows-runtime --verify passed672 files.
Independent copied-byte project fixtures accepted the correct map and rejected
omitted/misdirected resources; actual cached Tauri ResourcePaths selected both
correct destinations. Scoped independent review approved with no Critical or
Important findings. This supersedes the in-progress note above. Native installer
payload and installed runtime verification remain NOT_RUN while Pocket4 is offline.

NOT_RUN remaining Windows packaged app, terms link, Job cleanup, two-target
D08 restart/judgment/integrated XLSX and viewport/focus acceptance: Pocket4
became offline, last seen2026-10-14T04:40:00.1Z. SSH transfer returned
"scp: Connection closed" and subsequent connection checks timed out; the Cua
bridge also disconnected. No package, managed-config copy or new public scan
started during the outage. A dependent extraction was attempted before upload
completion but its SSH connection never opened; no successful extraction or
source identity is assumed. The user has been asked to restore the PC connection.
Original Windows configuration remains on that PC; no new registration occurred.

## Current completion audit against the attached Sprint

OBSERVED: reread the attached Sprint and compared its first-round requirements
with the task-outcome table, current Task5 brief and evidence receipts. The
previous goal turn made source progress by committing the reviewed packaging
correction56fd356. The current audit found the ledger header still described
Task1 implementation as active; it is corrected above without changing the
historical observations.

OBSERVED local evidence preservation: all99 entries in
artifacts/dogfood-20261014/SHA256SUMS were present and matched their recorded
hashes. Missing0, changed0. This checks the local archived evidence only;
it does not recheck Windows app-data or installed executable while disconnected.

| Requirement still needing authoritative evidence | Current result | Evidence required to close it |
| --- | --- | --- |
| D01 changed startup/progress and WARP setup | BLOCKED_NATIVE | Current candidate startup, consent/status controls and progress screenshot; no new registration |
| D03 first3 complete rows at1366x768 | BLOCKED_NATIVE | Actual native CSS viewport and row visibility; existing browser measurement cannot prove this |
| D06 keyboard source/list return focus | BLOCKED_NATIVE | Actual candidate focus after graph/source/list navigation; existing UIA navigation and browser activeElement remain separate evidence |
| D08 two approved public targets, saved judgment/memo, restart, integrated XLSX | BLOCKED_NATIVE | Reopen both cases, produce one integrated workbook after restart, observe saved review cells in actual Excel and official byte identity |
| WARP package and lifecycle acceptance | BLOCKED_NATIVE | Windows package/source identity, actual installed payload EXE/license hashes, owned process/socket cleanup for cancellation/error/close/forced exit, next explicit scan and failed incomplete Case retention |
| D12 impact-only preservation after app/storage/package changes | BLOCKED_NATIVE | Complete160-file historical Windows baseline and original installed EXE compared after current-candidate native checks |

D02/D04/D05/D10 retain the recorded native observations above; they are not
promoted into proof that the unbuilt latest WARP candidate passed those paths.
The latest changed path must still run in the candidate. D07/D09/D11 remain
impact-based checks only; no unrelated full acceptance/benchmark rerun is added.
Actual staff comprehension and1-2-person usability evaluation remain separate
NOT_RUN work and are not implied by autonomous execution.

OBSERVED access audit: local Tailscale backend Running; Pocket4 Online=false,
last seen2026-10-14T04:40:00.1Z. Prior SSH transfer, SSH connection and Cua
bridge failures remain the same prerequisite failure. The connection-restoration
question is pending. Next action on restoration: fresh native/source/process
state, completed canonical source transfer and byte hash equality, then package
and the named acceptance gates. No further product change is justified by this
audit without an actual failure. Goal remains active and incomplete.
