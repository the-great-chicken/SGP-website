import assert from "node:assert/strict";
import test from "node:test";
import {
  getPlayerKitMetricColor,
  getPlayerKitMetricDomains,
  getPlayerKitMetricValues,
} from "../src/lib/player-kit-stat-scale";

const kits = [
  { picks: 1, kills: 2, deaths: 6, damageDealt: 100, damageReceived: 360, totalTimeTicks: 12_000 },
  { picks: 3, kills: 5, deaths: 3, damageDealt: 240, damageReceived: 220, totalTimeTicks: 12_000 },
  { picks: 8, kills: 11, deaths: 1, damageDealt: 500, damageReceived: 100, totalTimeTicks: 12_000 },
];

test("player kit comparison domains use this player's kit average as midpoint", () => {
  const domains = getPlayerKitMetricDomains(kits);
  assert.deepEqual(domains.kills, { min: 2, average: 6, max: 11 });
  assert.deepEqual(domains.deaths, { min: 1, average: 10 / 3, max: 6 });
});

test("lower-is-better metrics invert the red/green direction", () => {
  const domains = getPlayerKitMetricDomains(kits);
  assert.equal(getPlayerKitMetricColor("kills", 2, domains.kills), "rgb(239 140 130)");
  assert.equal(getPlayerKitMetricColor("kills", 11, domains.kills), "rgb(139 203 164)");
  assert.equal(getPlayerKitMetricColor("deaths", 1, domains.deaths), "rgb(139 203 164)");
  assert.equal(getPlayerKitMetricColor("deaths", 6, domains.deaths), "rgb(239 140 130)");
  assert.equal(getPlayerKitMetricColor("damageReceived", 100, domains.damageReceived), "rgb(139 203 164)");
});

test("ratio and damage/min stay unavailable when their source denominator is zero", () => {
  const values = getPlayerKitMetricValues({
    picks: 1,
    kills: 5,
    deaths: 0,
    damageDealt: 100,
    damageReceived: 0,
    totalTimeTicks: 0,
  });
  assert.equal(values.ratio, null);
  assert.equal(values.damagePerMinute, null);
});
