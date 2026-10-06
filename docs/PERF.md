# Performance baseline (Phase 20 — MEASURED 2026-10-01, Linux dev machine)

Product V2 steering (2026-10-05): the serial/double-pass projection below is
historical. ADR-0011 now requires single-pass live-page processing, one global
monotonic deadline, bounded concurrency (initial 2/3/4 by logical CPUs; hard
max 4), deterministic output, and a 1–4 worker benchmark on 4-vCPU/8-GB
Windows without GPU. Desired acceptance <=1200 s, normal budget 1500 s,
internal guard 1650 s, official ceiling 1800 s. Windows L2 measurements below
cover six pages and a generated 200-page scenario; the latter met the desired
target. Full native product/performance acceptance remains open. The earlier "parallel only if dry run demands it" stance is
superseded.

## Current-build Windows acceptance (MEASURED 2026-10-06)

User-directed execution priority: close core scanner and native product
acceptance first. Defer window sizing, zoom and strict KRDS UX verification
until detection, evidence, export, cancellation and current-worker Windows
C1-C4 semantics/performance checks are settled. Those UX gates remain part
of V2 acceptance; they are not removed by this ordering change.

The real current bundled worker ran the generated municipal 200-page scenario
on `clean11`: Windows 10.0.26100 as reported by Node, Node v22.19.0,
4 logical CPUs, 8 GiB RAM, no required GPU, 1500s budget, 1500ms settle.
Worker SHA-256:
`90aed157e13c8a3d32cba551a271edb47915f3afdd632ef80ec53768a0889013`.

| Workers | Wall s | Pages/s | Peak above idle MiB | Peak guest used MiB | Mean CPU % | First page s | Finalization tail s | JPEG calls / failed | JPEG sum / max ms |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| 1 | 328.805 | 0.608 | 362.5 | 3238.8 | 39.5 | 5.505 | 0.026 | 5 / 0 | 131.0 / 40.9 |
| 2 | 170.273 | 1.175 | 470.1 | 3034.8 | 45.4 | 1.247 | 0.028 | 5 / 0 | 6487.8 / 3211.3 |
| 3 | 115.106 | 1.738 | 578.6 | 3080.8 | 48.9 | 1.233 | 0.023 | 5 / 0 | 9559.7 / 3173.2 |
| 4 | 85.420 | 2.341 | 629.9 | 3065.8 | 51.4 | 1.242 | 0.026 | 5 / 0 | 139.3 / 44.4 |

All runs checked 200 pages with one intentional HTTP failure, TP/FP/FN
21/0/0, no timeout, and passed official/detail/extra validators. Full emitted
official finding objects were equal at C1-C4: full URL, complete serialized
frame/selector location, ID, violation flag, technique and evidence text,
including order. Failed-page identities also matched. `same`, `scenarioPassed`
and `targetMet` are all true. Review found the initial comparator discarded
URL origin and frame-chain prefixes; it was replaced by complete official
objects, and the full 200-page benchmark was rerun to produce these rows.
The initial projected report is preserved separately as
`/tmp/illegal-ad-toolchain/windows-v2-initial-projected-bench.json`.
The default remains two workers.

The benchmark-only preload timed real selective JPEG calls without changing
their arguments or result. First-page and finalization values timestamp real
progress arrival; first-page latency includes process/browser admission,
not application first paint. JPEG sums can overlap across workers and are
not wall-time overhead; the observed multi-second C2/C3 capture latency
does not change the official set. These are process-cold single runs in
C1-C4 order with normal OS caches, not cache-flushed or statistically
controlled speed estimates. No parallel build or app scan ran during them.
Working-set/CPU sampling uses the method documented below; guest used memory
includes OS and pre-existing idle test servers. Original report:
`/tmp/illegal-ad-toolchain/current-windows-v2-large-bench.json`.
Screenshot: `/tmp/illegal-ad-toolchain/v2-full-set-final-poll.png`.
This generated local scenario does not establish live public-site throughput.

MEASURED installed native process-cold launch: 0.901 s from spawning the real
app to observing its URL control through WebView2 CDP; renderer first paint
and first contentful paint were 136 ms from navigation. This is a single
instrumented launch with normal OS caches and endpoint polling, not an OS
cold boot or a human-observed paint stopwatch. Native-command export and
validated readback took 0.285 s for 5324 bytes/21 findings. After the native
walk, actual process inspection found zero app and scanner Chromium processes
(three pre-existing fixture servers remained). Evidence:
`/tmp/illegal-ad-toolchain/current-native-core-current.json` and
`v2-core-final-processes.png` in the same directory.

