import type { Frame, Page } from "playwright-core";
import type { LiveImageResponse, ScanDeadline } from "@krds-detector/scanner";
import { blockAverageHash, sha256Hex, type CreativeFingerprint } from "@krds-detector/evidence";
import type { CreativeImage } from "@krds-detector/contracts";

const AD_HINT = /(?:^|[^a-z])(ad|ads|banner)(?:$|[^a-z])|광고|배너/i;

async function selectedImageUrls(frame: Frame): Promise<string[]> {
  return frame.evaluate((pattern) => {
    const hint = new RegExp(pattern, "i");
    return Array.from(document.images)
      .filter((img) => {
        const marker = `${img.alt} ${img.id} ${img.className} ${img.parentElement?.id ?? ""} ${img.parentElement?.className ?? ""}`;
        const link = img.closest("a[href]") as HTMLAnchorElement | null;
        return hint.test(marker) || (link !== null && link.host !== location.host);
      })
      .map((img) => img.currentSrc || img.src)
      .filter(Boolean);
  }, AD_HINT.source);
}

async function within<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => { timer = setTimeout(() => reject(new Error("creative capture timed out")), ms); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Inspect only observed image responses while the navigated Page is live. */
export async function collectPageCreatives(
  page: Page,
  frames: Frame[],
  responses: LiveImageResponse[],
  deadline: ScanDeadline,
  maxBytes: number,
): Promise<{ prints: CreativeFingerprint[]; images: Omit<CreativeImage, "findingId">[]; bytes: number }> {
  if (deadline.operationTimeoutMs(2000) < 500 || maxBytes <= 0) return { prints: [], images: [], bytes: 0 };
  const selected = new Set<string>();
  for (const frame of [page.mainFrame(), ...frames]) {
    try {
      for (const url of await within(selectedImageUrls(frame), Math.max(1, deadline.operationTimeoutMs(500)))) selected.add(url);
    } catch {
      // A detached frame does not affect official findings.
    }
  }
  const prints: CreativeFingerprint[] = [];
  const images: Omit<CreativeImage, "findingId">[] = [];
  let bytes = 0;
  for (const observed of responses) {
    if (prints.length >= 8 || bytes >= maxBytes || deadline.operationTimeoutMs(2000) < 500) break;
    let selectedResponse = selected.has(observed.url);
    let request = observed.response.request().redirectedFrom();
    for (let hop = 0; !selectedResponse && request && hop < 20; hop += 1) {
      selectedResponse = selected.has(request.url());
      request = request.redirectedFrom();
    }
    if (!selectedResponse) continue;
    try {
      const body = await within(observed.response.body(), Math.max(1, deadline.operationTimeoutMs(1000)));
      if (body.length === 0 || body.length > 250_000 || bytes + body.length > maxBytes) continue;
      const decoded = await within(page.evaluate(async ({ imageBytes, mediaType }) => {
        const blob = new Blob([new Uint8Array(imageBytes)], { type: mediaType });
        const bitmap = await createImageBitmap(blob);
        try {
          const canvas = document.createElement("canvas");
          canvas.width = 8;
          canvas.height = 8;
          const context = canvas.getContext("2d", { willReadFrequently: true });
          if (!context) return undefined;
          context.drawImage(bitmap, 0, 0, 8, 8);
          return { width: bitmap.width, height: bitmap.height,
            rgba: Array.from(context.getImageData(0, 0, 8, 8).data) };
        } finally {
          bitmap.close();
        }
      }, { imageBytes: Array.from(body), mediaType: observed.mediaType }), Math.max(1, deadline.operationTimeoutMs(1000)));
      if (!decoded || decoded.width < 8 || decoded.height < 8) continue;
      bytes += body.length;
      const sha256 = sha256Hex(body);
      prints.push({ sha256, perceptualHash: blockAverageHash(new Uint8Array(decoded.rgba), 8, 8),
        width: decoded.width, height: decoded.height, mediaType: observed.mediaType,
        sourceUrl: observed.url, sourceHost: new URL(observed.url).host });
      if (observed.mediaType === "image/png" || observed.mediaType === "image/jpeg" || observed.mediaType === "image/webp") {
        images.push({ sourceUrl: observed.url, sha256, mimeType: observed.mediaType,
          dataUrl: `data:${observed.mediaType};base64,${body.toString("base64")}`,
          width: decoded.width, height: decoded.height, capturedAt: new Date().toISOString() });
      }
    } catch {
      // Image fingerprints are optional evidence after official detection.
    }
  }
  return { prints, images, bytes };
}
