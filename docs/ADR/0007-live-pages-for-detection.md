# ADR-0007: Live pages for detection, snapshots for discovery

Status: accepted.

## Context

Crawler snapshots are static HTML strings — computed style and geometry are
unavailable. Detecting off the snapshot would reduce TRANSPARENT/OFFSCREEN
to CSS-string matching, violating docs/DETECTION.md §5–6.

## Decision

- Crawler owns discovery (BFS, dedup, hostile guards, frame enumeration).
- Detection owns live pages: per discovered URL a fresh page navigates,
  settles, and runs Unicode + computed-style/geometry analysis.
- Frame ads detect against each frame URL with the crawler's ancestor chain
  (parentFrame + frameElement), not by re-crawling external sites.
- Leaf-only `[id]` extraction: containers wrapping id descendants are
  skipped so `textContent` aggregation cannot double-fire.

## Consequences

- End-to-end cost ≈ crawl + one live pass per page; acceptable inside the
  30-minute budget on the fixture scale (52 s for 14 pages incl. settles).
- Phase 20 benchmarks the full-scale timing claim on larger graphs.
