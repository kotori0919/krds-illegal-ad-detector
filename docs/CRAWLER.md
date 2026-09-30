# Crawler (Phase 3)

Production crawler on the Playwright API (`packages/scanner`).

## Modules

- `urls.ts` — normalization (fragment drop, query-order sort, values kept),
  same-site gate (exact host), `contentKey` (FNV dual-hash) dedup.
- `queue.ts` — BFS `CrawlQueue`: depth/page/deadline bounds, visited-key +
  content-hash dedup, externals observed (never enqueued).
- `crawl.ts` — `crawlSite()`: one browser context, popup/download
  suppression, per-request caps (500 req/page, media/font throttle), per-page
  budget + global deadline, fixed settle clock from navigation start,
  live-DOM snapshot (`page.content()`), `page.frames()` capture, absolute
  link/iframe-src resolution.

## OBSERVED (synthetic fixtures, this machine)

- Hub crawl: all hub-linked pages discovered; `board?id=101/102` distinct;
  `notice?ref=main` flagged `duplicateContent`; no timeout.
- Nested iframe: `middle.html` + `inner.html` captured with absolute URLs;
  inner HTML contains `ad-frame-jamo`.
- Delayed injection: `id="ad-delayed-injected"` present at settle 1800 ms,
  absent at settle 0 (element selector, not script-text match).
- Query page: `ad-query-hg` executed in live DOM.
- Full suite: 7 files / 50 tests passed; typecheck/lint/build clean.

## Safeguards (hostile pages)

Init-script popup block (`window.open → null`, dialogs neutered), opener
popups auto-closed, downloads cancelled, non-http(s) requests aborted,
`waitUntil: "commit"` + fixed settle (no networkidle stall), per-page
`min(perPageMs, remaining-500)` budget, `maxBodyBytes` 4 MiB cap.

## Limits

- Frame `srcChain`/`selectorChain` are single-level today; nested `>>>`
  serialization belongs to the Phase 4 selector engine.
- No redirect-chain suite yet (fixtures lack a redirect case); externals
  classified link/iframe/resource/redirect at observation time.
