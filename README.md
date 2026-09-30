[![ci](https://github.com/snowman0919/krds-illegal-ad-detector/actions/workflows/ci.yml/badge.svg)](https://github.com/snowman0919/krds-illegal-ad-detector/actions/workflows/ci.yml)

Real Windows-capable public-website illegal-advertisement inspection tool for the
2026 행정안전부 / 한국지능정보사회진흥원 "공공 웹사이트 불법광고 탐지 도구 개발 공모전".

- Submission deadline: 2026-10-23 18:00 KST
- Constitution: [`KODEX.md`](./KODEX.md) (wins over temporary tasks)
- Delivery objective: [`GOAL.md`](./GOAL.md)
- Architecture: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) (Contract v0 frozen)
- Decisions: [`docs/ADR/`](./docs/ADR/)

## Quickstart

Requires Node.js 22+.

```sh
npm ci
npx playwright-core install chromium --only-shell  # browser suites
npm run typecheck   # tsc -b over all workspaces
npm run lint        # eslint
npm run test        # vitest run (incl. live-browser suites)
npm run build       # production web build
npm run dev         # web dev server (browser preview host)
```

## Layout

```text
apps/web               React + TypeScript + Vite (canonical UI; platform-independent)
packages/contracts     Shared Contract v0 frozen (HostBridge, scan, findings, result.json)
packages/scanner       Playwright crawler (queue, selectors, live snapshots)
packages/detection     Semantic gate, 4 detectors, result engine, worker sidecar
packages/evidence      Graph, fingerprint, result_extra engine, OCR/VLM seams
packages/synth-eval    Fixture server + static baseline harness
fixtures/synthetic     Deterministic evaluator site + ground truth (22 cases)
src-tauri              Tauri 2 thin host (lifecycle, export, Job-Object cleanup)
docs/                  Manuals, baselines, reviews, ADRs
```

React code must stay platform-independent: no direct Tauri imports outside
platform adapters — all native capability goes through `HostBridge`.

## Docs

- Build: [`docs/BUILD_MANUAL.md`](./docs/BUILD_MANUAL.md) · Use: [`docs/USER_MANUAL.md`](./docs/USER_MANUAL.md)
- Submission plan: [`docs/PLANNING_DOC.md`](./docs/PLANNING_DOC.md) · Dry run: [`docs/DRY_RUN.md`](./docs/DRY_RUN.md)
- Detection: [`docs/DETECTION.md`](./docs/DETECTION.md) · [`docs/DETECTORS.md`](./docs/DETECTORS.md) · [`docs/ADVERSARIAL.md`](./docs/ADVERSARIAL.md)
- Pipeline: [`docs/CRAWLER.md`](./docs/CRAWLER.md) · [`docs/SELECTORS.md`](./docs/SELECTORS.md) · [`docs/SYNTHETIC_EVAL.md`](./docs/SYNTHETIC_EVAL.md)
- Product: [`docs/KRDS_COMPLIANCE.md`](./docs/KRDS_COMPLIANCE.md) · Desktop: [`docs/DESKTOP.md`](./docs/DESKTOP.md)
- Evidence: [`docs/EVIDENCE_INTEL.md`](./docs/EVIDENCE_INTEL.md) · Perf: [`docs/PERF.md`](./docs/PERF.md)

## Scoring (qualification)

Correct detections 45 · Extraction accuracy 35 · Detection time 20 · Hard timeout 30 min.

Engineering order: recall → precision → exact output → speed → extra intelligence.
`result.json` carries only the four official techniques
(`HOMOGLYPH`, `JAMO`, `TRANSPARENT`, `OFFSCREEN`); everything else goes to
`result_extra.json` with `technique = "ETC"`.

## Workflow

- `main` is protected; milestone work lands via draft PRs (no autonomous merge).
- Branches: `dev/bootstrap`, `dev/official-detectors`, `dev/evidence-intelligence`,
  `dev/windows`, `dev/release`.
- Steering: project tracking issue + draft PRs, kept current with test/benchmark state.
