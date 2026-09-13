const colorCanvas = document.createElement("canvas");
colorCanvas.width = colorCanvas.height = 1;
const colorContext = colorCanvas.getContext("2d", { willReadFrequently: true });

function readColorBytes(color) {
  colorContext.clearRect(0, 0, 1, 1);
  colorContext.fillStyle = color;
  colorContext.fillRect(0, 0, 1, 1);
  return colorContext.getImageData(0, 0, 1, 1).data;
}

/** Resolve a CSS color to normalized sRGB RGBA. */
export function readCssColor(color) {
  return Array.from(readColorBytes(color), (channel) => channel / 255);
}

/** Resolve stacked CSS background colors, nearest first, into opaque sRGB. */
export function readSolidBackdrop(element) {
  let red = 0, green = 0, blue = 0, remaining = 1;
  for (let ancestor = element.parentElement; ancestor && remaining > 0; ancestor = ancestor.parentElement) {
    const color = readColorBytes(getComputedStyle(ancestor).backgroundColor);
    const opacity = color[3] / 255;
    red += color[0] * opacity * remaining;
    green += color[1] * opacity * remaining;
    blue += color[2] * opacity * remaining;
    remaining *= 1 - opacity;
  }
  // An unpainted document canvas is white. The site's opaque theme background
  // normally consumes all remaining opacity before reaching this point.
  return [red, green, blue].map((channel) => Math.round(channel + 255 * remaining) / 255);
}
