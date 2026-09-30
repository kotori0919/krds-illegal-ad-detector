# krds-illegal-ad-detector

Real Windows-capable public-website illegal-advertisement inspection tool for the
2026 행정안전부 / 한국지능정보사회진흥원 "공공 웹사이트 불법광고 탐지 도구 개발 공모전".

- Submission deadline: 2026-10-23 18:00 KST
- Constitution: [`KODEX.md`](./KODEX.md) (wins over temporary tasks)
- Delivery objective: [`GOAL.md`](./GOAL.md)
- Architecture (draft): [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
- Decisions: [`docs/ADR/`](./docs/ADR/)

## Quickstart

Requires Node.js 22+.

```sh
npm ci
npm run typecheck   # tsc -b over all workspaces
npm run lint        # eslint
npm run test        # vitest run
npm run build       # production web build
npm run dev         # web dev server (browser preview host)
```

## Layout

```text
apps/web               React + TypeScript + Vite (canonical UI; platform-independent)
packages/contracts     Shared Contract v0 draft (HostBridge, scan, findings, result.json)
docs/                  Architecture, ADRs, KRDS compliance log
fixtures/              (Phase 2) synthetic evaluator website + ground truth
```

React code must stay platform-independent: no direct Tauri imports outside
platform adapters — all native capability goes through `HostBridge`.

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
