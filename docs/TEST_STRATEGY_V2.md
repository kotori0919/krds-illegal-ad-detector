# Test strategy V2

Status: L2 measured and scanner-only L3 slices exercised on Linux on
2026-10-06; persisted native-host L3 and packaged Windows L4 remain open.

Observed Linux L2 slice: `fixtures/realistic` and
`packages/detection/test/realistic.test.ts` exercise a municipal-style board,
comments, live iframe, delayed element, ordinary notice/report text, and one
404 page. At concurrency 1–4, each run produced 5 TP / 0 FP / 0 FN, 6 checked
pages, 1 failed page, and identical official IDs. See `PERF.md` for timings.
The served five-page public-information negative scenario in
`packages/detection/test/false-positive-site.test.ts` exercises hidden
accessibility help, reporting/statistics, multilingual/Jamo education and
prevention copy, including a hidden link to a topic-specific public route.
Its expected official set is empty; the real scanner and official validator
run at worker counts 1–4. This is a bounded negative slice of the broader
false-positive torture plan below, not full coverage of it.
`packages/detection/test/single-pass.test.ts` instrumented server requests:
each admitted top-level page and iframe document was fetched once at worker
counts 1 and 4, including when frontier admission hit `maxPages`. This is a
bounded L3 execution slice. A Node worker CLI run on the synthetic site wrote
an official result (17 findings, validator pass) and a separate detail manifest
whose 17 IDs joined; 13 entries had JPEG data with the expected magic bytes.
`packages/detection/test/cross-origin-frame.test.ts` serves the site and frame
on different loopback origins. The real scanner requests each nested frame
document once, emits absolute `>>>` chains for both depths, and drops the inner
finding when `maxFrameDepth` is 1 without crawling the frame origin as a page.
`npm run smoke:worker` rebuilds the scanner and starts the real worker as a
separate Node process against the municipal-style site. It observed five
ground-truth official findings, five matching detail records with valid JPEG
bytes, six checked pages, one failed page and a terminal progress event with
six visited pages. Both official and detail validators passed. Temporary
output files are removed after verification; the Tauri host is not exercised.
`packages/scanner/test/worker-pool.test.ts` holds live page callbacks at a
barrier and observes peak callback overlap of 1, 2, 3 and 4 for those selected
worker counts, with all nine frontier pages requested once. An override of 5
is rejected before navigation. This checks the live processing cap; Windows
browser-process working set remains a separate acceptance measurement.
`packages/detection/test/deadline-scan.test.ts` exercises the real scanner
under a six-second global budget: a slow page becomes a typed coverage failure,
the next queued page is not requested inside the finalization reserve, and a
finding from a completed page remains in valid official and detail output.
The same test checks that an all-404 scan and a scan whose deadline admits no
pages fail instead of exporting an empty success result; a valid zero-finding
site with successfully checked pages still succeeds.
It proves that settlement path for a short local fixture, not the long-running
Windows watchdog or app cancellation behavior.
The Tauri session store and native export have not run inside a packaged app,
so L3 persisted-detail/export acceptance remains open.
The Rust session module was compiled independently on Linux with its existing
unit tests (14 passed). A real child stderr pump reproduced a host terminal
event reporting zero visited pages after a three-page progress event; the
registry now retains the latest page, frame, element, candidate and elapsed
counters and lets a validated result override the provisional finding count.
Full Tauri compilation and packaged runtime verification are still open.
`benchmarks/ui-20-smoke.mjs` exercises the real React results workspace with a
20-finding synthetic IPC fixture in Chromium: all 20 are opened and marked
reviewed, then search/filter and fallback focus are checked. It is a UI replay,
not an L3 native-host or L4 operator result.

## Layers and evidence

| Layer | Runs | Decides |
| --- | --- | --- |
| L1 primitive regression | Existing normalization, selector, visibility, serializer, and contract checks | Small boundary/algorithm regressions only; no product-readiness claim. |
| L2 realistic scenarios | Local served multi-page sites with real browser rendering, normal content, dynamic areas, frames and explicit ground-truth locations | TP/FP/FN, precision/recall, coverage/failure reasons, graph/creative relations. |
| L3 system | Entry URL → single-pass bounded worker pool → deterministic detection → persisted official result → detail/visual/coverage retrieval → validated export | End-to-end contract join, one-navigation rule, deadline/worker bounds, concurrency invariance, and artifact integrity. |
| L4 product acceptance | Packaged Windows 11 app, keyboard and CUA, 4 vCPU/8 GB/no GPU | Operator can complete the product walk; scanner meets semantic-equivalence and measured performance gates without orphans. |

## L2 scenarios

**Public site.** A municipal-style local site includes navigation, mega menu, accessibility labels, boards, posts/comments, iframe chains, normal images, lazy insertion, multilingual text, and public campaigns. A small, explicitly labelled set of real illegal ads uses the four official techniques. Ground truth records page URL, element, technique, and expected text. Measure TP, FP, FN, precision, recall by technique and page, plus checked/failed pages. A hidden legitimate navigation item must not count as an ad.

