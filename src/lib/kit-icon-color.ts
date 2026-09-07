const colorNames = ["black", "dark_blue", "dark_green", "dark_aqua", "dark_red", "dark_purple", "gold", "gray", "dark_gray", "blue", "green", "aqua", "red", "light_purple", "yellow", "white"];

export function minecraftRgb(color: string | null): [number, number, number] {
  if (color && /^#[\da-f]{6}$/i.test(color)) {
    return [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16)) as [number, number, number];
  }
  const index = colorNames.indexOf(color ?? "white");
  if (index < 0) throw new Error(`Unknown Minecraft color: ${color}`);
  const bright = (index >> 3) * 85;
  return [((index >> 2) & 1) * 170 + bright + (index === 6 ? 85 : 0), ((index >> 1) & 1) * 170 + bright, (index & 1) * 170 + bright];
}

// Grayscale font artwork takes the text color; authored RGB artwork keeps its palette.
export function tintKitIcon(pixels: Uint8Array, color: string | null): Uint8Array {
  const result = new Uint8Array(pixels);
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] && (pixels[i] !== pixels[i + 1] || pixels[i] !== pixels[i + 2])) return result;
  }
  const rgb = minecraftRgb(color);
  for (let i = 0; i < result.length; i += 4) {
    for (let channel = 0; channel < 3; channel++) result[i + channel] = Math.round(result[i + channel] * rgb[channel] / 255);
  }
  return result;
}
