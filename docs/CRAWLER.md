# Bounded crawler and access coverage

Production navigation uses the Playwright API in `packages/scanner`. One
monotonic `ScanDeadline` covers browser startup, HTTP discovery, navigation,
settle, live detection, optional evidence and finalization. The fixed worker
pool remains bounded to 1–4 top-level pages. Each admitted page is navigated
once; live frames and selected image responses remain available to detection
before the page closes.

The canonical policy is `packages/contracts/src/policy.json`. The default
pool is two workers on every machine; explicit benchmark/operator selections
remain bounded to 1–4. Policy 2 removes the previous CPU-dependent default so
saved effective settings describe the actual worker pool.

## Modules and admission

- `urls.ts`: canonical fragment/query-order/trailing-slash deduplication;
  different query values remain distinct. Navigation uses the exact host,
  including port, as its same-site boundary.
- `queue.ts`: breadth frontiers and a complete-frontier discovery merge.
  All normalized candidates are sorted before `maxPages` admission, including
  links and sitemap candidates. Completion timing never chooses the admitted
  set. A link wins a same-depth duplicate's discovery-source tie.
- `access.ts`: measured page-access classification and preserved `Retry-After`.
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
`rate-limit`, `login-required`, `timeout`, `navigation`, `network-policy`, and
`unknown`.

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
pause preserves the server interval, including 120 seconds. Subsequent same-site page starts
wait for the pause if the shared deadline can preserve useful work and its
finalization reserve; cancellation interrupts the wait. Already-running
workers may complete. The failed URL is never automatically retried.
A discovery HTTP 429 stops further discovery requests and applies the same
pause before page navigation. When the delay cannot fit the shared deadline,
queued pages remain uninspected and the scan ends with partial coverage.
The server delay is never shortened to fit. No CAPTCHA solving, credential entry,
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

Production explicitly launches with `chromiumSandbox: true` and no disabling
argument. Isolation failure stops the scan with a useful Korean error and
does not retry insecurely. This Linux host cannot create the required
sandbox; only controlled Vitest fixtures use the explicit
`KRDS_TEST_UNSANDBOXED=1` opt-in in `tests/browser-fixture.ts`. The worker,
CLI and UI never read that flag. Installed Windows renderer-isolation and
cleanup acceptance remain external checks on the identified candidate.

Collection limits apply before constructing retained data: 20,000 discovery
elements, 1,000 links (2,048 characters each), 15 frames, bounded frame depth,
500 external records/page and 10,000 unique external records/scan. Requests
are counted without retaining an unbounded URL array. Optional DOM replay is
serialized incrementally with node/depth/attribute and UTF-8 byte caps, never
by collecting full `page.content()` then slicing it. Main and frame snapshots
share the requested byte limit (maximum 4 MiB); live production analysis keeps
only a 64 KiB content signature and releases it after deduplication. Omissions
are explicit collection issues. Browser-owned DOM/network memory remains
outside these retained-data caps.

Rendering collection distinguishes glyph Range rectangles from container
boxes; observes alpha, solid composited ancestor backgrounds, opacity,
visibility, overflow and inset clipping, including frame owners. It bounds
each candidate to 512 text nodes, 128 rectangles and 64 ancestors. Gradients,
unsupported color/clip/compositing and limits are uncertainty, not proof of
concealment. Normal content below the viewport is not offscreen evidence.

OBSERVED: Chromium collection matrix varies DOM (100/25,000), frames (0/24)
and resources (0/600) independently. Whole test-host/browser-descendant RSS
was sampled every 25 ms; one run per row does not establish percentiles or
a memory guarantee. `collection-bounds.test.ts` emits reproducible individual
measurements and can save them with test-only `KRDS_COLLECTION_REPORT`.

Popup/dialog suppression, download cancellation, HTTP(S)-only routes,
500 requests/page, media/font throttling, per-page budgets, parsed-document
settle windows, bounded frame inspection and browser cleanup remain. Optional
HTML/frame copies yield to live detection and the scan deadline. External
infrastructure is observed, never recursively admitted.

## Imported-target runtime network boundary

Imported sessions set `CrawlOptions.publicNetworkOnly` through worker
`--public-network-only`. A manually entered private/loopback URL authorizes
only that exact scheme, host and port, pinned to its initially validated
address. It does not authorize another intranet origin. Public destinations
remain available through the same checked, pinned transport. Link-local,
metadata, multicast, reserved and mixed public/private answers are denied
even for a manual entry. Denials appear as `network-policy` failed navigation
or a `network-policy-denied` resource collection issue; a resource omission
does not manufacture a checked finding.
The worker accepts `--entry-kind site|sitemap`; a sitemap
input is fetched as the first XML/index discovery seed, never checked as HTML.
Its discovered pages start at depth 0 and share the configured page limit.
The official `meta.entry_url` remains the original sitemap input. A sitemap
with no admissible page URLs produces an explicit discovery error.

`public-network.ts` owns an authenticated HTTP/CONNECT proxy bound only to
`127.0.0.1`. Random per-scan credentials remain in process memory and are
removed before forwarding origin requests. Each upstream connection resolves
all DNS answers, applies the public/manual-entry scope, and connects to one validated
IP without another DNS lookup. Existing connections remain pinned; new
connections revalidate DNS. Redirects, frames and HTTP/HTTPS subresources use
the proxy too. Chromium's implicit localhost/link-local proxy bypass is
disabled; direct browser DNS resolution, QUIC and non-proxied WebRTC UDP are
disabled, and service workers are blocked. Proxy sockets close on cancellation
and the shared deadline. Unsupported proxy upgrades are rejected.

