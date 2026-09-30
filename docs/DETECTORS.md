# Detectors + result engine (Phases 5–10)

`packages/detection`: semantic gate, four official detectors, live pipeline,
result engine, end-to-end scan.

## Modules

- `semantic.ts` — axis B gate: NFKC + space-folded ad vocabulary (23 terms)
  OR suspicious destination; raw preserved; legitimate hidden UI rejected.
- `homoglyph.ts` — fullwidth + Cyrillic blocks; NFKC-only deltas without
  confusable blocks belong to JAMO (no double-fire).
- `jamo.ts` — Compat (U+3131–3163) + Conjoining (U+1100–11FF); >= 4 Jamo or
  Jamo-only spelling; reconstruction in `normalizedText` only.
- `visibility.ts` — in-page `collectElementSignals`: computed
  color/opacity/ancestor-opacity/fg==bg (TRANSPARENT); display/font-size/
  zero-box/negative-box/transform/clip/overflow (OFFSCREEN). Geometry from
  real boxes, never class names.
- `pipeline.ts` — leaf `[id]` extraction (containers excluded),
  Node Unicode signals + in-page rendering signals, two-axis decision per
  (element, technique); `evidence_text` = raw source.
- `result-engine.ts` — identity dedup, `f1…` ids, BOM-free serialize,
  frozen-validator gate (throws on failure).
- `scan.ts` — crawl → per-page live detect → per-frame detect with ancestor
  chains → result engine; ScanEvent progress on the frozen vocabulary.

## OBSERVED (synthetic fixtures, this machine)

- Unit: gate passes folded ads, rejects 4 legitimate texts; detectors fire
  on positives, silent on educational/visible negatives.
- Page pipeline: homoglyph 2, jamo 2, transparent 2, offscreen 3, combined 2,
  negatives 0.
- End-to-end: 15 pages, 17/17 pairs, FP 0, FN 0, result.json validates,
  BOM-free; nested iframe location serializes outer >>> inner with absolute
  srcs; query/delayed/dedup all correct.

## Fixes during integration (evidence)

- Container elements (`#board-body`, `#delayed-slot`) excluded: `textContent`
  duplication double-fired findings.
- Crawler snapshots are static HTML: detection re-navigates live pages for
  computed style + geometry.
- `page.frames()` is flat: ancestor chains rebuilt via `parentFrame()` +
  `frameElement()` so nested `>>>` is exact.
