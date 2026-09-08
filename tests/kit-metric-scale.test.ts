import assert from "node:assert/strict";
import test from "node:test";
import { getKitMetricColor, getKitMetricDomains, type KitStatsSnapshot } from "../src/lib/kit-stats";

const kits = [
  { id: 0, key: "a" },
  { id: 1, key: "b" },
  { id: 2, key: "c" },
  { id: 3, key: "d" },
  { id: null, key: "non-competitive" },
];

const snapshot: KitStatsSnapshot = {
  editionCount: 1,
  totalPicks: 100,
  byKitKey: {
    a: { picks: 10, totalTimeTicks: 1_200, kills: 1, deaths: 4, damageDealt: 1 },
    b: { picks: 20, totalTimeTicks: 1_200, kills: 1, deaths: 1, damageDealt: 2 },
    c: { picks: 30, totalTimeTicks: 1_200, kills: 2, deaths: 1, damageDealt: 3 },
    d: { picks: 40, totalTimeTicks: 1_200, kills: 3, deaths: 1, damageDealt: 10 },
    "non-competitive": { picks: 99, totalTimeTicks: 1_200, kills: 99, deaths: 1, damageDealt: 99 },
  },
};

test("popularity and damage/min scales use the kit median as their midpoint", () => {
  const domains = getKitMetricDomains(kits, snapshot);

  assert.deepEqual(domains.popularity, { min: 10, midpoint: 25, max: 40 });
  assert.deepEqual(domains.damagePerMinute, { min: 1, midpoint: 2.5, max: 10 });
  assert.equal(getKitMetricColor(10, domains.popularity), "rgb(239 140 130)");
  assert.equal(getKitMetricColor(25, domains.popularity), "rgb(226 199 119)");
  assert.equal(getKitMetricColor(40, domains.popularity), "rgb(139 203 164)");
});

test("K/D uses 1.0 as the neutral midpoint regardless of the observed median", () => {
  const domains = getKitMetricDomains(kits, snapshot);

  assert.deepEqual(domains.ratio, { min: 0.25, midpoint: 1, max: 3 });
  assert.equal(getKitMetricColor(0.25, domains.ratio), "rgb(239 140 130)");
  assert.equal(getKitMetricColor(1, domains.ratio), "rgb(226 199 119)");
  assert.equal(getKitMetricColor(3, domains.ratio), "rgb(139 203 164)");
});
