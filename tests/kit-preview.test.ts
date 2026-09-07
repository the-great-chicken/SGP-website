import assert from "node:assert/strict";
import test from "node:test";
import { getKitPreview } from "../src/lib/kit-preview";
import type { KitDefinition, KitOperation } from "../src/lib/kit-manifest";

function kit(key: string, items: [string, string?][]): KitDefinition {
  return { key, id: 1, name: key, icon: null, color: null, ability: null, function: "", operations: items.map(([id, slot]): KitOperation => ({ kind: slot ? "replace" : "give", slot, source: { line: 1, endLine: 1 }, item: { id: `minecraft:${id}`, count: 1, components: {}, removedComponents: [] } })) };
}
const image = (item: KitOperation["item"]) => `${item.id}.png`;

test("kit previews select the main weapon, including the archer bow and given tridents", () => {
  assert.equal(getKitPreview(kit("archer", [["wooden_sword", "hotbar.0"], ["bow", "hotbar.1"]]), image).weapon?.src, "minecraft:bow.png");
  assert.equal(getKitPreview(kit("poseidon", [["trident"], ["cooked_cod", "hotbar.1"]]), image).weapon?.src, "minecraft:trident.png");
  assert.equal(getKitPreview(kit("cancer", [["stick", "hotbar.0"], ["bow", "hotbar.1"]]), image).weapon?.src, "minecraft:stick.png");
  assert.equal(getKitPreview(kit("peaceful", [["netherite_chestplate", "armor.chest"]]), image).weapon, null);
});

test("custom heads and elytra use their resolved textures instead of armor layers", () => {
  const preview = getKitPreview(kit("pigeon", [["player_head", "armor.head"], ["elytra", "armor.chest"], ["chainmail_boots", "armor.feet"]]), image);
  assert.equal(preview.armor.head.head, true);
  assert.equal(preview.armor.chest.wings, true);
  assert.equal(preview.armor.chest.src, "/generated/kit-models/pigeon/wings.png");
  assert.equal(preview.armor.feet.src, "/generated/kit-models/pigeon/feet.png");
  assert.equal(preview.armor.legs, undefined);
});
