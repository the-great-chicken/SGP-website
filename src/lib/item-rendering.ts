import type { JsonValue, KitItem } from "./kit-manifest";

export type ItemRenderIndex = {
  schemaVersion: 1;
  minecraftVersion: string;
  resourcePackVersion: string | null;
  items: Record<string, string>;
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
