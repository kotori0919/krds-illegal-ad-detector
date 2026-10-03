# Performance baseline (Phase 20 — MEASURED 2026-10-01, Linux dev machine)

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

## Budget analysis (official timeout 1800 s)

Settle dominates: 15 pages × ~1.5 s ≈ 22 s crawl + ~22 s live-detect pass
≈ 46 s total. Linear extrapolation: ~200 pages ≈ 10 min on THIS hardware.
Derating ×4 for i6-class CPU + Windows overhead ≈ 40 min — OVER budget at
max limits. Mitigations (frozen defaults already conservative):

- Defaults: maxPages 200, maxDepth 4, perPageMs 30000, global 1500 s.
- Settle is the knob: 1500 ms → 800 ms halves wall time; delayed-injection
  recall must be re-proven at any lower value (fixture: 1200 ms delay).
- Parallel page contexts (2–4) would cut wall ~linearly; NOT implemented —
  complexity risk before submission; only if dry run demands it.
- Evaluator sites are small (dozens of pages, not hundreds); the realistic
  case runs in ~1–2 min even derated ×4.

Verdict: PASS with margin for realistic evaluation scale; max-limit stress
requires the dry-run measurement on real hardware before any tuning.

## What remains (Phase 23 dry run)

- [x] PARTIAL (dev VM 2026-10-03, build `3ED6C5F7…` sidecar): full
  synthetic scan (30 pages/depth 4) exit 0 in 48.6 s wall
  (`C:\prov\perf1.json`, 4649 bytes); fixture node peak RSS 46.1 MB;
  zero `chrome-headless-shell.exe` remain post-scan. App idle peak
  RSS 27 MB (PID 8512, `PeakWorkingSet64`, QGA session-0 — low
  because no window painted there), exe 23.8 MB
  (`24984413` bytes, `3ED6C5F7…`). Clean-machine + interactive
  cold-start-to-paint still pending (see DRY_RUN §G blockers;
  session-0 `MainWindowHandle` stays 0 — window only paints in an
  interactive session, e.g. KRDSLaunch2/KRDSVis task as
  `windows-VM`).
- [ ] Re-measure full-scan wall + peak RSS + process count on clean Windows 11.
- [ ] Confirm no orphan Chromium after close/cancel (Job Objects).
- [ ] Record NSIS install size + cold-start to first paint.