## Product V2 Windows 4-vCPU/8-GB realistic concurrency (MEASURED 2026-10-06)

### Max-page generated municipal scenario

`node.exe benchmarks\windows-v2-bench.mjs --large` ran the real bundled
worker on the same `clean11` machine. Guest-reported fields were Windows
10.0.26100, Node v22.19.0, four logical CPUs and 8 GiB memory. The generated
local site has 200 attempted top-level pages (home, ten boards, 188 distinct
posts and one 404), with a shared live frame embedded in five posts.
Five posts contain the existing delayed and concealed phrases; the shared
frame contributes one deduplicated finding. Default settle was 1500ms,
configured global budget 1500s, maxDepth 4. The expected official set is 21.

| Workers | Wall s | Pages/s | Peak above idle MiB | Peak guest used MiB | Mean CPU % | Checked/failed | TP/FP/FN | Validators | Emitted order/IDs and failure identities equal |
| ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- |
| 1 | 330.992 | 0.604 | 367.5 | 2859.8 | 33.0 | 200/1 | 21/0/0 | PASS | yes |
| 2 | 172.875 | 1.157 | 438.1 | 2720.8 | 39.9 | 200/1 | 21/0/0 | PASS | yes |
| 3 | 113.212 | 1.767 | 532.1 | 2715.8 | 44.9 | 200/1 | 21/0/0 | PASS | yes |
| 4 | 86.102 | 2.323 | 753.4 | 2755.8 | 49.2 | 200/1 | 21/0/0 | PASS | yes |

All runs finished without deadline expiry and below the 1200s desired target.
Node/Chromium working-set and CPU methods are described below. Peak guest
used memory is physical memory minus `Memory\Available MBytes`, sampled with
CPU every second. It includes the OS and other guest processes. Single runs
in C1-C4 order are acceptance observations, not a statistically controlled
speed comparison: browser smoke checks and an incremental cross-build ran on
the shared Linux host during the VM run. The default remains two workers.
The worker SHA-256 was
`e027c05f45b6ce3bcf7676fe6856c4dd47cc0a085c23456c7191437f802f1131`.
The guest report is `C:\Users\cleanval\Documents\windows-v2-large-bench.json`;
`/tmp/illegal-ad-toolchain/large-final.png` and `large-report-machine.png`
record the output and runtime fields. This generated L2 scenario does not
establish live public-site performance or complete native product acceptance.

### Six-page municipal scenario

`clean11` Windows 11 IoT Enterprise LTSC Evaluation VM, 4 vCPU, 8 GiB RAM,
no GPU. The portable V2 bundle was mounted as an ISO, without a development
checkout in the guest. `node.exe benchmarks\\windows-v2-bench.mjs` started the
real bundled worker against the same served municipal fixture for C1–C4.
The script checks official, detail, and extra validators, the complete
official finding set in emitted order including IDs/evidence text, failed-page
identities, and ground truth. Machine fields are read from the guest runtime. The
report is `C:\\Users\\cleanval\\Documents\\windows-v2-bench.json` in the VM.

Memory is the sampled peak of `node.exe` plus `chrome-headless-shell.exe`
working sets from Windows `tasklist` every 500 ms, less each run's idle
baseline. This includes the benchmark and fixture Node processes, and is not
total VM memory. CPU is mean total Windows processor utilization from
`typeperf` one-second samples during each run; it includes OS work. The C1
cold run and sampling overhead make these small-site times unsuitable for
extrapolating the 1200-second target.

| Workers | Wall s | Pages/s | Peak above idle MiB | Mean CPU % | Checked | Failed | TP/FP/FN | Official/detail/extra validators | Full set equal |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| 1 | 16.721 | 0.359 | 320.8 | 36.8 | 6 | 1 | 5/0/0 | PASS | yes |
| 2 | 7.455 | 0.805 | 377.9 | 39.1 | 6 | 1 | 5/0/0 | PASS | yes |
| 3 | 6.180 | 0.971 | 443.1 | 41.5 | 6 | 1 | 5/0/0 | PASS | yes |
| 4 | 5.943 | 1.010 | 445.3 | 38.7 | 6 | 1 | 5/0/0 | PASS | yes |

