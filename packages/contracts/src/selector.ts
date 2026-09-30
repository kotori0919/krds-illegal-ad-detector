/**
 * Contract v0 (draft): selector + frame-path serialization.
 *
 * Convention: iframe[src="ABSOLUTE_URL"] >>> selector, repeated `>>>` for
 * nested frames. Relative iframe src values normalize to absolute URLs before
 * emission. Every emitted selector must round-trip (querySelectorAll yields
 * exactly the intended element) where technically possible.
 */

export interface FramePathSegment {
  /** Absolute iframe src URL. */
  src: string;
  /** Selector of the <iframe> element in its parent context. */
  selector: string;
}

export interface LocatedElement {
  framePath: FramePathSegment[];
  selector: string;
}

export const FRAME_SEPARATOR = " >>> ";

export function serializeFramePath(located: LocatedElement): string {
  const parts = located.framePath.map(
    (segment) => `iframe[src="${segment.src}"]`,
  );
  parts.push(located.selector);
  return parts.join(FRAME_SEPARATOR);
}

export function normalizeFrameSrc(src: string, baseUrl: string): string {
  return new URL(src, baseUrl).href;
}
