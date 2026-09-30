# Synthetic evaluator (Phase 2 — frozen fixture contract)

Deterministic local evaluation site. Serves over loopback only; no external
network. Dynamic behavior is fixture-known until the Playwright crawler
(Phase 3) executes pages for real.

## Serve

```sh
npm run build -w @krds-detector/synth-eval
SYNTH_PORT=4123 npm run serve -w @krds-detector/synth-eval
# → http://127.0.0.1:4123/
```

Static server: `packages/synth-eval/src/serve.ts` (path-traversal guard,
`?query` ignored for file lookup). OBSERVED: `/`, positives, structural,
`ground-truth.json`, query board all return 200.

## Ground truth

- Data: `fixtures/synthetic/ground-truth.json` (22 cases: 13 positive,
  7 negative, 2 structural). Schema: `ground-truth.schema.json`.
- 15 expected finding pairs (combo element + delayed element count twice —
  KODEX §6: two techniques on one element → two findings).
- Positive techniques per case; negatives carry `selector` + rationale and
  must produce zero findings; structural cases constrain crawler dedup.

## Baseline harness

`packages/synth-eval/src/evaluate.ts` — static two-axis gate (ad vocabulary
+ technique signal), scored by `scoreStatic` → TP/FP/FN, precision, recall,
elapsed. CLI: `npm run eval -w @krds-detector/synth-eval`.

OBSERVED (this machine): TP 15 / FP 0 / FN 0, precision 1, recall 1,
elapsed ~1 ms (static parse, not a browser timing claim).

## Case map

| Page | Contents |
|---|---|
| `positives/homoglyph.html` | fullwidth K casino, fullwidth B baccarat |
| `positives/jamo.html` | compat-Jamo casino, conjoining-Jamo loan |
| `positives/transparent.html` | opacity:0 loan, same-fg-bg cash-conversion |
| `positives/offscreen.html` | display:none betting, -9999px bonus, font-size:0 exchange |
| `positives/combined.html` | fullwidth C + opacity:0 (→ 2 findings) |
| `structural/outer→middle→inner` | nested iframe, relative src (`inner.html`), Jamo ad |
| `structural/board.html?id=101/102` | query-value pages; 101 has ad, 102 clean |
| `structural/delayed.html` | JS-injected Jamo+offscreen ad after ~1.2 s |
| `posts/notice.html(+?ref=main)` | identical content, two URLs (dedup target) |
| `negatives.html` | sr-only link, hidden nav/modal, responsive note, legit Jamo/Unicode, app state |

## Limits (explicit non-claims)

- Static extractor reads `id` elements + inline style/class only; no CSS
  cascade, no layout, no script execution. Computed-style/geometry verdicts
  arrive with Phase 3–9 detectors.
- Query/delayed renderings are fixture-modelled, not executed.
- Timing is parse latency, not a crawl benchmark (Phase 20 owns perf).
