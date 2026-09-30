# KRDS compliance log (bootstrap — Phase 11 owns the full pass)

Every UI PR must answer: pattern, tokens, custom primitives + why, keyboard,
focus, error/empty/responsive states, accessibility review.

## Bootstrap shell (`apps/web`)

- Pattern: minimal single-column task flow (start → progress → result).
  Full KRDS mapping lands in Phase 11; this shell reserves the five screens
  from GOAL §17 and must not grow a second design language meanwhile.
- Tokens: baseline CSS variables only (`--accent`, `--error`, …). No KRDS
  token import yet — open question for Phase 1/11 (official KRDS source vs
  community component library; official docs win per KODEX §32).
- Semantics: `<main>`, labelled controls, `role="alert"/"status"`,
  visible focus, table headers, `prefers-reduced-motion` guard.
- Not yet tested: keyboard-only run, screen-reader pass, responsive
  breakpoints, error/empty states beyond URL validation. All required
  before any UI milestone merges.
