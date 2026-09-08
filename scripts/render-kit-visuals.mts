import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { readFile as readAssetFile, renderModel, type PreparedAssets, type ModelJson } from "block-model-renderer";
import { isJsonObject, type KitItem, type KitManifest } from "../src/lib/kit-manifest";
import { tintKitIcon } from "../src/lib/kit-icon-color";
import { getKitWeapon } from "../src/lib/kit-preview";
import { buildHeldItem } from "./build-held-item.mts";

const output = path.join(process.cwd(), "public/generated/kit-models");
const skinCache = path.join(process.cwd(), ".data/skin-cache");

export async function renderKitVisuals(manifest: KitManifest, assets: PreparedAssets) {
  await mkdir(output, { recursive: true });
  await mkdir(skinCache, { recursive: true });
  const readAsset = async (name: string) => {
    const data = await readAssetFile(`assets/${name}`, assets);
    if (!data) throw new Error(`Missing kit preview asset: ${name}`);
    return Buffer.from(data);
  };
  await writeFile(path.join(output, "steve.png"), await readAsset("minecraft/textures/entity/player/wide/steve.png"));
  const font = JSON.parse((await readAsset("sgp.kits/font/ability_hud.json")).toString()) as {
    providers: { type: string; chars?: string[]; file?: string }[];
  };
  const heads = new Map<string, Buffer>();
  for (const kit of manifest.kits) {
    const directory = path.join(output, kit.key);
    await mkdir(directory, { recursive: true });
    if (kit.icon) {
      const provider = font.providers.find((provider) => provider.type === "bitmap" && provider.chars?.includes(kit.icon!));
      if (!provider?.file) throw new Error(`Missing resource-pack icon for ${kit.key}`);
      const [namespace, name] = provider.file.split(":");
      const { data, info } = await sharp(await readAsset(`${namespace}/textures/${name}`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      await sharp(tintKitIcon(data, kit.color), { raw: info }).png().toFile(path.join(directory, "icon.png"));
    }
    const weapon = getKitWeapon(kit);
    if (weapon) await writeFile(path.join(directory, "held-item.json"), JSON.stringify(await buildHeldItem(weapon, assets, manifest.minecraftVersion)));
    for (const { slot, item } of kit.operations) {
      if (item.id === "minecraft:player_head") {
        const source = await resolveHeadSkin(item);
        const { height } = await sharp(source).metadata();
        const skin = height === 32 ? await sharp(source).extend({ bottom: 32, background: "transparent" }).png().toBuffer() : source;
        heads.set(JSON.stringify(item.components["minecraft:profile"]), skin);
        if (slot === "armor.head") await writeFile(path.join(directory, "head.png"), skin);
      }
      if (!slot?.startsWith("armor.")) continue;
      if (item.id === "minecraft:elytra") {
        await writeFile(path.join(directory, "wings.png"), await readAsset("minecraft/textures/entity/equipment/wings/elytra.png"));
        continue;
      }
      if (item.id === "minecraft:player_head") continue;
      const material = item.id.replace("minecraft:", "").split("_")[0].replace("golden", "gold");
      const layer = slot === "armor.legs" ? "humanoid_leggings" : "humanoid";
      const equipment = isJsonObject(item.components["minecraft:equippable"]) ? item.components["minecraft:equippable"] : undefined;
      const assetId = typeof equipment?.asset_id === "string" ? equipment.asset_id : `minecraft:${material}`;
      const [namespace, assetName] = assetId.includes(":") ? assetId.split(":") : ["minecraft", assetId];
      const definition = JSON.parse((await readAsset(`${namespace}/equipment/${assetName}.json`)).toString()) as {
        layers: Record<string, { texture: string; dyeable?: { color_when_undyed?: number } }[]>;
      };
      const layers = [];
      for (const equipmentLayer of definition.layers[layer]) {
        const [textureNamespace, textureName] = equipmentLayer.texture.includes(":") ? equipmentLayer.texture.split(":") : ["minecraft", equipmentLayer.texture];
        let texture = await readAsset(`${textureNamespace}/textures/entity/equipment/${layer}/${textureName}.png`);
        if (equipmentLayer.dyeable) {
          const component = item.components["minecraft:dyed_color"];
          const dye = typeof component === "number" ? component : equipmentLayer.dyeable.color_when_undyed ?? 0xa06540;
          const { data, info } = await sharp(texture).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
          for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.round(data[i] * ((dye >> 16) & 255) / 255);
            data[i + 1] = Math.round(data[i + 1] * ((dye >> 8) & 255) / 255);
            data[i + 2] = Math.round(data[i + 2] * (dye & 255) / 255);
          }
          texture = await sharp(data, { raw: info }).png().toBuffer();
        }
        layers.push({ input: texture });
      }
      const trim = item.components["minecraft:trim"];
      if (isJsonObject(trim) && typeof trim.pattern === "string" && typeof trim.material === "string") {
        const pattern = trim.pattern.replace("minecraft:", "");
        const trimMaterial = trim.material.replace("minecraft:", "");
        const paletteName = trimMaterial === material || (material === "chainmail" && trimMaterial === "iron") ? `${trimMaterial}_darker` : trimMaterial;
        const [texture, palette, replacement] = await Promise.all([
          readAsset(`minecraft/textures/trims/entity/${layer}/${pattern}.png`),
          readAsset("minecraft/textures/trims/color_palettes/trim_palette.png"),
          readAsset(`minecraft/textures/trims/color_palettes/${paletteName}.png`),
        ]);
        layers.push({ input: await recolorTrim(texture, palette, replacement) });
      }
      const { width, height } = await sharp(layers[0].input).metadata();
      const composed = await sharp({ create: { width: width!, height: height!, channels: 4, background: "transparent" } })
        .composite(layers).png().toBuffer();
      const outputTexture = slot === "armor.head" ? composed : await expandHumanoidArmorTexture(composed);
      await writeFile(path.join(directory, `${slot.slice(6)}.png`), outputTexture);
    }
  }
  return heads;
}


// Minecraft humanoid armor textures are authored as 64x32, where both limbs
// share the right-limb UVs and the model mirrors the left cuboids. For a plain
// Three.js BoxGeometry renderer, expand that texture to the modern 64x64 skin
// layout first. The face-copy coordinates below intentionally match
// bs-community/skinview-utils v0.7.1 convertSkinTo1_8 (MIT), so the
// left arm/leg are mirrored exactly as Minecraft expects instead of transposed.
export async function expandHumanoidArmorTexture(texture: Buffer) {
  const metadata = await sharp(texture).metadata();
  const width = metadata.width;
  const height = metadata.height;
  if (!width || !height || width !== height * 2 || width % 64 !== 0) {
    throw new Error(`Bad humanoid armor texture size: ${width}x${height}`);
  }
  const scale = width / 64;
  const mirrorRegion = async (sX: number, sY: number, w: number, h: number, dX: number, dY: number) => ({
    input: await sharp(texture).extract({
      left: sX * scale,
      top: sY * scale,
      width: w * scale,
      height: h * scale,
    }).flop().png().toBuffer(),
    left: dX * scale,
    top: dY * scale,
  });
  const regions = await Promise.all([
    // Left leg, mirrored from the authored right leg.
    mirrorRegion(4, 16, 4, 4, 20, 48),
    mirrorRegion(8, 16, 4, 4, 24, 48),
    mirrorRegion(0, 20, 4, 12, 24, 52),
    mirrorRegion(4, 20, 4, 12, 20, 52),
    mirrorRegion(8, 20, 4, 12, 16, 52),
    mirrorRegion(12, 20, 4, 12, 28, 52),
    // Left arm, mirrored from the authored right arm.
    mirrorRegion(44, 16, 4, 4, 36, 48),
    mirrorRegion(48, 16, 4, 4, 40, 48),
    mirrorRegion(40, 20, 4, 12, 40, 52),
    mirrorRegion(44, 20, 4, 12, 36, 52),
    mirrorRegion(48, 20, 4, 12, 32, 52),
    mirrorRegion(52, 20, 4, 12, 44, 52),
  ]);
  return sharp({ create: { width, height: width, channels: 4, background: "transparent" } })
    .composite([{ input: texture, left: 0, top: 0 }, ...regions])
    .png().toBuffer();
}

async function recolorTrim(texture: Buffer, palette: Buffer, replacement: Buffer) {
  const source = await sharp(palette).ensureAlpha().raw().toBuffer();
  const target = await sharp(replacement).ensureAlpha().raw().toBuffer();
  const colors = new Map<number, number[]>();
  for (let i = 0; i < source.length; i += 4) colors.set(source.readUIntBE(i, 3), [...target.subarray(i, i + 3)]);
  const { data, info } = await sharp(texture).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const color = colors.get(data.readUIntBE(i, 3));
    if (color) data.set(color, i);
  }
  return sharp(data, { raw: info }).png().toBuffer();
}

