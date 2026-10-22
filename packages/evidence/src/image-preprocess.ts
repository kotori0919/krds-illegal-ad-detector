import { PNG } from "pngjs";

// Pinned torchvision v2 uint8 bicubic AA contract; compare against the source
// reference rather than substituting the float32 v1 interpolation path.

const PATCH_SIZE = 16;
const MAX_PATCHES = 2520;
const POOLING_SIZE = 3;
const INV255_F32 = Math.fround(1 / 255);

function aspectSize(height: number, width: number) {
  const targetPixels = MAX_PATCHES * PATCH_SIZE ** 2;
  const factor = Math.sqrt(targetPixels / (height * width));
  const side = POOLING_SIZE * PATCH_SIZE;
  let h = Math.floor(factor * height / side) * side;
  let w = Math.floor(factor * width / side) * side;
  const maxSide = Math.floor(MAX_PATCHES / POOLING_SIZE ** 2) * side;
  if (h === 0 && w === 0) throw new Error('Empty target dimensions');
  if (h === 0) { h = side; w = Math.min(Math.floor(width / height) * side, maxSide); }
  else if (w === 0) { w = side; h = Math.min(Math.floor(height / width) * side, maxSide); }
  if (h * w > targetPixels) throw new Error('Patch budget exceeded');
  return { width: w, height: h };
}

function keysCubic(x: number) {
  x = Math.abs(x);
  if (x < 1) return (1.5 * x - 2.5) * x * x + 1;
  if (x < 2) return ((-0.5 * x + 2.5) * x - 4) * x + 2;
  return 0;
}

// Pinned PyTorch2.7.1 uint8 AA path: normalized double weights -> signed int16
// coefficients, shared per-axis precision, half-up offset, integer shift and clamp.
function axisWeights(inputSize: number, outputSize: number) {
  const scale = inputSize / outputSize;
  const support = 2 * Math.max(1, scale);
  const invScale = scale >= 1 ? 1 / scale : 1;
  const maxSize = Math.ceil(support) * 2 + 1;
  const rows = [];
  let maxWeight = 0;
  for (let i = 0; i < outputSize; i++) {
    const center = scale * (i + 0.5);
    const start = Math.max(Math.trunc(center - support + 0.5), 0);
    const size = Math.max(0, Math.min(maxSize, Math.min(Math.trunc(center + support + 0.5), inputSize) - start));
    const values = new Float64Array(size);
    let total = 0;
    for (let j = 0; j < size; j++) { values[j] = keysCubic((j + start - center + 0.5) * invScale); total += values[j]!; }
    if (total !== 0) for (let j = 0; j < size; j++) { values[j]! /= total; maxWeight = Math.max(maxWeight, values[j]!); }
    rows.push({ start, values, coefficients: new Int16Array(0) });
  }
  let precision = 0;
  for (; precision < 22; precision++) if (Math.trunc(0.5 + maxWeight * 2 ** (precision + 1)) >= 32768) break;
  const multiplier = 2 ** precision;
  for (const row of rows) row.coefficients = Int16Array.from(row.values, v => Math.trunc(v * multiplier + (v < 0 ? -0.5 : 0.5)));
  return { rows, precision };
}

const clampByte = (value: number) => Math.max(0, Math.min(255, value));
function resizeRgb(rgb: Uint8Array, inputWidth: number, inputHeight: number, outputWidth: number, outputHeight: number) {
  if (inputWidth === outputWidth && inputHeight === outputHeight) return Uint8Array.from(rgb);
  if (outputWidth * inputHeight > 8_000_000) throw new Error('Horizontal intermediate exceeds probe memory bound');
  let horizontal = rgb;
  if (inputWidth !== outputWidth) {
    horizontal = new Uint8Array(outputWidth * inputHeight * 3);
    const { rows, precision } = axisWeights(inputWidth, outputWidth);
    const bias = 2 ** (precision - 1);
    const divisor = 2 ** precision;
    for (let y = 0; y < inputHeight; y++) {
      for (let x = 0; x < outputWidth; x++) {
        const { start, coefficients } = rows[x];
        for (let c = 0; c < 3; c++) {
          let sum = bias;
          const offset = (y * inputWidth + start) * 3 + c;
          for (let k = 0; k < coefficients.length; k++) sum += rgb[offset + k * 3]! * coefficients[k]!;
          horizontal[(y * outputWidth + x) * 3 + c] = clampByte(Math.floor(sum / divisor));
        }
      }
    }
  }
  if (inputHeight === outputHeight) return Uint8Array.from(horizontal);
  const output = new Uint8Array(outputWidth * outputHeight * 3);
  const { rows, precision } = axisWeights(inputHeight, outputHeight);
  const bias = 2 ** (precision - 1);
  const divisor = 2 ** precision;
  const stride = outputWidth * 3;
  for (let y = 0; y < outputHeight; y++) {
    const { start, coefficients } = rows[y];
    for (let offset = 0; offset < stride; offset++) {
      let sum = bias;
      for (let k = 0; k < coefficients.length; k++) sum += horizontal[(start + k) * stride + offset]! * coefficients[k]!;
      output[y * stride + offset] = clampByte(Math.floor(sum / divisor));
    }
  }
  return output;
}

