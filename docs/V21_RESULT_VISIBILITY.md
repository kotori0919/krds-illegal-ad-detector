# Product V2.1 result visibility follow-up

The accepted M1–M5 checkpoint remains intact. This follow-up changes result
presentation, absent-evidence recovery and operational workbook readability.
Official JSON, pattern membership, safe imports, public-only batch transport,
the official single-URL workflow and historical candidates are unchanged.

## Observed changed-path checks

- Built production React UI with the supplied offline fixture: 617 official
  records, 211 affected pages, 19 unchanged groups. At 1366×768 and normal
  scale, search and three complete review rows are visible; the third row ends
  at 752.25 CSS pixels. Body text remains 17px. No text is truncated or clamped.
- Heading-adjacent exports, comparable row counts/state/actions, collapsed
  URLs/selectors/group explanations, single-page pagination removal and one
  multi-page navigation row were exercised. Keyboard entry, scoped bulk review,
  focus return, 360px reflow and 200% CSS zoom were exercised.
- Successful absent optional records have no retry action. Failed reads retain
  isolated recovery; relationship disclosure retains known absence on reopening.
- Full XLSX export retains all 617 records despite active search, original
  codes, selectors, text and review notes. Korean technique names are adjacent
  to codes. Image coverage uses Korean scalar counts, limits and exclusion
  reasons instead of raw JSON. No formula or active hyperlink cells were found.
- Targeted interaction/report tests, TypeScript and changed-file lint passed.
  Unchanged C1–C4 benchmarks and full historical acceptance were not repeated.

The offline UI smoke uses explicit IPC replay and makes no site requests. It
does not establish a Windows batch success or opening in Microsoft Excel.
The separately identified updated candidate records those environment checks
and any NOT_RUN limits in its own acceptance evidence. PR #2 remains Draft.