Public sitemap HTTP uses the same address policy and a pinned Node lookup,
manual redirects, no connection pool, normal TLS certificate validation and
identity content encoding. It never falls back to unrestricted global fetch.
Literal addresses and all DNS answers are checked, including IPv4-mapped IPv6,
loopback, private, shared-address, link-local/metadata, multicast, documentation,
transition and reserved ranges. IPv6 is conservatively limited to eligible
global-unicast `2000::/3` allocations.

Network bounds are 64 tracked proxy sockets, 32 DNS answers, 2 seconds per
DNS operation, 20 seconds socket idle time, 16 KiB HTTP headers, plus the
existing shared deadline and sitemap body/time limits. DNS failure, mixed
unsafe answers and unsupported addresses fail closed. The proxy has no direct
connection fallback.

Owned-fixture smoke code can pass `networkPolicy` using
`PublicNetworkPolicy.forFixtureTargets([{ origin, address: "127.0.0.1" }])`
(or address `"::1"`). Bindings match exact scheme, host and explicit port,
connect to the supplied loopback address without system DNS, and authorize
no other origin. `forFixtureOrigins` is the literal-loopback convenience.
`networkPolicy` also carries the worker's original authorization into crawl.
Preparation never recreates a manual-entry policy: an initially owned address
remains pinned, while an initially public origin continues to reject private
or mixed DNS answers at every request. Its deferred public transport stays
closed until the managed runtime is ready. Policies and resolver injection
are trusted programmatic APIs; neither is accepted by UI input, native
arguments or the worker CLI.

OBSERVED: real Chromium fixtures prove that HTTP and HTTPS redirects,
image/iframe/fetch resources, localhost names and mapped-loopback URLs cause
zero TCP connections to an unbound protected origin. A controlled resolver
changes an initially public answer to loopback before runtime requests; actual
navigation is denied without reaching that fixture. Exact bound DNS-like
origins work through the proxy and pinned Node discovery. Real `scanSite`
processes two pages from an exact nested sitemap input, retaining the original
official entry URL and excluding the XML from checked coverage.

This boundary is application transport enforcement, not an OS network
sandbox. Browser exploits and platform/browser changes require independent
containment and installed-Windows validation. The conservative address policy
may reject unusual legitimate special-purpose addresses. A public server's own
internal routing is outside the scanner's socket boundary.

## Retained evidence and visual selection

All admitted pages receive cheap visual candidate observation while live.
Acquired image bytes share a 250,000-byte page budget. A stable risk/hash
ordering retains at most 40 unique creative assets, 64 occurrence records and
2,000,000 bytes across the scan. Six unique images are selected for optional
OCR after crawling, with page diversity; selection never revisits a page or
uses completion order as its priority. Coverage records retained assets,
bytes, excluded records and selected SHA-256 values. A bounded selection is
not a guarantee that every image was analysed.

Page/element captures share a separate 24-asset, 2,000,000-byte JPEG store.
Finding metadata references `visualAssets` by asset ID; identical capture
bytes are stored once. Creative occurrences likewise reference shared image
assets. Evicted captures become explicit unavailable evidence. HTML replay
is omitted unless the caller explicitly requests snapshots.

Official raw candidate evidence has a separate aggregate 4 MiB UTF-8 budget
and a 20,000-occurrence cap. The bound applies before long-lived insertion;
whole candidates are excluded, never shortened. `FINDING_COLLECTION_LIMIT`
marks every affected page, including an earlier page whose retained candidate
is displaced. Auxiliary zero-width source evidence uses its own equal cap
and reports `AUXILIARY_TEXT_COLLECTION_LIMIT`. Progress distinguishes observed
candidates from retained confirmed findings. A checked page with a collection
issue has limited coverage and must not be read as a complete zero-finding
inspection. Graph construction independently stops insertion at 4,000 nodes
and 8,000 edges and exposes `truncated`.

Optional timing records worker start, official finalization and completion
of OCR shutdown, graph construction and detail validation. It excludes the
worker's final output serialization, native persistence and operator Save As;
installed acceptance must measure those steps separately.

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

## Pinned upstream transport

`PublicNetworkPolicy`는 모든 DNS 응답을 검증한 뒤 선택한 숫자 IP를
`PinnedTransport.open`에 전달한다. 브라우저 HTTP, HTTPS CONNECT와 Node의
Sitemap 요청이 같은 경계를 사용한다. upstream CONNECT에도 숫자 IP를 보내며
원래 Host/SNI와 인증서 검증을 유지하고 프록시 인증을 목적지에 전달하지 않는다.
공급된 전송이 실패하면 직접 연결로 전환하지 않는다. 정확히 허가된 소유 원점은
직접 연결을 유지한다. 전송을 생성한 세션이 `close()`를 호출하며, 개별 브라우저
요청의 취소는 아직 HTTP agent에 넘기지 않은 연결까지 정리한다.

## Protocol sources

- [Cloudflare challenge-response header](https://developers.cloudflare.com/cloudflare-challenges/challenge-types/challenge-pages/detect-response/)
- [Sitemaps XML protocol](https://www.sitemaps.org/protocol.html)
- [HTTP Retry-After semantics](https://www.rfc-editor.org/rfc/rfc9110.html#name-retry-after)
- [Robots Exclusion Protocol](https://www.rfc-editor.org/rfc/rfc9309.html)
- [Chromium proxy and implicit bypass policy](https://chromium.googlesource.com/chromium/src/net/+/HEAD/docs/proxy.md)
- [Playwright network/proxy/service-worker behavior](https://playwright.dev/docs/network)
- [Node HTTP request and lookup options](https://nodejs.org/api/http.html#httprequestoptions-callback)
