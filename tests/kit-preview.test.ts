import assert from "node:assert/strict";
import test from "node:test";
import { Vector3 } from "three";
import { getKitPreview, getKitWeapon } from "../src/lib/kit-preview";
import { elytraWingPose, rightHandAttachment } from "../src/lib/kit-player-scene";
import { minecraftRgb, tintKitIcon } from "../src/lib/kit-icon-color";
import { normalizeMinecraftUuid, parseMinecraftSkinProfile } from "../src/lib/minecraft-skin-profile";
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


test("elytra wings use separate vanilla cuboids instead of a negative-scale mirror", () => {
  const left = elytraWingPose(1);
  const right = elytraWingPose(-1);

  assert.deepEqual(left.pivot, [5, 0, 2]);
  assert.deepEqual(right.pivot, [-5, 0, 2]);
  assert.deepEqual(left.origin, [-10, 0, 0]);
  assert.deepEqual(right.origin, [0, 0, 0]);
  assert.equal(left.rotation[0], Math.PI / 12);
  assert.equal(right.rotation[0], Math.PI / 12);
  assert.equal(left.rotation[2], -Math.PI / 12);
  assert.equal(right.rotation[2], Math.PI / 12);
  assert.equal(left.mirror, false);
  assert.equal(right.mirror, true);
  assert.equal("scaleX" in left, false);
  assert.equal("scaleX" in right, false);
});


test("armor renderer uses Minecraft mirrored left-limb atlas positions", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("../src/lib/kit-player-scene.ts", import.meta.url), "utf8"));
  assert.match(source, /leftArm, armor\.chest\.src[\s\S]*?\[32, 48\]/);
  assert.match(source, /side === -1 \? \[0, 16\] : \[16, 48\]/);
});

test("Minecraft skin profiles accept Mojang textures and preserve the slim model", () => {
  const hash = "0123456789abcdef".repeat(4);
  const profile = {
    properties: [{
      name: "textures",
      value: btoa(JSON.stringify({
        textures: {
          SKIN: {
            url: `http://textures.minecraft.net/texture/${hash}`,
            metadata: { model: "slim" },
          },
        },
      })),
    }],
  };

  assert.equal(normalizeMinecraftUuid("ef4b23cf-86c6-4e23-b48d-16f527ae8602"), "ef4b23cf86c64e23b48d16f527ae8602");
  assert.equal(normalizeMinecraftUuid("not-a-uuid"), null);
  assert.deepEqual(parseMinecraftSkinProfile(profile), { textureHash: hash, model: "slim" });
});

test("Minecraft skin profiles reject non-Mojang texture hosts", () => {
  const hash = "abcdef0123456789".repeat(4);
  const profile = {
    properties: [{
      name: "textures",
      value: btoa(JSON.stringify({ textures: { SKIN: { url: `https://example.com/texture/${hash}` } } })),
    }],
  };

  assert.equal(parseMinecraftSkinProfile(profile), null);
});

test("Minecraft skin profiles reject malformed texture payloads and accept the default wide model", () => {
  const hash = "fedcba9876543210".repeat(4);
  const encode = (value: unknown) => btoa(JSON.stringify(value));

  assert.equal(parseMinecraftSkinProfile(null), null);
  assert.equal(parseMinecraftSkinProfile({ properties: "not-an-array" }), null);
  assert.equal(parseMinecraftSkinProfile({ properties: [] }), null);
  assert.equal(parseMinecraftSkinProfile({ properties: [{ name: "textures", value: 123 }] }), null);
  assert.equal(parseMinecraftSkinProfile({ properties: [{ name: "textures", value: btoa("{") }] }), null);
  assert.equal(parseMinecraftSkinProfile({ properties: [{ name: "textures", value: encode({ textures: {} }) }] }), null);
  assert.equal(
    parseMinecraftSkinProfile({
      properties: [{ name: "textures", value: encode({ textures: { SKIN: { url: `ftp://textures.minecraft.net/texture/${hash}` } } }) }],
    }),
    null,
  );
  assert.equal(
    parseMinecraftSkinProfile({
      properties: [{ name: "textures", value: encode({ textures: { SKIN: { url: `https://textures.minecraft.net/not-texture/${hash}` } } }) }],
    }),
    null,
  );
  assert.deepEqual(
    parseMinecraftSkinProfile({
      properties: [{ name: "textures", value: encode({ textures: { SKIN: { url: `https://textures.minecraft.net/texture/${hash}` } } }) }],
    }),
    { textureHash: hash, model: "wide" },
  );
});
