import sharp from "sharp";

export type Compound = { [key: string]: unknown };
export type Effect = { kind: "particle" | "entity"; id: string; options?: Compound; nbt?: Compound; count?: number; source: string };
export type Visual = { kind: "block" | "item"; id: string; data: Compound };
export type CosmeticEffects = { id: string; category: string; name: string; color: string; effects: Effect[] };
export type EffectExport = { schemaVersion: 1; sourceHash: string; cosmetics: CosmeticEffects[]; particleChildren: Record<string, string[]> };

export function particleColor(options: Compound): string | undefined {
  const color = options.color ?? options.from_color;
  if (typeof color === "number" && Number.isInteger(color)) return `#${(color & 0xffffff).toString(16).padStart(6, "0")}`;
  if (Array.isArray(color) && color.length === 3 && color.every((channel) => typeof channel === "number" && Number.isFinite(channel) && channel >= 0 && channel <= 1)) {
    return "#" + color.map((channel: number) => Math.round(channel * 255).toString(16).padStart(2, "0")).join("");
  }
  if (color !== undefined) throw new Error("Unsupported particle color; expected packed RGB or three normalized channels");
}

export async function particleSprite(image: Uint8Array, accent: string, explicitColor?: string): Promise<Buffer> {
  const { data, info } = await sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let neutral = true;
  let left = info.width, top = info.height, right = -1, bottom = -1;
  for (let i = 0; i < data.length; i += info.channels) {
    if (!data[i + 3]) continue;
    if (data[i] !== data[i + 1] || data[i] !== data[i + 2]) neutral = false;
    const pixel = i / info.channels;
    left = Math.min(left, pixel % info.width);
    right = Math.max(right, pixel % info.width);
    top = Math.min(top, Math.floor(pixel / info.width));
    bottom = Math.max(bottom, Math.floor(pixel / info.width));
  }
  // Neutral sprite masks need a display tint. Colored resource-pack art keeps its own colors.
  const tint = explicitColor ?? (neutral ? accent : undefined);
  if (tint) {
    const rgb = [1, 3, 5].map((offset) => parseInt(tint.slice(offset, offset + 2), 16) / 255);
    for (let i = 0; i < data.length; i += info.channels) {
      for (let channel = 0; channel < 3; channel++) data[i + channel] = Math.round(data[i + channel] * rgb[channel]);
    }
  }
  if (right < left) throw new Error("Particle sprite is completely transparent");
  const width = right - left + 1, height = bottom - top + 1;
  const side = Math.max(8, width + 2, height + 2);
  const x = Math.floor((side - width) / 2), y = Math.floor((side - height) / 2);
  const padded = await sharp(data, { raw: info }).extract({ left, top, width, height })
    .extend({ left: x, right: side - width - x, top: y, bottom: side - height - y, background: "#00000000" })
    .png().toBuffer();
  return sharp(padded).resize(104, 104, { fit: "contain", kernel: "nearest", background: "#00000000" }).png().toBuffer();
}

export function compound(value: unknown): value is Compound {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function assetPath(id: string, folder: string, extension: string): string {
  const parts = id.includes(":") ? id.split(":") : ["minecraft", id];
  if (parts.length !== 2 || !/^[a-z0-9_.-]+$/.test(parts[0]) || !/^[a-z0-9_./-]+$/.test(parts[1]) || parts[1].includes("..")) {
    throw new Error(`Invalid asset identifier: ${id}`);
  }
  return `assets/${parts[0]}/${folder}/${parts[1]}.${extension}`;
}

export function payloadVisuals(value: unknown): Visual[] {
  if (Array.isArray(value)) return value.flatMap(payloadVisuals);
  if (!compound(value)) return [];
  // Minecraft block-state and item-stack structures select their own assets, regardless of entity type.
  if (typeof value.Name === "string") {
    return [{ kind: "block", id: value.Name, data: compound(value.Properties) ? value.Properties : {} }];
  }
  if (typeof value.id === "string" && typeof value.count === "number") {
    return [{ kind: "item", id: value.id, data: compound(value.components) ? value.components : {} }];
  }
  return Object.values(value).flatMap(payloadVisuals);
}

export async function particleTextures(id: string, readJson: (file: string) => Promise<unknown | null>, children: Record<string, string[]>, stack: string[] = []): Promise<string[]> {
  if (stack.includes(id)) throw new Error(`Recursive particle emitter: ${[...stack, id].join(" → ")}`);
  const definition = await readJson(assetPath(id, "particles", "json"));
  if (compound(definition) && Array.isArray(definition.textures) && definition.textures.length) {
    if (!definition.textures.every((texture) => typeof texture === "string")) throw new Error(`Invalid particle textures: ${id}`);
    // Pick a middle lifetime frame; animated PNG frame selection remains the resource pack's responsibility.
    return [assetPath(definition.textures[Math.floor(definition.textures.length / 2)] as string, "textures/particle", "png")];
  }
  if (children[id]?.length) {
    return [...new Set((await Promise.all(children[id].map((child) => particleTextures(child, readJson, children, [...stack, id])))).flat())];
  }
  throw new Error(`Particle ${id} has no sprite or supported client emitter provider`);
}

export async function collage(images: Uint8Array[], color: string): Promise<Buffer> {
  const side = Math.ceil(Math.sqrt(images.length));
  const cell = Math.floor(120 / side);
  const layers = await Promise.all(images.map(async (image, index) => ({
    input: await sharp(image).resize(cell, cell, { fit: "contain", kernel: "nearest", background: "#00000000" }).png().toBuffer(),
    left: 4 + index % side * cell + (index >= Math.floor(images.length / side) * side ? Math.floor((side - images.length % side) * cell / 2) : 0),
    top: 4 + Math.floor(index / side) * cell,
  })));
  // A faint background carries the same accent as the cosmetic's tile.
  const backdrop = Buffer.from(`<svg width="128" height="128"><circle cx="64" cy="64" r="58" fill="${color}" fill-opacity="0.09"/></svg>`);
  return sharp(backdrop).composite(layers).png().toBuffer();
}

export function intensityDots(count: number, maximum: number, color: string): Buffer {
  const dots = Math.max(1, Math.round(25 * Math.sqrt(count / Math.max(1, maximum))));
  const positions = Array.from({ length: 25 }, (_, i) => i).sort((a, b) => (a * 13 % 25) - (b * 13 % 25)).slice(0, dots);
  return Buffer.from(`<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">${positions.map((i) => `<circle cx="${24 + i % 5 * 20}" cy="${24 + Math.floor(i / 5) * 20}" r="5" fill="${color}"/>`).join("")}</svg>`);
}