function decodePng(bytes: Uint8Array) {
  const source = Buffer.from(bytes);
  if (source.length < 33 || source.length > 250_000 || !source.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error('Invalid or over-budget PNG');
  const width = source.readUInt32BE(16), height = source.readUInt32BE(20);
  if (!width || !height || width * height > 4_000_000) throw new Error('PNG pixel budget exceeded');
  if (source[24] !== 8 || ![0,2,3,4,6].includes(source[25])) throw new Error('Probe supports 8-bit PNG only');
  for (let offset = 8; offset + 12 <= source.length;) {
    const length = source.readUInt32BE(offset);
    if (offset + length + 12 > source.length) throw new Error('Truncated PNG chunk');
    const type = source.toString('ascii', offset + 4, offset + 8);
    if (type === 'acTL') throw new Error('APNG not supported');
    // Match raw-sample PIL RGB behavior; browser ICC color management is unverified.
    offset += length + 12;
  }
  const decoded = PNG.sync.read(source, { checkCRC: true });
  const rgb = new Uint8Array(width * height * 3);
  let nonOpaquePixels = 0;
  for (let i = 0; i < width * height; i++) {
    const a = decoded.data[i * 4 + 3]!;
    if (a !== 255) nonOpaquePixels++;
    for (let c = 0; c < 3; c++) {
      const v = decoded.data[i * 4 + c]!;
      rgb[i * 3 + c] = Math.floor((v * a + 255 * (255 - a) + 127) / 255);
    }
  }
  return { rgb, width, height, nonOpaquePixels };
}

function patchRgb(rgb: Uint8Array, width: number, height: number) {
  const patchWidth = width / PATCH_SIZE, patchHeight = height / PATCH_SIZE;
  const pixelValues = new Float32Array(MAX_PATCHES * PATCH_SIZE * PATCH_SIZE * 3);
  const positions = new BigInt64Array(MAX_PATCHES * 2).fill(-1n);
  let out = 0;
  for (let row = 0; row < patchHeight; row++) {
    for (let col = 0; col < patchWidth; col++) {
      const patchIndex = row * patchWidth + col;
      positions[patchIndex * 2] = BigInt(col);
      positions[patchIndex * 2 + 1] = BigInt(row);
      for (let y = 0; y < PATCH_SIZE; y++) {
        for (let x = 0; x < PATCH_SIZE; x++) {
          const start = ((row * PATCH_SIZE + y) * width + col * PATCH_SIZE + x) * 3;
          for (let c = 0; c < 3; c++) pixelValues[out++] = rgb[start + c]! * INV255_F32;
        }
      }
    }
  }
  return { pixelValues, positions, softTokens: patchWidth * patchHeight / POOLING_SIZE ** 2, width, height };
}

export function preprocessPng(bytes: Uint8Array, shuffled = false) {
  const original = decodePng(bytes);
  const { width, height } = aspectSize(original.height, original.width);
  const rgb = resizeRgb(original.rgb, original.width, original.height, width, height);
  if (shuffled) {
    let seed = 1701;
    const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
    for (let i = rgb.length / 3 - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      for (let c = 0; c < 3; c++) { const a = i * 3 + c, b = j * 3 + c, value = rgb[a]!; rgb[a] = rgb[b]!; rgb[b] = value; }
    }
  }
  return patchRgb(rgb, width, height);
}
