import { writeDitheredPixel } from "./dither.mjs";

/**
 * Composite elliptical farthest-corner gradients onto an opaque sRGB surface,
 * then dither once. Layers are bottom-to-top; centers and stops are fractions
 * of the CSS gradient box, and colors/background are normalized sRGB channels.
 */
export function rasterizeRadialGradients({ width, height, pixelWidth, pixelHeight, pixelRatio, background, layers }) {
  const gradients = layers.map(({ x, y, stop, opacity, color }) => ({
    x: x * width,
    y: y * height,
    // CSS farthest-corner ellipses preserve farthest-side's aspect ratio.
    radiusX: Math.max(x, 1 - x) * width * Math.SQRT2 * stop,
    radiusY: Math.max(y, 1 - y) * height * Math.SQRT2 * stop,
    opacity,
    color,
  }));
  const pixels = new Uint8ClampedArray(pixelWidth * pixelHeight * 4);
  for (let y = 0; y < pixelHeight; y++) {
    const localY = (y + 0.5) / pixelRatio;
    for (let x = 0; x < pixelWidth; x++) {
      const localX = (x + 0.5) / pixelRatio;
      let [red, green, blue] = background;
      for (const gradient of gradients) {
        const distance = Math.hypot((localX - gradient.x) / gradient.radiusX, (localY - gradient.y) / gradient.radiusY);
        const alpha = Math.max(0, 1 - distance) * gradient.opacity;
        red += (gradient.color[0] - red) * alpha;
        green += (gradient.color[1] - green) * alpha;
        blue += (gradient.color[2] - blue) * alpha;
      }
      writeDitheredPixel(pixels, (y * pixelWidth + x) * 4, red, green, blue);
    }
  }
  return pixels;
}
