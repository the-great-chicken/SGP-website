import assert from "node:assert/strict";
import test from "node:test";
import {
  compareKits,
  formatActivationKeybind,
  formatKitName,
  getItemAbbreviation,
  getItemDisplayName,
  getItemLore,
  getKitAccent,
  getKitDisplayName,
  getMinecraftColor,
  getMinecraftText,
  isJsonObject,
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

test("kit presentation helpers preserve fallbacks, colors, lore and ordering", () => {
  const kit = makeKit();
  const fallback = { ...kit, id: null, key: "heavy_tank", name: null, color: null, icon: null, ability: null };
  fallback.operations = [{
    ...kit.operations[0],
    item: {
      ...kit.operations[0].item,
      components: {
        "minecraft:custom_name": { text: "Heavy Blade", color: "#123abc" },
        "minecraft:lore": [{ text: "Line one" }, "Line two"],
      },
    },
  }];

  assert.equal(formatKitName("peaceful"), "Paisible");
  assert.equal(formatKitName("heavy_tank"), "Heavy Tank");
  assert.equal(getKitDisplayName(fallback), "Heavy Tank");
  assert.equal(getKitAccent(fallback), "#123abc");
  assert.equal(getMinecraftColor("gold"), "#f0ad37");
  assert.equal(getMinecraftColor("#A0b1C2"), "#A0b1C2");
  assert.equal(getMinecraftColor("not-a-color"), undefined);
  assert.equal(formatActivationKeybind("key.drop"), "Jeter l’objet");
  assert.equal(formatActivationKeybind("key.custom_action"), "Custom Action");
  assert.deepEqual(getItemLore(fallback.operations[0].item), [{ text: "Line one" }, "Line two"]);
  assert.deepEqual(getItemLore(kit.operations[1].item), []);
  assert.equal(getItemAbbreviation(fallback.operations[0].item), "HB");
  assert.equal(getMinecraftText(undefined), "");
  assert.equal(getMinecraftText(true), "");
  assert.equal(getMinecraftText(42), "42");
  assert.equal(getMinecraftText({ translate: "translation.key", extra: ["!"] }), "translation.key!");
  assert.equal(isJsonObject({ text: "x" }), true);
  assert.equal(isJsonObject(["x"]), false);

  const first = { ...kit, id: 1, name: "Zulu" };
  const second = { ...kit, id: 2, name: "Alpha" };
  assert.ok(compareKits(first, second) < 0);
  assert.ok(compareKits(fallback, first) > 0);
  assert.ok(compareKits({ ...first, id: null, name: "Alpha" }, { ...second, id: null, name: "Zulu" }) < 0);
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
