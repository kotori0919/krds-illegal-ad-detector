# Performance baseline (Phase 20 — MEASURED 2026-10-01, Linux dev machine)

Product V2 steering (2026-10-05): the serial/double-pass projection below is
historical. ADR-0011 now requires single-pass live-page processing, one global
monotonic deadline, bounded concurrency (initial 2/3/4 by logical CPUs; hard
max 4), deterministic output, and a 1–4 worker benchmark on 4-vCPU/8-GB
Windows without GPU. Desired acceptance <=1200 s, normal budget 1500 s,
internal guard 1650 s, official ceiling 1800 s. Windows V2 numbers have not
been measured yet. The earlier "parallel only if dry run demands it" stance is
superseded.

## Product V2 L1 concurrency correctness (MEASURED 2026-10-06, Linux)

`node benchmarks/concurrency.mjs` after building scanner and detection. Node
26.8.1, x64 Linux, 15 fixture pages, 1.8 s settle, 30-page/depth-4/300 s
limits. These L1 rows predate ADR-0013 visual capture; the L2 rows below
include it. Each run scanned the same synthetic site. Peak RSS and CPU columns
measure the **Node driver process only**, excluding Chromium and other host
processes; the Windows memory/CPU acceptance measurement remains open.

| Workers | Wall s | Pages/s | Peak Node RSS MiB | Node CPU % | Checked | Failed | TP/FP/FN | Validator |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 27.737 | 0.541 | 149.0 | 0.9 | 15 | 0 | 17/0/0 | PASS |
| 2 | 16.420 | 0.914 | 149.8 | 0.7 | 15 | 0 | 17/0/0 | PASS |
| 3 | 12.788 | 1.173 | 150.6 | 1.2 | 15 | 0 | 17/0/0 | PASS |
| 4 | 10.967 | 1.368 | 161.1 | 0.9 | 15 | 0 | 17/0/0 | PASS |

The official finding set **including assigned IDs** was byte-for-byte
identical at all four worker counts after excluding run-specific metadata.
This L1 run proves concurrency equivalence on synthetic fixtures. The L2 run
below adds realistic page content. Full L3, 4-vCPU/8-GB Windows,
browser-process peak memory/CPU, and the 1200 s target remain unverified.

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
L3 persistence/detail/export and Windows memory/performance still need proof.

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
- [ ] Re-measure full-scan wall + peak RSS + process count on clean Windows 11.
- [ ] Confirm no orphan Chromium after close/cancel (Job Objects).
- [ ] Record NSIS install size + cold-start to first paint.
