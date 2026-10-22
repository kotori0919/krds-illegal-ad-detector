# Browser integration CI lifecycle correction

## Failure evidence

- **OBSERVED:** [push run 37915186649](https://github.com/snowman0919/krds-illegal-ad-detector/actions/runs/37915186649)
  failed at the combined public-network browser test after 60,004 ms. Dependency
  installation, scanner build, typecheck and lint passed.
- **OBSERVED:** [PR run 37915196236](https://github.com/snowman0919/krds-illegal-ad-detector/actions/runs/37915196236)
  passed all 362 tests; that browser test took 1,005 ms. Both checkouts had Git
  tree `db92b0837c7437fb6c883b2b48427fcb3d803727`, Node 22.23.3 and the same
  Ubuntu runner image.
- **OBSERVED:** [earlier PR run 37911194973](https://github.com/snowman0919/krds-illegal-ad-detector/actions/runs/37911194973)
  failed at the combined redirect-scope test after 30,016 ms. This predates the
  installer icon change; the CI workflow does not build an installer.

The public-network test allowed three independent scans up to 30 seconds each
inside a single 60-second test. The redirect-scope test gave its scan and its
entire lifecycle the same 30-second allowance, including setup, assertions and
browser finalization. These are concrete budget defects. Browser finalization
is awaited after the crawler's operation deadline; the native host watchdog
does not supervise these direct Vitest calls.

**NOT_REPRODUCED:** An instrumented local run on Node 22.23.3 passed the unchanged
362-test baseline. The CI logs do not identify the pending Playwright call, so
this correction does not claim to establish or repair a particular Chromium
startup, navigation or close defect.

## Correction

- Each HTTP/HTTPS private redirect and the subresource case now runs as its own
  test with one scan. Redirect scope is split into HTTP/JavaScript external
  navigation, local redirect plus external frame findings, and encoded query
  variants.
- The scan allowance remains 30 seconds. Each browser test has a 60-second
  outer allowance for setup, one scan, browser finalization and assertions.
  The global test deadline and worker count are unchanged.
- Each test owns fresh HTTP servers, request lists and connection counters.
  Vitest fixture teardown stops listeners before destroying connections, also
  when an assertion fails. Test cancellation is passed to the real crawler;
  fixture sockets are destroyed on cancellation.
- Private targets must still receive zero connections. Redirect tests now
  reject a timeout as a substitute for a policy/navigation denial. Official
  findings, exact page counts, external-document exclusion, frame findings and
  distinct query visits remain asserted against real Chromium execution.

No retries, skipped tests, production network exceptions or runtime changes
are introduced. The official JSON contract and installer candidate are
unchanged.

## Local verification

Use Node 22.23.3 and the installed Chromium headless shell:

```sh
npm run build:scanner
npm run typecheck
npm run lint
npm run test
npm run build
```

The focused browser command is:

```sh
npx vitest run packages/scanner/test/public-network.test.ts packages/scanner/test/redirect-scope.test.ts
```

**OBSERVED:** The focused command passed 14 tests across both files using real
Chromium and owned HTTP fixtures. Public-only proxy enforcement was exercised
without contacting an external website or weakening production policy.

**OBSERVED:** The complete command sequence above passed on Node 22.23.3:
scanner build, typecheck, lint, all 367 tests in 59 files, and the web build.
The web build retained its existing advisory about a chunk larger than 500 kB.
Dependency reinstallation was not repeated locally; GitHub CI performs its
normal clean `npm ci` and Chromium installation on the pushed revision.

## Serialized package test files

Two `verify` failures shared one 4-vCPU runner: an animated GIF frame was
missing from a visual capture, and `packages/evidence/test/image-embedding.test.ts`
reported `OCR recognition failed`. The OCR worker had produced valid evidence;
under CPU starvation its cold ONNX session plus first inference reported
`elapsedMs` above the contract's 8 s text window, which `LocalOcrBackend`
converts to `OCR recognition failed`.

**CORRECTION:** `vitest.config.ts` sets `fileParallelism: false` (a run-level
Vitest option, not a per-project one) so a file owns the runner while it
launches Chromium and 1.3 GiB of ONNX sessions. No retries, skips, or assertion
changes are introduced.

**OBSERVED:** With serialized files, `npm run check` passed 704 tests on two
pinned CPUs (241 s wall) and on the full host (194 s wall), and the focused
`visual-candidates` + `image-embedding` pair passed under a 5 GB cgroup cap.
The CI failure itself was **NOT_REPRODUCED** locally; the local model assets were
warm and the reported mechanism was confirmed with an oversubscribed core.