**Advertisement infrastructure.** Several content domains share asset, redirect, and landing endpoints. Include exact duplicate, resized image, re-encoded WebP, slight modification, and repeated click destination. Verify graph edges and creative similarity on observed bytes/URLs; do not infer common ownership. Because current `packages/evidence` fingerprint code is separate from the text scanner, the scenario must exercise the integrated path before claiming detection.

**False-positive torture.** A full site of legitimate accessibility UI, hidden navigation, dialogs, tabs, carousel, SVG/chart, multilingual/Hangul education, gambling-report notice, prevention campaign, casino-crime reporting, and public adult-content blocking guidance. Expected official findings: zero. Run through the real scanner, not isolated `semanticGate` calls. Any finding is a blocking FP to investigate, with page and evidence logged; do not simply add a fixture-specific exclusion.

## L3 checks

Run the canonical scanner against a local site and assert that the persisted `OfficialFinding` IDs join details and actual screenshot/crop metadata, that `ScanCoverage` counts completed pages and typed failures, and that the exported bytes pass the official validator with the same four-technique/identity rules. Exercise a page timeout/access error without losing successful findings. Exercise zero-checked-page failure, cancellation after one completed page, and a visual capture budget failure. A false asset reference must be rejected by the host. Browser replay checks only UI states and must be labelled replay.

Instrument a local fixture's request log to prove each admitted top-level URL is navigated once and each inspectable iframe is analyzed through its live `Frame`, without a second Page navigation. Include cross-origin, nested, detached, and inaccessible frames; confirm bounded frame depth/count and unchanged `>>>` location serialization. Saturate `maxPages` within a breadth frontier and scramble page response timings to prove the same admitted URL set. Assert active top-level Pages never exceed selected concurrency or hard cap 4. Run a short deadline fixture with slow navigation, slow frame, and slow optional capture; verify one deadline spans all phases, no new work starts inside finalization reserve, official results from completed pages survive, and process tree closes by the internal guard.

## Concurrency correctness benchmark

Run the **same** realistic L2 public-site scenario at concurrency 1, 2, 3, and 4 with identical settle rules, page limits, data, and machine. Record for each run: total wall time, pages/sec, peak RSS/working set, CPU utilization where available, checked pages, failed pages, TP/FP/FN, canonical official finding set `(url, location, technique, evidence_text)`, assigned IDs/order, and official output validator result. Require `FindingSet(C1) == FindingSet(C2) == FindingSet(C3) == FindingSet(C4)` and identical coverage/issue identities; `meta.started_at`, `finished_at`, and `elapsed_sec` may differ. Compare reruns at a frontier-limited `maxPages` and with mixed fast/slow responses to expose completion-order races. Any speedup that changes detection semantics or omits a page is a failure. The initially adaptive policy (2/3/4 by logical CPUs) is retained only after the Windows memory and accuracy data supports it.

Use `npm run benchmark:concurrency -- --realistic` so all scanner packages are
rebuilt before measurement. Direct `node benchmarks/concurrency.mjs` invocation
rejects stale emitted JavaScript; a typecheck alone does not rebuild it.

## L4 operator walk

On a 4-vCPU/8-GB Windows 11 machine without GPU: install/open; confirm first paint and URL focus; start a real scan at default concurrency 2; observe stage, elapsed time, current page, recent activity and truthful counts; cancel and restart; finish a scan with a failed page; switch official/extra/coverage and finding/page views; filter/search; inspect at least 20 findings with keyboard and pointer while retaining context; inspect a real transparent/offscreen visual and text transform; validate/save `result.json` through native dialog; cancel native dialog; start a second scan; close and inspect child-process cleanup. Record screenshots or CUA observations, exported file hash/validator output, process list, and failures. Run concurrency 1–4 benchmark on the same fixture and compare semantic sets. No “Windows accepted” claim from web browser replay or Rust type-check alone.

## Performance and accessibility gates

Measure cold start to first meaningful paint, click-to-scan start latency, total wall time, pages/sec, per-page analysis time, peak memory, CPU utilization where available, screenshot time and bytes per selected finding, total evidence overhead, finalization time, and export latency on the evaluation-class Windows PC. Compare same scenario with and without selective capture; target <=1200 s, keep the 1500 s configured budget, enforce 1650 s internal hard stop, and stay below the 1800 s official ceiling. A capture budget breach must reduce optional evidence, never delay or erase official results. Verify the KRDS V2 state matrix and release gate in `KRDS_COMPLIANCE.md`: 360px and 200% zoom reflow, token lineage, visible/restored focus, mixed-age targets, screen-reader status cadence, dialog focus trap/return, keyboard list-detail navigation, non-color status, and actionable Korean errors. Record observed outputs and any unrun gates separately.

Product V2 is complete only when both the operator/KRDS/evidence/export path and the single-pass/deadline/bounded-concurrency/deterministic scanner path have passed L2, L3, and Windows L4 gates. A green L1 suite or faster serial fixture is insufficient.
