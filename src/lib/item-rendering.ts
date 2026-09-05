import type { JsonValue, KitItem } from "./kit-manifest";

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
