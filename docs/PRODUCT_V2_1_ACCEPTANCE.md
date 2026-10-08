# Product V2.1 implementation and acceptance

Baseline: `13a0764`, branch `dev/bootstrap`, Draft PR #2. The immutable
`rc-5e44feb-20261008` and its historical observations remain unchanged.

## M1 — grouped Results Workspace

The default official collection is a management projection: technique,
whitespace-normalized semantic text, site origin, explicit selector href,
and the **exact selector/frame chain** define a pattern. Exact selectors are
conservative selector families; classes/indices/frame resources are not erased.
This prevents unrelated DOM contexts from becoming a single alleged violation.
Only identical whitespace is normalized for display. Original text, IDs,
URLs, selectors, `is_violation`, and all four technique values remain intact.
Selector-derived links are labelled as such; no destination is automatically
opened. Stable pattern keys, IDs, member ordering and page ordering are independent
of input order. Repetition does not establish severity or a legal conclusion.

The supplied sanitized fixture is checked in under
`packages/evidence/test/fixtures/sample_result_617_sanitized.json`. Its actual
counts are 617 occurrences, 211 affected URLs, 616 OFFSCREEN, one JAMO, and
19 conservative patterns. Two patterns have 197 records on 197 unique pages;
the `li.sub-off` family has 187, with other selector contexts separate.
`f372` remains an independent review-needed record, not a confirmed false positive.
Bare official JSON has no measured coverage or screenshots; the UI reports
that absence instead of deriving checked pages from affected pages.

OBSERVED: `npx vitest run apps/web/test packages/evidence/test/review-patterns.test.ts`
passed 88 tests. Typecheck, lint, and frontend build passed. The built product
React -> Tauri adapter was exercised using **explicit offline IPC replay** by
`benchmarks/ui-v21-workspace-smoke.mjs`: 19 default rows, original-record
20/50 pagination, scope-confirmed bulk review, `f372` lookup, sequential group
inspection, keyboard Enter, return focus, 360px reflow, and 200% CSS zoom.
No remote page requests or JavaScript errors occurred. Review/export produced
byte-identical canonical official serialization (not the attachment's original
pretty-print formatting). Images remain lazy. The script's export is replay;
it is not evidence of a native Windows save.

Evidence: `/tmp/illegal-ad-v21-m1/observed.json`, `grouped-desktop.png`,
`f372-inspector.png`, `f372-360px.png`, `workspace-200-percent.png`, `result.json`.
NOT_RUN in M1: installed Windows acceptance and an uninstructed human tester.
Review state remains local screen memory in this milestone.

## Remaining ordered milestones

M2: local XLSX reporting and review notes through actual native export.
M3: typed access limitations and bounded sitemap discovery.
M4: network-free safe file preview, sequential independent batch sessions,
per-site official outputs and aggregate workbook.
M5: focused integrated acceptance and separate Windows installer candidate.
