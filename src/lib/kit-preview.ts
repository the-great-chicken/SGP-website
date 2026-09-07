import { getItemDisplayName, type KitDefinition } from "./kit-manifest";

export function getKitIconSrc(kit: Pick<KitDefinition, "key" | "icon">) {
  return kit.icon ? `/generated/kit-models/${kit.key}/icon.png` : null;
}

export function getKitPreview(kit: KitDefinition, resolveImage: (item: KitDefinition["operations"][number]["item"]) => string | null) {
  const armor: Record<string, { src: string; head: boolean; wings: boolean }> = {};
  for (const operation of kit.operations) {
    if (!operation.slot?.startsWith("armor.")) continue;
    const slot = operation.slot.slice(6);
    const wings = operation.item.id === "minecraft:elytra";
    armor[slot] = { src: `/generated/kit-models/${kit.key}/${wings ? "wings" : slot}.png`, head: operation.item.id === "minecraft:player_head", wings };
  }
  const weapon = kit.operations.find((operation) => operation.slot === "weapon.mainhand")
    ?? (kit.key === "archer" ? kit.operations.find((operation) => operation.item.id === "minecraft:bow") : undefined)
    ?? kit.operations.find((operation) => operation.slot === "hotbar.0")
    ?? kit.operations.find((operation) => /minecraft:(.*_sword|.*_axe|trident|bow|crossbow|mace)$/.test(operation.item.id));
  return { armor, weapon: weapon ? { src: resolveImage(weapon.item), name: getItemDisplayName(weapon.item) } : null };
}

export type KitPreview = ReturnType<typeof getKitPreview>;
