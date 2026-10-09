import { lstat, rm } from "node:fs/promises";
import { join } from "node:path";

// Empty host-validation cache is recreated by a real Windows browser launch.
// It is not a runtime input or acceptance evidence shipped to another host.
const markers = [
  "ms-playwright/chromium_headless_shell-1243/DEPENDENCIES_VALIDATED",
  "ms-playwright/ffmpeg-1011/DEPENDENCIES_VALIDATED",
  "ms-playwright/winldd-1007/DEPENDENCIES_VALIDATED",
];

export async function clearBrowserValidationCache(directory) {
  for (const marker of markers) {
    let path = directory;
    let missing = false;
    let metadata;
    for (const part of ["", ...marker.split("/")]) {
      path = join(path, part);
      try { metadata = await lstat(path); }
      catch (error) { if (error.code === "ENOENT") { missing = true; break; } throw error; }
      if (metadata.isSymbolicLink()) throw new Error("Browser validation cache symlink rejected");
    }
    if (missing) continue;
    if (!metadata.isFile() || metadata.size !== 0) throw new Error("Unexpected browser validation cache content");
    await rm(path);
  }
}
