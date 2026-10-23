# Windows installer download icon

The installer now uses the existing application mark with a blue download
badge. `bundle.windows.nsis.installerIcon` points to `icons/installer.ico`.
The installed application's original icon remains unchanged.

## Assets and generation

- `src-tauri/icons/installer.png`: 512x512 RGBA master for this variant.
- `src-tauri/icons/installer.ico`: 16, 24, 32, 48, 64 and 256px frames,
  converted with the existing Tauri icon CLI.
- Edit input: `src-tauri/icons/icon.png`.
- Mode: built-in imagegen edit, with the existing white background retained.

Final generation prompt:

> Use case: precise-object-edit. Asset type: Windows installer executable icon.
> Input image 1 is the existing application icon and edit target. Preserve the
> blue browser, magnifying glass, orange crossed-out AD, shield and white
> rounded-square tile exactly, with the same proportions and polished soft 3D
> style. Add only a prominent download badge overlapping the lower-right corner
> of the tile, partially covering the bottom of the shield: a blue circular
> badge with a crisp thick white downward arrow entering a white horizontal
> tray. The badge should occupy about 30 percent of the canvas width, readable
> at small Windows icon sizes, and use a subtle white rim to distinguish it
> from the blue shield. Keep all existing elements visible enough to identify
> the app. Square composition. No new text, no watermark, no extra objects.
> Preserve the existing white background and rounded tile. This is a
> download/install variant; do not redesign the base app mark.

## Verification and candidate

- OBSERVED: Tauri's NSIS bundle command succeeds with the explicit installer
  icon. Every ICO frame decodes at its declared size.
- OBSERVED: on the actual `ssh win` computer, Windows
  `System.Drawing.Icon.ExtractAssociatedIcon` reads the new installer icon.
  Its 32px bitmap exactly matches the corresponding ICO frame, pixel for
  pixel. The returned PNG was visually inspected.
- OBSERVED: all 679 static application payload files have identical size and
  SHA-256 to `rc-v21-review-a3b08c1-20261009`. The existing host, app icon,
  scanner, browser and OCR runtime are preserved.
- NOT_RUN: executing or installing the new installer; the Windows check reads
  its icon without launching it. Detection and historical acceptance are not
  repeated for this packaging-only change.

Separate unsigned candidate: `rc-v21-installer-icon-20261009`. Its manifest
records the source commit, installer hash, payload comparison and Windows
icon check. Earlier candidates and historical RC remain intact. PR #2 stays
Draft; no merge, release publication or submission.
