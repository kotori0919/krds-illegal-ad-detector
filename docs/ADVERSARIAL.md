# Adversarial evaluation (Phase 21 — OBSERVED 2026-10-01, depth sweep +1)

## Depth sweep (this turn)

- Probed: space/hyphen/underscore splits, fullwidth latin (ＣＡＳＩＮＯ),
  spaced latin, zero-width inserts, mixed Jamo, crawler case/dup edges.
- Found + fixed: hyphen-split (카-지-노) fired no technique — fold now
  strips `-` for matching and the split-signal includes it; fixture
  `#adv-hyphen` + regression expectation added (now 9/9).
- Deliberately NOT fixed: space-split technique signal (precision — normal
  Korean is full of spaces; gate already folds them for matching, so
  카 지 노 still matches post-fold when other evidence corroborates);
  underscore-Jamo without ad terms (gate correctly silent); zero-width
  inserts (extras channel, not official technique).
- Crawler edges: case-sensitive paths stay distinct (correct — servers may
  differ); fragment/trailing-slash/dup-query collapse verified; hub crawl
  bounded at 14 pages with ref/index dup flags (15 after comments page).

---

| Attack | Detector | Verdict |
|---|---|---|
| Cyrillic/Latin mix (Сasino) | HOMOGLYPH | FIRES |
| Punctuation split (카.지.노) | HOMOGLYPH | FIRES (fixed this phase) |
| Digit substitution (C4sino) | HOMOGLYPH | FIRES (fixed this phase) |
| Mixed syllable/Jamo (카ㅈㅣ노) | JAMO | FIRES (fixed this phase) |
| Ancestor opacity:0 | TRANSPARENT | FIRES (pre-existing chain walk) |
| Offscreen transform | OFFSCREEN | FIRES (pre-existing matrix check) |
| Clip-path micro box | OFFSCREEN | FIRES (pre-existing) |
| Overflow-hidden micro box | OFFSCREEN | FIRES (pre-existing) |
| Transparent animation, no ad text | — | SILENT (correct) |
| Latin brand, no ad semantics | — | SILENT (correct) |
| Hyphen split (카-지-노) | HOMOGLYPH | FIRES (depth sweep) |
| All 7 negatives.html cases | — | SILENT (no regression) |

## Fixes (all with regression coverage)

1. Punctuation-split + leet folding in `normalizeForMatch` (match-only;
   raw always preserved).
2. `homoglyphSignal` fires on split/leet patterns (evasion-split detail).
3. Latin `casino` + `무료체험` fallback terms (cover obfuscated ads whose
   Korean terms are all split).
4. Mixed decomposed Jamo: NFKC fold-shrink rule (fires 카ㅈㅣ노, silent
   ㅋㅋㅋ laughter — first attempt over-fired, corrected with length check).

## Open (documented, not fixed)

- Redirect-chain fixture: no redirect case in fixtures; crawler classifies
  redirect externals at observation time. Needs a fixture + test if the
  evaluator emphasizes it.
- Dynamic style changes (ad becomes transparent after 5 s): settle window
  covers ≤ settleMs; longer delays are a known recall boundary.
