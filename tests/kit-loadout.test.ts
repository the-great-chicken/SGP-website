import assert from "node:assert/strict";
import test from "node:test";
import type { KitItem, KitOperation } from "../src/lib/kit-manifest";
import { resolveKitLoadout } from "../src/lib/kit-loadout";

test("/give distributes non-stackable items through the hotbar before the inventory", () => {
  const main = give("minecraft:trident", 1, 1, { "minecraft:custom_name": "Main" });
  const reserve = give("minecraft:trident", 17, 2, { "minecraft:custom_name": "Reserve" });
  const loadout = resolveKitLoadout([main, reserve]);

  assert.equal(loadout.bySlot.get("hotbar.0")?.operation.item.components["minecraft:custom_name"], "Main");
  for (let index = 1; index < 9; index += 1) {
    assert.equal(loadout.bySlot.get(`hotbar.${index}`)?.operation.item.components["minecraft:custom_name"], "Reserve");
    assert.equal(loadout.bySlot.get(`hotbar.${index}`)?.operation.item.count, 1);
  }
  assert.equal(loadout.inventory.length, 9);
  assert.ok(loadout.inventory.every((entry) => entry.operation.item.count === 1));
  assert.equal(loadout.overflow.length, 0);
});

test("later explicit replacements overwrite slots previously filled by /give", () => {
  const loadout = resolveKitLoadout([
    give("minecraft:potion", 3, 1),
    replace("hotbar.1", "minecraft:cooked_cod", 64, 2),
  ]);

  assert.equal(loadout.bySlot.get("hotbar.0")?.operation.item.id, "minecraft:potion");
  assert.equal(loadout.bySlot.get("hotbar.1")?.operation.item.id, "minecraft:cooked_cod");
  assert.equal(loadout.bySlot.get("hotbar.2")?.operation.item.id, "minecraft:potion");
});

test("/give uses free hotbar positions around explicitly occupied slots", () => {
  const loadout = resolveKitLoadout([
    replace("hotbar.0", "minecraft:wooden_sword", 1, 1),
    replace("hotbar.1", "minecraft:bow", 1, 2),
    replace("hotbar.2", "minecraft:golden_apple", 3, 3),
    replace("hotbar.3", "minecraft:cooked_beef", 64, 4),
    replace("hotbar.7", "minecraft:tipped_arrow", 5, 5),
    give("minecraft:potion", 3, 6),
  ]);

  assert.equal(loadout.bySlot.get("hotbar.4")?.operation.item.id, "minecraft:potion");
  assert.equal(loadout.bySlot.get("hotbar.5")?.operation.item.id, "minecraft:potion");
  assert.equal(loadout.bySlot.get("hotbar.6")?.operation.item.id, "minecraft:potion");
  assert.equal(loadout.inventory.length, 0);
});

test("explicit inventory slots stay in the inventory section", () => {
  const operation = replace("inventory.8", "minecraft:stone", 32, 1);
  const loadout = resolveKitLoadout([operation]);

  assert.equal(loadout.bySlot.get("inventory.8")?.operation.item.id, "minecraft:stone");
  assert.deepEqual(loadout.inventory.map((entry) => entry.slot), ["inventory.8"]);
});

test("stackable /give items split according to their stack size", () => {
  const loadout = resolveKitLoadout([
    give("minecraft:stone", 70, 1, { "minecraft:max_stack_size": 64 }),
  ]);

  assert.equal(loadout.bySlot.get("hotbar.0")?.operation.item.count, 64);
  assert.equal(loadout.bySlot.get("hotbar.1")?.operation.item.count, 6);
  assert.equal(loadout.inventory.length, 0);
});

function give(
  id: string,
  count: number,
  line: number,
  components: KitItem["components"] = {},
): KitOperation {
  return operation("give", undefined, id, count, line, components);
}

function replace(
  slot: string,
  id: string,
  count: number,
  line: number,
  components: KitItem["components"] = {},
): KitOperation {
  return operation("replace", slot, id, count, line, components);
}

function operation(
  kind: KitOperation["kind"],
  slot: string | undefined,
  id: string,
  count: number,
  line: number,
  components: KitItem["components"],
): KitOperation {
  return {
    kind,
    ...(slot ? { slot } : {}),
    item: { id, count, components, removedComponents: [] },
    source: { line, endLine: line },
  };
}
