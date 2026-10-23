/**
 * Location policy v1.1: unique frame-owner selectors + element selector.
 *
 * Convention: OWNER_SELECTOR >>> selector, repeated `>>>` for nested frames.
 * Owner identity is independent of document src (duplicate src, srcdoc and
 * populated about:blank are valid). URLs remain internal provenance.
 * Every emitted selector must round-trip (querySelectorAll yields
 * exactly the intended element) where technically possible.
 */

export interface FramePathSegment {
  /** Document source provenance; not used as owner identity. */
  src: string;
  /** Selector of the <iframe> element in its parent context. */
  selector: string;
}

/** Ordered outer-to-inner iframe chain for one located element. */
export type FramePath = FramePathSegment[];

export interface LocatedElement {
  framePath: FramePath;
  selector: string;
}

export const FRAME_SEPARATOR = " >>> ";

export function serializeFramePath(located: LocatedElement): string {
  const parts = located.framePath.map((segment) => segment.selector);
  parts.push(located.selector);
  return parts.join(FRAME_SEPARATOR);
}

/** Split only separators outside CSS strings/brackets/escapes. */
export function parseFrameLocation(location: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let quote = "";
  let depth = 0;
  for (let index = 0; index < location.length; index += 1) {
    const character = location[index]!;
    if (character === "\\") { index += 1; continue; }
    if (quote) { if (character === quote) quote = ""; continue; }
    if (character === '"' || character === "'") { quote = character; continue; }
    if (character === "[" || character === "(") depth += 1;
    if (character === "]" || character === ")") depth -= 1;
    if (depth === 0 && location.startsWith(FRAME_SEPARATOR, index)) {
      parts.push(location.slice(start, index));
      index += FRAME_SEPARATOR.length - 1;
      start = index + 1;
    }
  }
  parts.push(location.slice(start));
  if (quote || depth !== 0 || parts.some((part) => !part.trim())) throw new Error("invalid frame location");
  return parts;
}

export function normalizeFrameSrc(src: string, baseUrl: string): string {
  return new URL(src, baseUrl).href;
}
