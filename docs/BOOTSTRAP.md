# Bootstrap verification record (Phase 0)

Date: 2026-09-30. Branch: `dev/bootstrap`. Tracking: issue #1.

## OBSERVED (local, this machine)

- `npm ci`: clean install (vite 8.3.1, plugin-react 6.1.1, react 19, vitest 3.2.7).
- `npm run typecheck` (`tsc -b` + `tsc --noEmit -p packages/contracts/tsconfig.check.json`): clean.
- `npm run lint` (`eslint .`): clean.
- `npm run test` (`vitest run`): 3 files / 21 tests passed
  (`result.test.ts` 17, `selector.test.ts` 3, `technique.test.ts` 1).
- `npm run build` (`tsc -b && vite build`): clean, 28 modules,
  `dist/index.html` 0.41 kB, CSS 1.22 kB, JS 226.17 kB (pre-gzip; gzip 71.20 kB).

## Remote state

- Private repo: `snowman0919/krds-illegal-ad-detector`.
- Branches: `main` (initial commit), `dev/bootstrap` (this record + badges).
- CI: `.github/workflows/ci.yml` runs typecheck + lint + test + build on
  push/PR (ubuntu-latest, Node 22, `npm ci`).

## Open questions for Phase 1

- Contract v0 freeze may reshape shared types (`packages/contracts/src`).
- KRDS official token source mapping (official docs win over community libs).
- Synthetic evaluator fixtures (Phase 2) must precede detector tuning.
