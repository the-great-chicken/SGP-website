/**
 * Quantize final sRGB channels in [0, 1] into opaque, dithered display pixels.
 * For additive light, supply only the light contribution and use plus-lighter.
 * For an opaque surface, supply its fully composited color. Do not introduce
 * an alpha ramp, scaling, blur or opacity after this final quantization step.
 */
export function writeDitheredPixel(pixels, index, red, green, blue) {
  const threshold = pixelThreshold(index / 4);
  pixels[index] = Math.floor(red * 255 + threshold);
  pixels[index + 1] = Math.floor(green * 255 + threshold);
  pixels[index + 2] = Math.floor(blue * 255 + threshold);
  pixels[index + 3] = 255;
}

// Stable, uncorrelated thresholds in [0, 1); no texture or animation.
function pixelThreshold(pixel) {
  let hash = Math.imul(pixel + 1, 0x9e3779b1);
  hash = Math.imul(hash ^ (hash >>> 16), 0x7feb352d);
  hash = Math.imul(hash ^ (hash >>> 15), 0x846ca68b);
  return ((hash ^ (hash >>> 16)) >>> 0) / 0x100000000;
}
