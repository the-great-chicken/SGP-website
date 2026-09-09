import "server-only";

import { normalizeMinecraftUuid, parseMinecraftSkinProfile, type MinecraftSkinModel } from "./minecraft-skin-profile";

export const defaultKitPlayerUuid = "ef4b23cf-86c6-4e23-b48d-16f527ae8602";
export const fallbackKitPlayerSkin = {
  src: "/generated/kit-models/steve.png",
  model: "wide" as MinecraftSkinModel,
};

const profileCacheSeconds = 10 * 60;

export async function resolveMinecraftSkin(uuid: string) {
  const normalizedUuid = normalizeMinecraftUuid(uuid);
  if (!normalizedUuid) return fallbackKitPlayerSkin;

  try {
    const response = await fetch(
      `https://sessionserver.mojang.com/session/minecraft/profile/${normalizedUuid}`,
      {
        next: { revalidate: profileCacheSeconds },
        signal: AbortSignal.timeout(4_000),
      },
    );
    if (response.status === 204 || !response.ok) return fallbackKitPlayerSkin;

    const skin = parseMinecraftSkinProfile(await response.json());
    if (!skin) return fallbackKitPlayerSkin;
    return {
      src: `/api/minecraft/skin/${skin.textureHash}`,
      model: skin.model,
    };
  } catch (error) {
    if (process.env.NODE_ENV !== "test") console.warn("Minecraft skin lookup failed; using the local fallback.", error);
    return fallbackKitPlayerSkin;
  }
}