These single runs establish output equivalence and record resources for this
fixture. They do not establish a throughput difference or justify changing
the initial 4-vCPU default of two workers. Comparative performance claims
require repeated runs with dispersion and controlled competing load.

## Product V2 L1 concurrency correctness (MEASURED 2026-10-06, Linux)

`node benchmarks/concurrency.mjs` after building scanner and detection. Node
26.8.1, x64 Linux, 15 fixture pages, 1.8 s settle, 30-page/depth-4/300 s
limits. These L1 rows predate ADR-0013 visual capture; the L2 rows below
include it. Each run scanned the same synthetic site. Peak RSS and CPU columns
measure the **Node driver process only**, excluding Chromium and other host
processes. The separate bounded Windows L2 working-set/CPU run is above;
the generated max-page and guest-memory observations above cover the worker;
full native product acceptance remains open.

| Workers | Wall s | Pages/s | Peak Node RSS MiB | Node CPU % | Checked | Failed | TP/FP/FN | Validator |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 27.737 | 0.541 | 149.0 | 0.9 | 15 | 0 | 17/0/0 | PASS |
| 2 | 16.420 | 0.914 | 149.8 | 0.7 | 15 | 0 | 17/0/0 | PASS |
| 3 | 12.788 | 1.173 | 150.6 | 1.2 | 15 | 0 | 17/0/0 | PASS |
| 4 | 10.967 | 1.368 | 161.1 | 0.9 | 15 | 0 | 17/0/0 | PASS |

The official finding set **including assigned IDs** was byte-for-byte
identical at all four worker counts after excluding run-specific metadata.
This L1 run proves concurrency equivalence on synthetic fixtures. The L2 run
below adds realistic page content. The later Windows max-page worker run
above met the target; full L3/product acceptance remains unverified.

## Product V2 L2 realistic concurrency (MEASURED 2026-10-06, Linux)

`node benchmarks/concurrency.mjs --realistic` serves `fixtures/realistic` on
loopback. Municipal-style navigation, board/post/comments, an iframe, delayed
injection, legitimate gambling-report wording, hidden accessibility UI, and
one expected 404 page are included. Ground truth has five official findings.
The first run exposed an FP on “카지노·대출 광고 신고 안내”; the punctuation-split
rule was corrected, then this benchmark was rerun. Columns have the same
Node-only memory/CPU limitation as L1 above.

| Workers | Wall s | Pages/s | Peak Node RSS MiB | Node CPU % | Checked | Failed | TP/FP/FN | Validator |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 8.584 | 0.699 | 146.6 | 1.7 | 6 | 1 | 5/0/0 | PASS |
| 2 | 5.731 | 1.047 | 147.1 | 1.1 | 6 | 1 | 5/0/0 | PASS |
| 3 | 4.317 | 1.390 | 147.6 | 1.3 | 6 | 1 | 5/0/0 | PASS |
| 4 | 4.316 | 1.390 | 147.9 | 1.1 | 6 | 1 | 5/0/0 | PASS |

These rows include the bounded real JPEG capture added in ADR-0013. The
official finding set, evidence text, order, and IDs matched at all four
settings. Throughput plateaued at 3–4 workers on this six-page scenario;
these numbers do not justify raising the 4-vCPU Windows default above 2.
The native persistence/detail seam and bounded Windows L2 export/working-set
slices were subsequently exercised. The generated Windows max-page run is
above; full L3/product acceptance remains open.

After ADR-0014 moved the settle interval to DOM readiness, the same Linux L2
benchmark was rerun with `npm run benchmark:concurrency -- --realistic`. This
command rebuilds the contracts, fixture server, scanner and detection packages;
the benchmark rejects stale emitted files. An earlier rerun was withdrawn
because `npm run typecheck` left scanner/detection `dist` older than their
source, so it did not measure ADR-0014. The fixture has no late navigation
load, so this fresh run does not estimate worst-case settle overhead. Peak
memory and CPU are still Node-driver-only; the separate Windows L2 run above
includes Chromium working sets.

