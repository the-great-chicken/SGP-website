import type { JsonValue, KitItem } from "./kit-manifest";


const potionEffectColors: Record<string, number> = {
  speed: 0x33ebff,
  slowness: 0x8bafe0,
  haste: 0xd9c043,
  mining_fatigue: 0x4a4217,
  strength: 0xffc700,
  instant_health: 0xf82423,
  instant_damage: 0xa9656a,
  jump_boost: 0xfdff84,
  nausea: 0x551d4a,
  regeneration: 0xcd5cab,
  resistance: 0x9146f0,
  fire_resistance: 0xff9900,
  water_breathing: 0x98dac0,
  invisibility: 0xf6f6f6,
  blindness: 0x1f1f23,
  night_vision: 0xc2ff66,
  hunger: 0x587653,
  weakness: 0x484d48,
  poison: 0x87a363,
  wither: 0x736156,
  health_boost: 0xf87d23,
  absorption: 0x2552a5,
  saturation: 0xf82423,
  glowing: 0x94a061,
  levitation: 0xceffff,
  luck: 0x59c106,
  unluck: 0xc0a44d,
  slow_falling: 0xf3cfb9,
  conduit_power: 0x1dc2d1,
  dolphins_grace: 0x88a3be,
  bad_omen: 0x0b6138,
  hero_of_the_village: 0x44ff44,
  darkness: 0x292721,
  trial_omen: 0x16a6a6,
  raid_omen: 0xde4058,
  wind_charged: 0xbdc9ff,
  weaving: 0x78695a,
  oozing: 0x99ffa3,
  infested: 0x8c9b8c,
  breath_of_the_nautilus: 0x00ffee,
};

export type ItemRenderIndex = {
  schemaVersion: 2;
  datapackRelease: string;
  resourcePackRelease: string;
  minecraftVersion: string;
  items: Record<string, string>;
};

export function getItemRenderMismatch(
  index: ItemRenderIndex,
  manifest: KitManifestIdentity,
): string | null {
  if (index.datapackRelease !== manifest.datapackRelease) {
    return `datapack release ${index.datapackRelease} does not match ${manifest.datapackRelease}`;
  }
  if (index.resourcePackRelease !== manifest.resourcePackRelease) {
    return `resource-pack release ${index.resourcePackRelease} does not match ${manifest.resourcePackRelease}`;
  }
  if (index.minecraftVersion !== manifest.minecraftVersion) {
    return `Minecraft version ${index.minecraftVersion} does not match ${manifest.minecraftVersion}`;
  }
  return null;
}

type KitManifestIdentity = {
  datapackRelease: string;
  resourcePackRelease: string;
  minecraftVersion: string;
};

export function getItemRenderSignature(item: KitItem): string {
  return stableStringify({
    id: item.id,
    count: item.count,
    components: item.components,
  });
}

export function getItemRenderInput(item: KitItem): {
  id: string;
  components: Record<string, JsonValue>;
} {
  const itemModel = item.components["minecraft:item_model"];
  const components: Record<string, JsonValue> = { ...item.components, count: item.count };
  const potionContents = components["minecraft:potion_contents"];

  if (typeof potionContents === "string") {
    components["minecraft:potion_contents"] = { potion: potionContents };
  } else if (
    isJsonObject(potionContents) &&
    typeof potionContents.custom_color !== "number" &&
    typeof potionContents.potion !== "string"
  ) {
    const customColor = computeCustomPotionColor(potionContents.custom_effects);
    if (customColor !== null) {
      components["minecraft:potion_contents"] = {
        ...potionContents,
        custom_color: customColor,
      };
    }
  }

  return {
    id: typeof itemModel === "string" ? itemModel : item.id,
    components,
  };
}

export function stableStringify(value: JsonValue): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  const entries = Object.entries(value).toSorted(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(",")}}`;
}

function computeCustomPotionColor(value: JsonValue | undefined): number | null {
  if (!Array.isArray(value)) return null;

  let red = 0;
  let green = 0;
  let blue = 0;
  let totalWeight = 0;

  for (const effect of value) {
    if (!isJsonObject(effect) || typeof effect.id !== "string") continue;
    const id = stripNamespace(effect.id);
    const color = potionEffectColors[id];
    if (color === undefined) continue;

    const amplifier =
      typeof effect.amplifier === "number" && Number.isFinite(effect.amplifier)
        ? Math.max(0, Math.trunc(effect.amplifier))
        : 0;
    const weight = amplifier + 1;
    red += weight * ((color >> 16) & 0xff);
    green += weight * ((color >> 8) & 0xff);
    blue += weight * (color & 0xff);
    totalWeight += weight;
  }

  if (!totalWeight) return null;
  return (
    (Math.round(red / totalWeight) << 16) |
    (Math.round(green / totalWeight) << 8) |
    Math.round(blue / totalWeight)
  ) >>> 0;
}

function isJsonObject(value: JsonValue | undefined): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stripNamespace(id: string) {
  const separator = id.indexOf(":");
  return separator === -1 ? id : id.slice(separator + 1);
}
