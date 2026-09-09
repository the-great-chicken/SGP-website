export type MinecraftSkinModel = "wide" | "slim";

export type MinecraftSkinProfile = {
  textureHash: string;
  model: MinecraftSkinModel;
};

export function normalizeMinecraftUuid(uuid: string) {
  const normalized = uuid.replaceAll("-", "").toLowerCase();
  return /^[0-9a-f]{32}$/.test(normalized) ? normalized : null;
}

export function parseMinecraftSkinProfile(profile: unknown): MinecraftSkinProfile | null {
  if (!profile || typeof profile !== "object") return null;
  const properties = (profile as { properties?: unknown }).properties;
  if (!Array.isArray(properties)) return null;

  const textureProperty = properties.find((property) => {
    if (!property || typeof property !== "object") return false;
    return (property as { name?: unknown }).name === "textures";
  });
  if (!textureProperty || typeof textureProperty !== "object") return null;

  const value = (textureProperty as { value?: unknown }).value;
  if (typeof value !== "string") return null;

  try {
    const payload = JSON.parse(atob(value)) as {
      textures?: {
        SKIN?: {
          url?: unknown;
          metadata?: { model?: unknown };
        };
      };
    };
    const skin = payload.textures?.SKIN;
    if (!skin || typeof skin.url !== "string") return null;

    const url = new URL(skin.url);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.hostname !== "textures.minecraft.net") {
      return null;
    }
    const match = url.pathname.match(/^\/texture\/([0-9a-f]{64})\/?$/i);
    if (!match) return null;

    return {
      textureHash: match[1].toLowerCase(),
      model: skin.metadata?.model === "slim" ? "slim" : "wide",
    };
  } catch {
    return null;
  }
}