| Workers | Wall s | Pages/s | Peak Node RSS MiB | Node CPU % | Checked | Failed | TP/FP/FN | Validator |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 8.626 | 0.696 | 147.2 | 1.8 | 6 | 1 | 5/0/0 | PASS |
| 2 | 5.766 | 1.041 | 150.2 | 1.2 | 6 | 1 | 5/0/0 | PASS |
| 3 | 4.349 | 1.380 | 150.3 | 1.4 | 6 | 1 | 5/0/0 | PASS |
| 4 | 4.350 | 1.379 | 150.7 | 1.3 | 6 | 1 | 5/0/0 | PASS |

All four runs had the same official finding IDs and set, 5 TP / 0 FP / 0 FN,
and valid official output.

After the optional live-image extra path was connected, the same rebuilt
municipal L2 benchmark ran on Linux x64, Node v26.8.1 (2026-10-06). It still
checks the complete official set. The extra path did not change the 5 TP,
0 FP, 0 FN, six checked pages, one failed page, or stable IDs. Node RSS/CPU
exclude the Chromium process and cannot serve as Windows acceptance data.

| Workers | Wall s | Pages/s | Peak Node RSS MiB | Node CPU % | Checked | Failed | TP/FP/FN | Validator |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 8.637 | 0.695 | 145.9 | 1.9 | 6 | 1 | 5/0/0 | PASS |
| 2 | 5.772 | 1.040 | 149.1 | 1.3 | 6 | 1 | 5/0/0 | PASS |
| 3 | 4.348 | 1.380 | 149.2 | 1.5 | 6 | 1 | 5/0/0 | PASS |
| 4 | 4.352 | 1.379 | 149.9 | 1.3 | 6 | 1 | 5/0/0 | PASS |

## Product V2 full official-set comparison (MEASURED 2026-10-06, Linux)

The benchmark now compares each ordered official finding's ID, site-normalized
URL, full frame location, technique and unmodified evidence text. The earlier
benchmark compared only the terminal selector and technique beside the ID,
which could miss a frame-path or evidence-text difference. Both scenarios were
rerun after this correction. The metric process is still Node alone, excluding
Chromium, so these rows do not satisfy Windows resource acceptance.

| Scenario | Workers | Wall s | Pages/s | Peak Node RSS MiB | Node CPU % | Checked | Failed | TP/FP/FN | Validator | Full set equal |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| L1 synthetic | 1 | 27.567 | 0.544 | 149.8 | 1.2 | 15 | 0 | 17/0/0 | PASS | yes |
| L1 synthetic | 2 | 16.655 | 0.901 | 151.1 | 1.6 | 15 | 0 | 17/0/0 | PASS | yes |
| L1 synthetic | 3 | 13.036 | 1.151 | 152.0 | 2.5 | 15 | 0 | 17/0/0 | PASS | yes |
| L1 synthetic | 4 | 11.132 | 1.348 | 167.8 | 1.7 | 15 | 0 | 17/0/0 | PASS | yes |
| L2 realistic | 1 | 8.808 | 0.681 | 146.1 | 3.3 | 6 | 1 | 5/0/0 | PASS | yes |
| L2 realistic | 2 | 5.866 | 1.023 | 148.7 | 2.2 | 6 | 1 | 5/0/0 | PASS | yes |
| L2 realistic | 3 | 4.416 | 1.359 | 149.8 | 2.5 | 6 | 1 | 5/0/0 | PASS | yes |
| L2 realistic | 4 | 4.450 | 1.348 | 150.1 | 2.0 | 6 | 1 | 5/0/0 | PASS | yes |

The L2 official set, identical at all four worker counts, was:

| ID | URL | Full location | Technique | Evidence text |
| --- | --- | --- | --- | --- |
| f1 | `<site>/frame.html` | `iframe[src="<site>/frame.html"] >>> #frame-ad` | JAMO | ㅋㅏㅈㅣㄴㅗ 첫충전 이벤트 |
| f2 | `<site>/post.html` | `#comment-ad` | HOMOGLYPH | Ｃ카지노 신규 가입 보너스 |
| f3 | `<site>/post.html` | `#hidden-ad` | TRANSPARENT | 무직자 대출 당일 승인 |
| f4 | `<site>/post.html` | `#late-comment` | JAMO | 대출 무서류 당일 승인 |
| f5 | `<site>/post.html` | `#late-comment` | OFFSCREEN | 대출 무서류 당일 승인 |

