# Windows icon and user scan follow-up

Candidate: `rc-v21-icon-wincheck-20261009`, on `dev/bootstrap`; PR #2 stays Draft.
The candidate manifest records its source commit. It is separate from the
visibility candidate, accepted V2.1 checkpoint and historical RC.

## App icon

The supplied image was cropped for the app icon and converted with `tauri icon`.
`src-tauri/icons/icon.png` is 512x512; `icon.ico` contains 16, 24, 32, 48, 64 and
256px images. **OBSERVED:** the release build and the installed app on the actual
`ssh win` computer show the new icon in the native title bar.

The extracted installer contains all 679 static manifest files. Compared with
the visibility candidate, only `krds-detector.exe` has a different hash; the
bundled scanner, browser, OCR resources and all other runtime files are equal.
The official JSON contract, grouping, safe imports and public-only batch policy
are unchanged. No C1-C4 benchmark or full historical acceptance was repeated.

## The reported zero findings

**OBSERVED:** cua-driver inspected the user's existing result, without starting
another scan of that site. `https://newtoki1.org/` had zero successfully checked
pages, one failed page, zero findings and a navigation issue. Native XLSX Save As
preserved that session in `Documents/KRDS-newtoki1-failed-20261009.xlsx`. The
saved six-sheet report has HTTP status 0, reason `access-navigation` and the
Korean outcome `페이지 연결 실패`.

The original session did not retain the underlying browser error. Separate
bounded connection diagnostics on the same Windows computer observed:

| Connection | Target address | Control address, example.org |
| --- | --- | --- |
| DNS | Public IPv4 resolved | Not required for this comparison |
| Windows curl HTTPS | `curl: (35) Recv failure: Connection was reset` | HTTP 200 |
| App's bundled Chromium HTTPS | `net::ERR_CONNECTION_RESET`, before document commit | HTTP 200 |

The original page was never analyzed. **INFERRED:** current connection resets
are consistent with its navigation failure; the specific server or network
intermediary responsible has not been established. The target's advertisement
detection is **NOT_RUN**, because no document was obtained. TLS, challenge and
network policy were not bypassed, and no automatic retry was added.

**OBSERVED:** a separate app instance on the same computer used the real ordinary
single-URL workflow against an owned loopback HTTP page, with maximum pages 1.
The native UI reported one checked page, zero failures and one `TRANSPARENT`
finding for `카지노 첫충 보너스 지급`. This checks the positive detector path; it
is not a claim that the unreachable public site's contents were inspected.

After the user's result was saved, the original app was closed through
cua-driver. Its executable was backed up, the icon-only executable replaced it,
and the installed app was relaunched through cua-driver. Runtime resources
were retained. The observed executable SHA-256 is
`d6dc48ea27fecd99e3a6b154a7455c8f30dbed72067eb35a5545ff5177e5423a`.

## Real spreadsheet application

**OBSERVED:** this actual user computer has Microsoft Excel (Office16). Through
cua-driver, Excel opened the unchanged seven-sheet workbook produced by the
visibility candidate's successful Windows public batch for example.org and
example.com. Its SHA-256 is
`2c6e32b2873618242af49dda0e1df2fe5de4bce0efd652b5c5a2f61f5770b0e8`.
The Korean summary and target worksheets rendered in Excel, with no repair
prompt. This completes the previously unavailable application-opening check
on this newly available environment; it does not change the earlier guest's
NOT_RUN record or rerun the batch.

Candidate artifacts and inspected native screenshots:
`/home/monad/.codex/artifacts/illegal-ad/rc-v21-icon-wincheck-20261009`.
Installer SHA-256:
`528a4b23a72ae44325df926fbd75c307c459707fbc6e7bfeaeb610760f985614`.
Unsigned user-review candidate only; no merge, release publication or submission.
