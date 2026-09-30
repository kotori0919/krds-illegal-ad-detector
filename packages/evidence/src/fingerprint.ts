/**
 * Creative fingerprinting (GOAL Phase 13, KODEX §26).
 *
 * Exact SHA-256 over bytes + lightweight block-average perceptual hash over
 * raw RGBA pixels (no canvas dependency; works in Node and the browser).
 * Similarity alone never creates an official finding — it feeds
 * result_extra.json correlation and the evidence UI.
 */
import { createHash } from "node:crypto";

export interface CreativeFingerprint {
  sha256: string;
  perceptualHash: string;
  width: number;
  height: number;
  mediaType: string;
  sourceUrl: string;
  sourceHost: string;
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * 64-bit block-mean hash: downsample to 8x8 grayscale, set bits above the
 * mean. Returns 16 hex chars. Deterministic, dependency-free.
 */
export function blockAverageHash(rgba: Uint8Array, width: number, height: number): string {
  const cells = new Array<number>(64).fill(0);
  const counts = new Array<number>(64).fill(0);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const lum = luminance(rgba[i] ?? 0, rgba[i + 1] ?? 0, rgba[i + 2] ?? 0);
      const cx = Math.min(7, Math.floor((x * 8) / Math.max(1, width)));
      const cy = Math.min(7, Math.floor((y * 8) / Math.max(1, height)));
      const cell = cy * 8 + cx;
      cells[cell] = (cells[cell] ?? 0) + lum;
      counts[cell] = (counts[cell] ?? 0) + 1;
    }
  }
  const means = cells.map((v, i) => v / Math.max(1, counts[i] ?? 1));
  const global = means.reduce((a, b) => a + b, 0) / 64;
  let bits = 0n;
  for (let i = 0; i < 64; i += 1) {
    if ((means[i] ?? 0) > global) bits |= 1n << BigInt(i);
  }
  return bits.toString(16).padStart(16, "0");
}

/** Hamming distance between two 16-hex-char perceptual hashes. */
export function hashDistance(a: string, b: string): number {
  const x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let n = 0;
  let v = x;
  while (v > 0n) {
    n += Number(v & 1n);
    v >>= 1n;
  }
  return n;
}

export function fingerprintCreative(input: {
  bytes: Uint8Array;
  rgba: Uint8Array;
  width: number;
  height: number;
  mediaType: string;
  sourceUrl: string;
}): CreativeFingerprint {
  let host = "";
  try {
    host = new URL(input.sourceUrl).host;
  } catch {
    host = "";
  }
  return {
    sha256: sha256Hex(input.bytes),
    perceptualHash: blockAverageHash(input.rgba, input.width, input.height),
    width: input.width,
    height: input.height,
    mediaType: input.mediaType,
    sourceUrl: input.sourceUrl,
    sourceHost: host,
  };
}

/** Recurring creative family: same perceptual hash within threshold. */
export function groupSimilarCreatives(
  prints: CreativeFingerprint[],
  threshold = 5,
): CreativeFingerprint[][] {
  const groups: CreativeFingerprint[][] = [];
  for (const p of prints) {
    const group = groups.find(
      (g) => g[0] && hashDistance(g[0].perceptualHash, p.perceptualHash) <= threshold,
    );
    if (group) group.push(p);
    else groups.push([p]);
  }
  return groups.filter((g) => g.length >= 2);
}
