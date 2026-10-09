# Codex review a3b08c10b8 corrections

This follow-up addresses the three findings in PR #2 review 5458984809.
The existing M1-M5 implementation, image-offer correction, official result
schema, grouping membership and public-only production transport are retained.

| Review finding | Correction | Observed regression evidence |
| --- | --- | --- |
| 4220862134: host kills at the worker deadline | Native supervision waits for `min(worker budget + 150 s, 1650 s)`; the worker budget is unchanged | A real child writes its artifact after a 1 s worker budget. Before: host killed it at 1 s. After: artifact survives and the child exits successfully after 2 s. Boundary checks cover 60, 600, 1500 and overflow inputs. |
| 4220862144: external redirect content attributed to the queued URL | Recheck the entry host, including port, after navigation, parsing, settling and before live detection; retain the final URL and observed redirect with `external-redirect` failure | Real HTTP and script redirects to another local server produce failed page outcomes and no findings. A same-host redirect still produces its finding; an external iframe still produces its original frame finding. External links are not recursively requested. |
| 4220862157: decoded query delimiters collide | Serialize sorted query pairs through `URLSearchParams` | Encoded `&`/`=`, literal plus signs, duplicate values and Unicode remain distinct or equivalent as appropriate. Both `?a=b%26c%3Dd` and `?a=b&c=d` are actually visited by the crawler. |

## Verification

- OBSERVED: 28 tests passed across seven focused scanner/detection files:
  `urls`, `queue`, `redirect-scope`, `scan-access`, `access-sitemap`,
  `public-network` and `single-pass`. The redirect test executes the real
  scanner, detector and official result validator over two local HTTP servers.
- OBSERVED: two native watchdog regressions passed, including real process
  startup, delayed artifact writing and successful exit through the same
  supervision method used by the application.
- OBSERVED: the bundled worker executed through native supervision over the
  realistic fixture. Five official findings, evidence assets and progress
  survived validation and host persistence; foreign/path assets were denied.
- OBSERVED: scanner and sidecar builds, scoped scanner typecheck, scoped lint
  and Windows GNU LLVM release build passed.
- NOT_RUN: an elapsed 1650 s watchdog expiry. Its cap is covered by boundary
  tests; no 27.5-minute timing claim is made.
- NOT_RUN: installing or running this follow-up candidate on Windows. This
  review correction uses Linux real-process/browser execution and a Windows
  cross-build. Prior Windows batch and Excel observations remain recorded in
  `WINDOWS_IMAGE_OFFER_FIX.md`; they are not attributed to this candidate.
- NOT_RUN: unchanged C1-C4 benchmarks and full historical acceptance, as
  requested.

## Review candidate

Separate unsigned candidate: `rc-v21-review-a3b08c1-20261009`, with installer
and payload hashes recorded in its artifact manifest. It includes the current
image-offer correction and these review fixes. Previous candidates and the
historical RC are preserved. PR #2 remains Draft; no merge, publication or
submission.
