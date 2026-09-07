import assert from "node:assert/strict";
import test from "node:test";
import { Vector3 } from "three";
import { getKitPreview, getKitWeapon } from "../src/lib/kit-preview";
import { rightHandAttachment } from "../src/lib/kit-player-scene";
import { minecraftRgb, tintKitIcon } from "../src/lib/kit-icon-color";
import type { KitDefinition, KitOperation } from "../src/lib/kit-manifest";

function kit(key: string, items: [string, string?][]): KitDefinition {
  return { key, id: 1, name: key, icon: null, color: null, ability: null, function: "", operations: items.map(([id, slot]): KitOperation => ({ kind: slot ? "replace" : "give", slot, source: { line: 1, endLine: 1 }, item: { id: `minecraft:${id}`, count: 1, components: {}, removedComponents: [] } })) };
}

test("kit previews select the main weapon, including the archer bow and given tridents", () => {
  assert.equal(getKitWeapon(kit("archer", [["wooden_sword", "hotbar.0"], ["bow", "hotbar.1"]]))?.id, "minecraft:bow");
  assert.equal(getKitWeapon(kit("poseidon", [["trident"], ["cooked_cod", "hotbar.1"]]))?.id, "minecraft:trident");
  assert.equal(getKitWeapon(kit("cancer", [["stick", "hotbar.0"], ["bow", "hotbar.1"]]))?.id, "minecraft:stick");
  assert.equal(getKitPreview(kit("peaceful", [["netherite_chestplate", "armor.chest"]])).weapon, null);
  assert.equal(getKitPreview(kit("roi", [["golden_sword", "hotbar.0"]])).weapon?.src, "/generated/kit-models/roi/held-item.json");
});

test("custom heads and elytra use their resolved textures instead of armor layers", () => {
  const preview = getKitPreview(kit("pigeon", [["player_head", "armor.head"], ["elytra", "armor.chest"], ["chainmail_boots", "armor.feet"]]));
  assert.equal(preview.armor.head.head, true);
  assert.equal(preview.armor.chest.wings, true);
  assert.equal(preview.armor.chest.src, "/generated/kit-models/pigeon/wings.png");
  assert.equal(preview.armor.feet.src, "/generated/kit-models/pigeon/feet.png");
  assert.equal(preview.armor.legs, undefined);
});

test("icon tint follows Minecraft text colors while retaining grayscale shading and alpha", () => {
  assert.deepEqual(minecraftRgb("gold"), [255, 170, 0]);
  assert.deepEqual(minecraftRgb("dark_blue"), [0, 0, 170]);
  const pixels = new Uint8Array([255, 255, 255, 255, 128, 128, 128, 100, 255, 0, 0, 0]);
  assert.deepEqual([...tintKitIcon(pixels, "aqua")].slice(0, 8), [85, 255, 255, 255, 43, 128, 128, 100]);
  assert.equal(pixels[0], 255);
});

test("multicolored icons preserve all authored RGB colors, including white details", () => {
  const pixels = new Uint8Array([255, 255, 255, 255, 240, 100, 25, 255, 20, 10, 180, 255]);
  assert.deepEqual(tintKitIcon(pixels, "dark_purple"), pixels);
});

test("native hand attachment uses Minecraft bone-relative coordinates without image fitting", () => {
  const transform = rightHandAttachment();
  const origin = new Vector3().applyMatrix4(transform);
  assert.ok(origin.distanceTo(new Vector3(-1, 10, -2)) < 1e-10);
  assert.ok(Math.abs(transform.determinant() - 1) < 1e-10);
  assert.ok(Math.abs(new Vector3(0, 16, 0).applyMatrix4(transform).distanceTo(origin) - 16) < 1e-10);
});
