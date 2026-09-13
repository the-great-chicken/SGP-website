import { writeDitheredPixel } from "../rendering/dither.mjs";

// The original CSS shadows, in CSS pixels and sRGB. First layer is on top.
const BLUR = 10;
const LAYERS = [
  { x: -3, y: -2, color: [204, 77, 76], opacity: 0.2 },
  { x: 3, y: -2, color: [166, 191, 48], opacity: 0.18 },
  { x: 0, y: 3, color: [48, 101, 170], opacity: 0.22 },
];
export const GLOW_PADDING = Math.ceil(2 * BLUR + Math.max(...LAYERS.map(({ x, y }) => Math.max(Math.abs(x), Math.abs(y))))) + 1;

// Only the smooth, floating-point field is sampled on this grid. Dithering is
// performed later at native resolution, so browser zoom never enlarges grain.
const FIELD_SCALE = 2;
let cachedField;

/** Rasterize additive light. All dimensions/offsets are CSS pixels except pixelWidth/Height. */
export function rasterizeLogoGlow({ width, height, radius, pixelRatio, pixelWidth, pixelHeight, offsetX, offsetY, backdrop }) {
  const field = getBlurredShape(width, height, radius);
  const pixels = new Uint8ClampedArray(pixelWidth * pixelHeight * 4);

  for (let y = 0; y < pixelHeight; y++) {
    const localY = (y + 0.5) / pixelRatio - offsetY;
    for (let x = 0; x < pixelWidth; x++) {
      const localX = (x + 0.5) / pixelRatio - offsetX;
      const outside = 1 - shapeCoverage(localX, localY, width, height, radius, pixelRatio);
      if (outside === 0) continue;

      let red = 0, green = 0, blue = 0, alpha = 0;
      for (let layerIndex = LAYERS.length - 1; layerIndex >= 0; layerIndex--) {
        const layer = LAYERS[layerIndex];
        const opacity = sampleField(field, localX - layer.x, localY - layer.y) * layer.opacity;
        red = layer.color[0] * opacity + red * (1 - opacity);
        green = layer.color[1] * opacity + green * (1 - opacity);
        blue = layer.color[2] * opacity + blue * (1 - opacity);
        alpha = opacity + alpha * (1 - opacity);
      }

      const index = (y * pixelWidth + x) * 4;
      // Source-over would produce P + B(1-a). Emit P-aB so additive blending
      // gives the same result on surface B, without quantizing an alpha ramp.
      // This light-only layer is appropriate for this logo's colors on the
      // dark theme; it is not a replacement for shadows that darken a surface.
      writeDitheredPixel(
        pixels, index,
        Math.max(0, red / 255 - alpha * backdrop[0]) * outside,
        Math.max(0, green / 255 - alpha * backdrop[1]) * outside,
        Math.max(0, blue / 255 - alpha * backdrop[2]) * outside,
      );
    }
  }
  return pixels;
}

function getBlurredShape(width, height, radius) {
  const key = `${width}:${height}:${radius}`;
  if (cachedField?.key === key) return cachedField;

  const columns = Math.ceil((width + 2 * GLOW_PADDING) * FIELD_SCALE);
  const rows = Math.ceil((height + 2 * GLOW_PADDING) * FIELD_SCALE);
  const shape = new Float64Array(columns * rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      shape[y * columns + x] = shapeCoverage(
        (x + 0.5) / FIELD_SCALE - GLOW_PADDING,
        (y + 0.5) / FIELD_SCALE - GLOW_PADDING,
        width, height, radius, FIELD_SCALE,
      );
    }
  }

  // CSS defines a shadow's Gaussian standard deviation as half its blur radius.
  // Keep both convolution passes in floating point; Canvas blur would quantize
  // the alpha mask before we had a chance to dither it.
  const sigma = BLUR / 2 * FIELD_SCALE;
  const reach = Math.ceil(4 * sigma);
  const kernel = new Float64Array(2 * reach + 1);
  let sum = 0;
  for (let k = -reach; k <= reach; k++) {
    kernel[k + reach] = Math.exp(-k * k / (2 * sigma * sigma));
    sum += kernel[k + reach];
  }
  for (let k = 0; k < kernel.length; k++) kernel[k] /= sum;

  const horizontal = new Float64Array(shape.length);
  const blurred = new Float64Array(shape.length);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const index = y * columns + x;
      for (let k = Math.max(-reach, -x); k <= Math.min(reach, columns - 1 - x); k++) {
        horizontal[index] += shape[index + k] * kernel[k + reach];
      }
    }
  }
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const index = y * columns + x;
      for (let k = Math.max(-reach, -y); k <= Math.min(reach, rows - 1 - y); k++) {
        blurred[index] += horizontal[index + k * columns] * kernel[k + reach];
      }
    }
  }
  cachedField = { key, columns, rows, values: blurred };
  return cachedField;
}

function shapeCoverage(x, y, width, height, radius, scale) {
  const dx = Math.abs(x - width / 2) - (width / 2 - radius);
  const dy = Math.abs(y - height / 2) - (height / 2 - radius);
  const distance = Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - radius;
  return Math.max(0, Math.min(1, 0.5 - distance * scale));
}

function sampleField(field, x, y) {
  const gx = (x + GLOW_PADDING) * FIELD_SCALE - 0.5;
  const gy = (y + GLOW_PADDING) * FIELD_SCALE - 0.5;
  const left = Math.floor(gx), top = Math.floor(gy);
  if (left < 0 || top < 0 || left + 1 >= field.columns || top + 1 >= field.rows) return 0;
  const fx = gx - left, fy = gy - top;
  const index = top * field.columns + left;
  const upper = field.values[index] * (1 - fx) + field.values[index + 1] * fx;
  const lower = field.values[index + field.columns] * (1 - fx) + field.values[index + field.columns + 1] * fx;
  return upper * (1 - fy) + lower * fy;
}
