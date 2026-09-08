import assert from "node:assert/strict";
import test from "node:test";
import type { KitItem } from "../src/lib/kit-manifest";
import {
  getItemRenderInput,
  getItemRenderMismatch,
  getItemRenderSignature,
} from "../src/lib/item-rendering";

test("item signatures are stable across component key order", () => {
  const first = makeItem({
    "minecraft:custom_name": { text: "Test" },
    "minecraft:item_model": "sgp.kits:test/model",
  });
  const second = makeItem({
    "minecraft:item_model": "sgp.kits:test/model",
    "minecraft:custom_name": { text: "Test" },
  });

  assert.equal(getItemRenderSignature(first), getItemRenderSignature(second));
});

test("custom item models and shorthand potion contents become renderer inputs", () => {
  const input = getItemRenderInput(
    makeItem({
      "minecraft:item_model": "sgp.kits:cancer/speed",
      "minecraft:potion_contents": "minecraft:swiftness",
    }),
  );

  assert.equal(input.id, "sgp.kits:cancer/speed");
  assert.deepEqual(input.components["minecraft:potion_contents"], {
    potion: "minecraft:swiftness",
  });
  assert.equal(input.components.count, 1);
});

test("custom potion effects receive their Minecraft tint for item rendering", () => {
  const input = getItemRenderInput(
    makeItem({
      "minecraft:potion_contents": {
        custom_effects: [{ id: "minecraft:slowness", amplifier: 1, duration: 1760 }],
      },
    }),
  );

  assert.deepEqual(input.components["minecraft:potion_contents"], {
    custom_effects: [{ id: "minecraft:slowness", amplifier: 1, duration: 1760 }],
    custom_color: 0x8bafe0,
  });
});

test("mixed custom effects use amplifier-weighted potion colors", () => {
  const input = getItemRenderInput(
    makeItem({
      "minecraft:item_model": "sgp.kits:tank/turtle_arrow",
      "minecraft:potion_contents": {
        custom_effects: [
          { id: "slowness", amplifier: 5, duration: 160 },
          { id: "resistance", amplifier: 1, duration: 160 },
        ],
      },
    }),
  );

  assert.equal(input.id, "sgp.kits:tank/turtle_arrow");
  assert.deepEqual(input.components["minecraft:potion_contents"], {
    custom_effects: [
      { id: "slowness", amplifier: 5, duration: 160 },
      { id: "resistance", amplifier: 1, duration: 160 },
    ],
    custom_color: 0x8d95e4,
  });
});

test("an explicit custom potion color is preserved", () => {
  const input = getItemRenderInput(
    makeItem({
      "minecraft:potion_contents": {
        custom_effects: [{ id: "slowness" }],
        custom_color: 0x123456,
      },
    }),
  );

  assert.deepEqual(input.components["minecraft:potion_contents"], {
    custom_effects: [{ id: "slowness" }],
    custom_color: 0x123456,
  });
});

test("render indexes are tied to the kit and resource-pack releases", () => {
  const index = {
    schemaVersion: 2 as const,
    datapackRelease: "dp-release-1",
    resourcePackRelease: "rp-release-1",
    minecraftVersion: "26.1",
    items: {},
  };

  assert.equal(
    getItemRenderMismatch(index, {
      datapackRelease: "dp-release-1",
      resourcePackRelease: "rp-release-1",
      minecraftVersion: "26.1",
    }),
    null,
  );
  assert.match(
    getItemRenderMismatch(index, {
      datapackRelease: "dp-release-2",
      resourcePackRelease: "rp-release-1",
      minecraftVersion: "26.1",
    }) ?? "",
    /datapack release/,
  );
});

function makeItem(components: KitItem["components"]): KitItem {
  return {
    id: "minecraft:splash_potion",
    count: 1,
    components,
    removedComponents: [],
  };
}