async function resolveHeadSkin(item: KitItem): Promise<Buffer> {
  const profile = item.components["minecraft:profile"];
  const name = typeof profile === "string" ? profile : isJsonObject(profile) && typeof profile.name === "string" ? profile.name : undefined;
  const id = isJsonObject(profile) && typeof profile.id === "string" ? profile.id.replaceAll("-", "") : undefined;
  const properties = isJsonObject(profile) && Array.isArray(profile.properties) ? profile.properties : [];
  let property = properties.find((property) => isJsonObject(property) && property.name === "textures");
  if (!property) {
    if (!name && !id) throw new Error("Player head has no resolvable profile");
    const cachePath = path.join(skinCache, `profile-${name ?? id}.json`);
    let session;
    try { session = JSON.parse(await readFile(cachePath, "utf8")); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    if (!session) {
      const account = id ? { id } : await fetchJson(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(name!)}`);
      session = await fetchJson(`https://sessionserver.mojang.com/session/minecraft/profile/${account.id}`);
      await writeFile(cachePath, JSON.stringify(session));
    }
    property = session.properties.find((property: { name: string }) => property.name === "textures");
  }
  if (!isJsonObject(property) || typeof property.value !== "string") throw new Error(`No skin for ${name ?? id}`);
  const texture = JSON.parse(Buffer.from(property.value, "base64").toString()).textures.SKIN.url;
  const url = new URL(texture);
  if (url.hostname !== "textures.minecraft.net" || !/^\/texture\/[a-f0-9]+$/.test(url.pathname)) throw new Error("Invalid Minecraft skin URL");
  const skinPath = path.join(skinCache, `${url.pathname.split("/").at(-1)}.png`);
  try { return await readFile(skinPath); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  url.protocol = "https:";
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Skin download failed: ${response.status}`);
  const skin = Buffer.from(await response.arrayBuffer());
  await writeFile(skinPath, skin);
  return skin;
}

async function fetchJson(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Minecraft profile lookup failed: ${response.status}`);
  return response.json();
}

export async function renderResolvedHead(skin: Buffer) {
  const faces = (offset: number) => Object.fromEntries(Object.entries({
    north: [8, 8, 16, 16], south: [24, 8, 32, 16], east: [0, 8, 8, 16], west: [16, 8, 24, 16], up: [8, 0, 16, 8], down: [16, 0, 24, 8],
  }).map(([face, uv]) => [face, { texture: "#skin", uv: uv.map((value, index) => (value + (index % 2 === 0 ? offset : 0)) / 4) }]));
  const model = { textures: { skin: "website:skin" }, elements: [
    { from: [4, 4, 4], to: [12, 12, 12], faces: faces(0) },
    { from: [3.75, 3.75, 3.75], to: [12.25, 12.25, 12.25], faces: faces(32) },
  ] } as ModelJson;
  return renderModel({ model, assets: { read: (file) => file === "assets/website/textures/skin.png" ? skin : undefined, list: () => [] }, display: { rotation: [25, 145, 0] }, width: 128, height: 128 });
}
