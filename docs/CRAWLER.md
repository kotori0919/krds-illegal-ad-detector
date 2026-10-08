# Bounded crawler and access coverage

Production navigation uses the Playwright API in `packages/scanner`. One
monotonic `ScanDeadline` covers browser startup, HTTP discovery, navigation,
settle, live detection, optional evidence and finalization. The fixed worker
pool remains bounded to 1–4 top-level pages. Each admitted page is navigated
once; live frames and selected image responses remain available to detection
before the page closes.

## Modules and admission

- `urls.ts`: canonical fragment/query-order/trailing-slash deduplication;
  different query values remain distinct. Navigation uses the exact host,
  including port, as its same-site boundary.
- `queue.ts`: breadth frontiers and a complete-frontier discovery merge.
  All normalized candidates are sorted before `maxPages` admission, including
  links and sitemap candidates. Completion timing never chooses the admitted
  set. A link wins a same-depth duplicate's discovery-source tie.
- `access.ts`: measured page-access classification and bounded `Retry-After`.
- `sitemap.ts`: streamed, sequential HTTP discovery and robots exclusions.
- `crawl.ts`: the live-page worker pool, containment, access classification,
  deterministic frontier merge, optional snapshots and cancellation cleanup.

Sitemap pages enter at crawl depth 1. They share `maxPages`, `maxDepth`,
canonical deduplication and the same deadline with ordinary links. Depth 0
or `maxPages: 1` skips sitemap fetching, while still reading robots policy.
Snapshots/outcomes record `discoverySource: entry | link | sitemap`.

## Access limitations

`PageSnapshot.issue` and persisted `PageOutcome.issue` carry `kind`,
`retryable`, and an optional `retryAfterMs`. Kinds are `challenge`, `denied`,
`rate-limit`, `login-required`, `timeout`, `navigation`, and `unknown`.

`cf-mitigated: challenge` takes precedence over status, including HTTP 200,
403 and 429. A Cloudflare `Server` or `cf-ray` proxy header alone is not
challenge evidence. The fallback requires both an interstitial challenge
title and a challenge DOM marker. HTTP 429 is rate limiting; 401/407 and an
actual password form on a login-titled document indicate login requirement;
403/451 indicate denied access. Other HTTP failures and navigation errors
remain navigation limitations. Per-page timer or Playwright timeout becomes
`timeout`; an unexpected analysis error is `unknown`.

Every issue page is failed even when its HTTP status is 200. It never enters
live detection or supplies frontier links. Failed/blocked documents do not
inflate `checkedPages` or create a claim that the page has zero violations.
All-blocked and pre-admission deadline scans preserve an empty valid official
result together with measured zero checked coverage and any failed outcomes.
The operator must read that coverage as uninspected/limited rather than a
successful zero-finding check. Official result fields and serialization do
not change.

`Retry-After` accepts non-negative integer seconds or HTTP-date. The recorded
and observed pause is bounded to 5,000 ms. Subsequent same-site page starts
wait for the pause if the shared deadline can preserve useful work and its
finalization reserve; cancellation interrupts the wait. Already-running
workers may complete. The failed URL is never automatically retried.
A discovery HTTP 429 stops further discovery requests and applies the same
bounded pause before page navigation. No CAPTCHA solving, credential entry,
proxy rotation or other access evasion is performed.

## Sitemap and robots boundaries

Discovery reads same-origin `/robots.txt`, its same-origin `Sitemap:`
declarations and same-origin `/sitemap.xml`. It accepts `urlset` and nested
`sitemapindex`. Roots, children, page locations and redirect targets must
remain on the exact entry origin; credentials and non-HTTP(S) URLs are
rejected. Redirects are manual and gated before any follow-up request.
Cycles and canonical duplicates are skipped.

| Boundary | Limit |
| --- | --- |
| Discovery duration | 5,000 ms, additionally capped by the shared deadline |
| One HTTP operation, including redirects/body | 2,000 ms |
| Sitemap documents attempted | 8 |
| Nested index depth | 2 below a declared/default root |
| Pending sitemap documents | 800 |
| Sitemap page candidates | 1,000 |
| Sitemap document body | 512 KiB |
| All discovery bodies combined, including robots | 2 MiB |
| Robots body | 128 KiB |
| Redirects per HTTP operation | 3 |
| Sitemap location length | 2,048 characters |

Body limits apply to streamed decoded bytes, including responses without
`Content-Length`. Oversized, malformed, multi-root, DTD/ENTITY-bearing and
custom-entity XML is discarded. Standard XML escaping such as `&amp;` and
numeric character references is supported. No external XML entity is loaded.
Unsupported non-XML sitemap formats and gzip files without HTTP transport
decompression are skipped. Discovery failure does not manufacture a checked
page or an invented sitemap page outcome.

The crawler identifies as `KrdsDetector`. Matching product-token robot groups
take precedence over wildcard groups. Longest matching Allow/Disallow rule
wins, with Allow winning a tie. Wildcards, end anchors, UTF-8/percent-encoded
octets and query paths are matched without attacker-supplied backtracking
regexes. Parsed exclusions gate both links and sitemaps; an explicitly entered
excluded page is retained as a denied attempt without navigation. An
unavailable/unparseable robots response contributes no invented rules.

## Containment

Popup/dialog suppression, download cancellation, HTTP(S)-only routes,
500 requests/page, media/font throttling, per-page budgets, parsed-document
settle windows, bounded frame inspection and browser cleanup remain. Optional
HTML/frame copies yield to live detection and the scan deadline. External
infrastructure is observed, never recursively admitted.

## Observed verification

Local HTTP fixtures run the real Playwright crawler and streamed discovery:
header/body challenges, ordinary Cloudflare proxy responses, 403, redirected
login, bounded 429 pause without retry, navigation socket failure, timeout,
robots longest-match/user-agent/octet rules, nested indexes, cycles,
external roots and redirect rejection, DTD/custom entity rejection, malformed
XML, canonical traversal equality at workers 1 and 4, streamed/aggregate byte
limits, document/URL/depth caps, slow discovery and cancellation. Existing
worker-pool and shared-deadline tests verify the four-page cap and reserve.

Current scoped commands are:

```sh
npx vitest run packages/scanner/test/access-sitemap.test.ts packages/scanner/test/sitemap-bounds.test.ts packages/scanner/test/queue.test.ts packages/scanner/test/worker-pool.test.ts packages/scanner/test/deadline.test.ts
npx vitest run packages/scanner/test/scan-access.test.ts packages/detection/test/deadline-scan.test.ts
```

The second command also exercises genuine `scanSite` persistence: a challenge
body containing illegal-ad text must produce no detector finding, zero checked
pages and a retained failed HTTP 200 outcome. It requires the current scanner
and contracts builds. The immutable RC artifacts and historical measurements
are unchanged; these checks do not establish installed Windows acceptance.

## Protocol sources

- [Cloudflare challenge-response header](https://developers.cloudflare.com/cloudflare-challenges/challenge-types/challenge-pages/detect-response/)
- [Sitemaps XML protocol](https://www.sitemaps.org/protocol.html)
- [HTTP Retry-After semantics](https://www.rfc-editor.org/rfc/rfc9110.html#name-retry-after)
- [Robots Exclusion Protocol](https://www.rfc-editor.org/rfc/rfc9309.html)
