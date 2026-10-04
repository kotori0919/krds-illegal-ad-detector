# Test strategy V2

Status: design freeze, 2026-10-05. Existing synthetic checks are retained as L1; no new scenario is claimed to have passed.

## Layers and evidence

| Layer | Runs | Decides |
| --- | --- | --- |
| L1 primitive regression | Existing normalization, selector, visibility, serializer, and contract checks | Small boundary/algorithm regressions only; no product-readiness claim. |
| L2 realistic scenarios | Local served multi-page sites with real browser rendering, normal content, dynamic areas, frames and explicit ground-truth locations | TP/FP/FN, precision/recall, coverage/failure reasons, graph/creative relations. |
| L3 system | Entry URL → crawl → detection → persisted official result → detail/visual/coverage retrieval → validated export | End-to-end contract join and artifact integrity, including one injected page failure and one missing visual asset. |
| L4 product acceptance | Packaged Windows 11 app, keyboard and CUA, GPU-less PC | Operator can start, track, stop, review 20 findings, filter, group by page, inspect actual visual evidence, save, restart, and close without orphans. |

## L2 scenarios

**Public site.** A municipal-style local site includes navigation, mega menu, accessibility labels, boards, posts/comments, iframe chains, normal images, lazy insertion, multilingual text, and public campaigns. A small, explicitly labelled set of real illegal ads uses the four official techniques. Ground truth records page URL, element, technique, and expected text. Measure TP, FP, FN, precision, recall by technique and page, plus checked/failed pages. A hidden legitimate navigation item must not count as an ad.

**Advertisement infrastructure.** Several content domains share asset, redirect, and landing endpoints. Include exact duplicate, resized image, re-encoded WebP, slight modification, and repeated click destination. Verify graph edges and creative similarity on observed bytes/URLs; do not infer common ownership. Because current `packages/evidence` fingerprint code is separate from the text scanner, the scenario must exercise the integrated path before claiming detection.

**False-positive torture.** A full site of legitimate accessibility UI, hidden navigation, dialogs, tabs, carousel, SVG/chart, multilingual/Hangul education, gambling-report notice, prevention campaign, casino-crime reporting, and public adult-content blocking guidance. Expected official findings: zero. Run through the real scanner, not isolated `semanticGate` calls. Any finding is a blocking FP to investigate, with page and evidence logged; do not simply add a fixture-specific exclusion.

## L3 checks

Run the canonical scanner against a local site and assert that the persisted `OfficialFinding` IDs join details and actual screenshot/crop metadata, that `ScanCoverage` counts completed pages and typed failures, and that the exported bytes pass the official validator with the same four-technique/identity rules. Exercise a page timeout/access error without losing successful findings. Exercise zero-checked-page failure, cancellation after one completed page, and a visual capture budget failure. A false asset reference must be rejected by the host. Browser replay checks only UI states and must be labelled replay.

## L4 operator walk

On Windows 11 without GPU: install/open; confirm first paint and URL focus; start real scan; observe stage, elapsed time, current page, recent activity and truthful counts; cancel and restart; finish a scan with a failed page; switch official/extra/coverage and finding/page views; filter/search; inspect at least 20 findings with keyboard and pointer while retaining context; inspect a real transparent/offscreen visual and text transform; validate/save `result.json` through native dialog; cancel native dialog; start a second scan; close and inspect child-process cleanup. Record screenshots or CUA observations, exported file hash/validator output, and failures. No “Windows accepted” claim from web browser replay or Rust type-check alone.

## Performance and accessibility gates

Measure cold start to first meaningful paint, click-to-scan start latency, pages/sec, per-page analysis time, peak memory, screenshot time and bytes per selected finding, total evidence overhead, and export latency on the evaluation-class Windows PC. Compare same scenario with and without selective capture; preserve the 1500-second default and 1800-second official ceiling. A capture budget breach must reduce optional evidence, never delay or erase official results. Verify 360px and 200% zoom reflow, visible focus, 44px target design, screen-reader status cadence, dialog focus trap/return, keyboard list-detail navigation, non-color status, and actionable errors. Record observed outputs and any unrun gates separately.