Environment: 16 cores, 30 GB RAM, Node 26, headless Chromium. This is NOT
the conservative baseline (Win11, i6-class, 4–6 cores, 8 GB, no GPU) — it
bounds the architecture, not the submission hardware. Windows numbers must
be re-measured in the Phase 23 dry run; margins below assume slower hardware
and carry explicit derating notes.

## MEASURED (this machine, synthetic fixtures, settle 1500 ms)

Settle floor (depth probe, delayed fixture with 1200 ms injection):
settle 400/800/1000/1200 → delayed ad MISSED; 1300/1500 → found.
1500 ms is the proven minimum on this hardware — do NOT lower without
re-proving recall (slower Windows hardware needs ≥1500, possibly more).

- Detector per page (live, incl. evaluate round-trip): median 5 ms
  (homoglyph 6 ms / offscreen 4 ms / negatives 5 ms).
- Browser cold start: 46 ms (launch + blank page).
- Evidence: 64×64 fingerprint 4 ms; graph build (6 nodes) 1 ms; extra
  build ~0 ms.
- OCR latency: n/a (no backend bundled — interface only, ADR-0008).
- Model latency: n/a (rule model ~0 ms; VLM disabled).
- Process count: 1 node worker + 1 Chromium + renderers (observed 570
  chrome-matching lines system-wide incl. unrelated processes — count on
  clean Windows in dry run).

## Historical serial budget analysis (official timeout 1800 s)

Settle dominates: 15 pages × ~1.5 s ≈ 22 s crawl + ~22 s live-detect pass
≈ 46 s total. Linear extrapolation: ~200 pages ≈ 10 min on THIS hardware.
Derating ×4 for i6-class CPU + Windows overhead ≈ 40 min — OVER budget at
max limits. Mitigations (frozen defaults already conservative):

- Defaults: maxPages 200, maxDepth 4, perPageMs 30000, global 1500 s.
- Settle is the knob: 1500 ms → 800 ms halves wall time; delayed-injection
  recall must be re-proven at any lower value (fixture: 1200 ms delay).
- Parallel page contexts (2–4) were not implemented at the time of this
  projection; Product V2 now implements the initial worker policy.
- Evaluator sites are small (dozens of pages, not hundreds); the realistic
  case runs in ~1–2 min even derated ×4.

Historical verdict: projected margin for realistic evaluation scale. This
projection is superseded by the new L1 measurements and does not establish
Windows or max-limit acceptance.

## What remains (Phase 23 dry run)

- [x] PARTIAL (dev VM 2026-10-03, build `3ED6C5F7…` sidecar): full
  synthetic scan (30 pages/depth 4) exit 0 in 48.6 s wall
  (`C:\prov\perf1.json`, 4649 bytes); fixture node peak RSS 46.1 MB;
  zero `chrome-headless-shell.exe` remain post-scan. App idle peak
  RSS 27 MB (PID 8512, `PeakWorkingSet64`, QGA session-0 — low
  because no window painted there), exe 23.8 MB
  (`24984413` bytes, `3ED6C5F7…`). Cold-start-to-first-paint
  (OBSERVED 2026-10-03, dev VM, build `3ED6C5F7…` via interactive
  task KRDSVis as `windows-VM`, 1920×1440 `virsh screenshot`
  series): kill → start-command at guest `11:19:09.388` → first
  observed painted window ≤ ~40 s later (`virsh screenshot` + QGA
  rendezvous latency dominates; true paint is earlier — window
  fully painted with URL autofocus in the first post-start
  frame). Bound: ≤ 60 s conservative on this VM; clean-machine +
  slower hardware still pending (DRY_RUN §G).
  Interactive idle peak RSS re-confirmed 27 MB (PID 4640), zero
  chromium, fixture LISTEN.
- [x] Bounded six-page Windows concurrency 1–4 wall/working-set/CPU run above.
- [x] Generated 200-page Windows worker wall and total guest memory measured above.
- [x] Record instrumented native process-cold readiness/paint, selective capture/finalization durations and installed-package process count (current-build rows above; normal OS caches).
- [x] Confirm no orphan scanner Chromium after the current native cancellation/restart/close walk (process snapshot above).
- [x] GNU LLVM NSIS package generated and installed: 119407387 bytes (113.88 MiB).
- [x] Measure instrumented native process-cold readiness and renderer first paint; OS-cold boot remains outside this single-run measurement.
