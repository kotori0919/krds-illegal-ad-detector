# Windows image offer decision correction

The observed defect was a false negative after successful OCR, not an HTTPS
requirement or a failed page load. On the user-specified Blacktoon directory,
OCR read a casino high-stakes recruitment banner with 82% confidence. Its
numeric image name and opaque advertiser domain supplied neither an ad marker
nor a destination keyword. `image-only-ad-v1` ignored the independently
observed external click target, so it rejected the banner at score 2/3.

The correction admits that external click target only alongside a supported
OCR category and solicitation/promotion. It retains the 3/3 threshold,
visible-DOM equivalence exclusion and public-information semantic gate.
Category-only logos, ordinary commercial images and external links without
supported image semantics remain excluded. Advertiser destinations are not
visited. The decision is versioned `image-only-ad-v2`.

## Observed verification

The installed app on `ssh win` executed the actual safe CSV preview and
sequential public-only batch. Both targets used automatic scope: maximum
200 pages, depth 4 and 1,500 seconds per site. The production DNS transport,
HTTP/HTTPS handling and certificate validation were unchanged.

| Target | Successfully checked pages | Failed pages | Official findings | Additional image findings |
| --- | ---: | ---: | ---: | ---: |
| `https://www.blacktoonurls.com/` | 9 | 0 | 0 | 1 |
| `https://www.jjinjuso.com/` | 1 | 0 | 0 | 0 |

Blacktoon session `88762b14-511c-4710-aee5-9a157752cb01` ran at
2026-10-09 07:33:51.156–07:34:00.256 UTC (9.100 seconds).
Jjinjuso session `775e083b-7456-40e4-979b-08fc15b21adb` ran at
07:34:01.120–07:34:04.911 UTC (3.791 seconds).
The previous same-site run had zero additional findings. The corrected run
preserves the observed OCR source and exports the previously missed banner
as `IMAGE_ONLY_ILLEGAL_AD` in `result_extra.json`. The original four-technique
`result.json` still has zero findings; image-only analysis is a separate channel.
The native image disclosure confirms the same 82% OCR confidence and a passing
`image-only-ad-v2` score of 3/3, with `external-linked-image-offer` corroboration.

Both native JSON exports pass the official and additional result validators.
The native seven-sheet operational workbook contains the image finding and
all eleven OCR records. ExcelJS readback found no formula or active hyperlink
cells. The workbook was opened in the installed Microsoft Excel application.
The focused predicate, real capture/offline OCR and cross-frame regressions
pass 22 tests. Scoped detection typecheck, lint and scanner/sidecar builds pass.

## Scope and candidate

This is a correction of the demonstrated decision defect, not a measurement
of site-wide recall. Blacktoon still records bounded visual capture: six
acquired/OCR-completed images, three candidates skipped by the page byte
budget, and document/page limits reached. Some other banner text remains
poorly recognized. Jjinjuso's five acquired images complete OCR, but zero
findings do not prove the absence of illegal advertising. External directory
links are not recursively crawled as site pages.

Separate unsigned review candidate: `rc-v21-image-offer-20261009`.
Its 679 static application payload files match the icon candidate except
the corrected scanner worker. Existing UI, icon, runtime, browser, OCR assets,
official contracts and historical RC are preserved. The new installer is
identified by its artifact manifest. No merge, release publication or submission.
Historical acceptance and unchanged C1–C4 benchmarks were NOT_RUN by scope.
