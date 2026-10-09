[![ci](https://github.com/snowman0919/krds-illegal-ad-detector/actions/workflows/ci.yml/badge.svg)](https://github.com/snowman0919/krds-illegal-ad-detector/actions/workflows/ci.yml)

Real Windows-capable public-website illegal-advertisement inspection tool for the
2026 행정안전부 / 한국지능정보사회진흥원 "공공 웹사이트 불법광고 탐지 도구 개발 공모전".

## Current adoption candidate (0.2.1 / policy 2)

Current candidate, observed acceptance and delivery identities: [Korean adoption handoff](docs/ADOPTION_HANDOFF_KO.md).
Implementation and A01–A14 evidence: [adoption ledger](docs/ADOPTION_LEDGER.md).
Current screen changes and web validation: [UI adoption](docs/UI_ADOPTION_KO.md).
Receiving maintainers start with [BUILD_MANUAL](docs/BUILD_MANUAL.md),
[maintainer guide](docs/MAINTAINER_GUIDE_KO.md) and [operations guide](docs/OPERATIONS_GUIDE_KO.md).
Official output remains unchanged in shape. Newly executed detections use policy 2;
saved cases, review revisions and shared image assets survive application restart.
Old release and acceptance records below describe their identified historical builds.
They do not certify the new candidate or replace its remaining external acceptance.

Product V2 runs a three-stage KRDS workflow: setup, live scan, and results.
The scanner processes general text owners with unique selectors in one live
page pass, using a shared deadline and bounded 1–4 workers. Results include
search/filter/page views, source and visual evidence, page outcomes, separately
stored additional analysis, and validated export. Offline Korean/English CPU
OCR analyzes selected advertisement images; cooperative cancellation preserves
validated completed results. Browser preview is explicitly a replay; Tauri
uses the real worker and session artifacts. Release acceptance remains scoped
to the candidate build; see [`docs/RELEASE_CANDIDATE.md`](./docs/RELEASE_CANDIDATE.md)
for the historical complete NSIS artifact and Gate A/B/C verdict. Earlier component
acceptance is retained in `docs/PRODUCT_V2_ACCEPTANCE.md`.

- Submission deadline: 2026-10-23 18:00 KST
- Constitution: [`KODEX.md`](./KODEX.md) (wins over temporary tasks)
- Delivery objective: [`GOAL.md`](./GOAL.md)
- Architecture: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) (current engine and Product V2 target)
- Decisions: [`docs/ADR/`](./docs/ADR/)

## Quickstart

Canonical build: Node.js 22.19.0. Supported build majors: 22.19+, 24 and 26;
the packaged worker runtime is pinned independently. See BUILD_MANUAL for Rust,
Windows tooling, explicit resource preparation and clean-source execution.

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
packages/contracts     Shared Contract v0 in code; v0.2 product design in docs (HostBridge, scan, findings, result.json)
packages/scanner       Playwright crawler (queue, selectors, live snapshots)
packages/detection     Semantic gate, 4 detectors, result engine, worker sidecar
packages/evidence      Graph, fingerprint, result_extra engine, offline CPU OCR
packages/synth-eval    Fixture server + static baseline harness
fixtures/synthetic     Deterministic evaluator site + ground truth (22 cases)
src-tauri              Tauri 2 thin host (lifecycle, export, Job-Object cleanup)
docs/                  Manuals, baselines, reviews, ADRs
```

React code must stay platform-independent: no direct Tauri imports outside
platform adapters — all native capability goes through `HostBridge`.

## Docs

- Historical release candidate: [`docs/RELEASE_CANDIDATE.md`](./docs/RELEASE_CANDIDATE.md) · Installed resources: [`docs/INSTALL_LAYOUT.md`](./docs/INSTALL_LAYOUT.md)
- Build: [`docs/BUILD_MANUAL.md`](./docs/BUILD_MANUAL.md) · Use: [`docs/USER_MANUAL.md`](./docs/USER_MANUAL.md)
- Submission plan: [`docs/PLANNING_DOC.md`](./docs/PLANNING_DOC.md) · Dry run: [`docs/DRY_RUN.md`](./docs/DRY_RUN.md)
- Detection: [`docs/DETECTION.md`](./docs/DETECTION.md) · [`docs/DETECTORS.md`](./docs/DETECTORS.md) · [`docs/ADVERSARIAL.md`](./docs/ADVERSARIAL.md)
- Pipeline: [`docs/CRAWLER.md`](./docs/CRAWLER.md) · [`docs/SELECTORS.md`](./docs/SELECTORS.md) · [`docs/SYNTHETIC_EVAL.md`](./docs/SYNTHETIC_EVAL.md)
- Product: [`docs/KRDS_COMPLIANCE.md`](./docs/KRDS_COMPLIANCE.md) · Desktop: [`docs/DESKTOP.md`](./docs/DESKTOP.md)
- Product V2 freeze: [`docs/PRODUCT_SPEC.md`](./docs/PRODUCT_SPEC.md) · [`docs/UX_FLOW.md`](./docs/UX_FLOW.md) · [`docs/SCREEN_SPEC.md`](./docs/SCREEN_SPEC.md) · [`docs/TEST_STRATEGY_V2.md`](./docs/TEST_STRATEGY_V2.md)
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
