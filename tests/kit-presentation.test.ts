import assert from "node:assert/strict";
import test from "node:test";
import {
  getItemDisplayName,
  getMinecraftText,
  toKitCardView,
  type KitDefinition,
} from "../src/lib/kit-manifest";
import { getKitMetrics } from "../src/lib/kit-stats";

test("Minecraft text is flattened without losing nested content", () => {
  assert.equal(
    getMinecraftText([
      { text: "Régénère ", color: "gray" },
      { text: "2", extra: [{ text: "❤", color: "red" }] },
      { keybind: "key.drop" },
    ]),
    "Régénère 2❤Jeter l’objet",
  );
});

test("kit card views expose searchable manifest content", () => {
  const kit = makeKit();
  const view = toKitCardView(kit);

  assert.equal(view.name, "Éclaireur");
  assert.equal(view.itemCount, 3);
  assert.equal(view.featuredItems[0].name, "Épée d’essai");
  assert.match(view.searchText, /eclaireur/);
  assert.match(view.searchText, /fumigene/);
  assert.match(view.searchText, /epee d’essai/);
  assert.equal(getItemDisplayName(kit.operations[1].item), "Tipped Arrow");
});

test("aggregate kit metrics are comparable rates rather than raw volume only", () => {
  const metrics = getKitMetrics(
    7,
    { picks: 25, totalTimeTicks: 12_000, kills: 10, deaths: 5, damageDealt: 150 },
    { editionCount: 2, totalPicks: 100 },
  );

  assert.equal(metrics[0].value, "25 %");
  assert.equal(metrics[1].value, "2");
  assert.equal(metrics[2].value, "15");
});

test("competitive metrics stay empty until an edition is available", () => {
  const metrics = getKitMetrics(1, undefined, { editionCount: 0, totalPicks: 0 });
  assert.deepEqual(
    metrics.map(({ value }) => value),
    ["—", "—", "—"],
  );
});

function makeKit(): KitDefinition {
  return {
    id: 7,
    key: "eclaireur",
    name: "Éclaireur",
    color: "aqua",
    icon: null,
    ability: {
      path: "smoke",
      name: "Fumigène",
      description: "Lance une grenade.",
      activationKeybind: "key.drop",
      descriptionComponents: [{ text: "Lance une grenade." }],
    },
    function: "sgp.kits:collection/eclaireur/items",
    operations: [
      {
        kind: "replace",
        slot: "hotbar.0",
        item: {
          id: "minecraft:stone_sword",
          count: 1,
          components: { "minecraft:custom_name": { text: "Épée d’essai" } },
          removedComponents: [],
        },
        source: { line: 1, endLine: 1 },
      },
      {
        kind: "give",
        item: {
          id: "minecraft:tipped_arrow",
          count: 2,
          components: {},
          removedComponents: [],
        },
        source: { line: 2, endLine: 2 },
      },
    ],
  };
}
