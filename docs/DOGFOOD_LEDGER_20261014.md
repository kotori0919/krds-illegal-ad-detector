# Product dogfood ledger - 2026-10-14

Status: BLOCKED_D08_FINDING_COVERAGE. This is autonomous operator simulation, not an NIA
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
| D08 | Administrator / two public targets | OBSERVED_NATIVE_INSTALLED_565, limited | Approved example.org/example.com each1page/depth0/60sec: two independent completed sessions, checked1/failed0/findings0 each. Native integrated XLSX has both targets and seven sheets; a new installed process reopened both cases. | No findings exist to judge/note. Native batch memo persistence and integrated saved judgments remain NOT_RUN; report was exported before restart, batch grouping is not claimed restored. Additional target/fixture choice requested. |
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
