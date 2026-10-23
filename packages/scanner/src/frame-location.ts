import type { ElementHandle, Frame, Page } from "playwright-core";
import { parseFrameLocation } from "@krds-detector/contracts";

/** Resolve a stored location within the already-open top-level document.
 * Never navigates and rejects an ambiguous/missing owner or terminal element.
 * The caller owns/disposes the returned handle.
 */
export async function resolveFrameLocation(page: Page, location: string): Promise<ElementHandle<Element>> {
  const selectors = parseFrameLocation(location);
  let context: Frame = page.mainFrame();
  for (let index = 0; index < selectors.length; index += 1) {
    const handles = await context.$$(selectors[index]!);
    if (handles.length !== 1) {
      await Promise.all(handles.map((handle) => handle.dispose()));
      throw new Error(`location segment ${index + 1} is missing or ambiguous`);
    }
    const handle = handles[0]!;
    if (index === selectors.length - 1) return handle;
    try {
      const child = await handle.contentFrame();
      if (!child) throw new Error(`location segment ${index + 1} is not an attached frame`);
      context = child;
    } finally { await handle.dispose(); }
  }
  throw new Error("empty frame location");
}
