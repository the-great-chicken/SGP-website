import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import {
  queryLeaderboard,
  queryPlayerDirectory,
  queryPlayerProfile,
} from "../src/db/historical-stats-query";
import * as schema from "../src/db/schema";
import { createTestDatabase } from "./support/database";

const alpha = "11111111-1111-4111-8111-111111111111";
const bravo = "22222222-2222-4222-8222-222222222222";
const charlie = "33333333-3333-4333-8333-333333333333";

test("historical leaderboards preserve edition names and exclude drafts", async (t) => {
  const fixture = await createFixture(t);
  try {
    const edition = await queryLeaderboard(fixture.database, {
      editionNumber: 1,
      metric: "elo",
    });

    assert.equal(edition.editions.length, 2);
    assert.equal(edition.selectedEdition?.number, 1);
    assert.deepEqual(
      edition.entries.map((entry) => [entry.rank, entry.minecraftName, entry.value]),
      [
        [1, "Bravo", 1100],
        [2, "OldAlpha", 1050],
      ],
    );

    const lifetimeKills = await queryLeaderboard(fixture.database, {
      editionNumber: null,
      metric: "kills",
    });
    assert.deepEqual(
      lifetimeKills.entries.map((entry) => [entry.minecraftName, entry.value]),
      [
        ["AlphaPrime", 8],
        ["Bravo", 3],
      ],
    );

    const lifetimeElo = await queryLeaderboard(fixture.database, {
      editionNumber: null,
      metric: "elo",
    });
    assert.deepEqual(
      lifetimeElo.entries.map((entry) => [entry.minecraftName, entry.value]),
      [
        ["AlphaPrime", 1200],
        ["Bravo", 1150],
      ],
    );
    assert.match(lifetimeElo.entries[0].detail, /édition 2/);
  } finally {
    fixture.close();
  }
});

test("player directory searches historical names and aggregates kit history", async (t) => {
  const fixture = await createFixture(t);
  try {
    const directory = await queryPlayerDirectory(fixture.database, "oldalpha");

    assert.equal(directory.totalPlayers, 2);
    assert.equal(directory.players.length, 1);
    assert.deepEqual(directory.players[0], {
      uuid: alpha,
      minecraftName: "AlphaPrime",
      aliases: ["OldAlpha"],
      appearances: 2,
      latestEditionNumber: 2,
      kills: 8,
      bestRating: 1200,
      favoriteKitKey: "mage",
    });
  } finally {
    fixture.close();
  }
});

test("public profiles include lifetime and per-edition statistics", async (t) => {
  const fixture = await createFixture(t);
  try {
    const profile = await queryPlayerProfile(fixture.database, alpha);
    assert.ok(profile);

    assert.equal(profile.currentMinecraftName, "AlphaPrime");
    assert.deepEqual(profile.aliases, ["OldAlpha"]);
    assert.deepEqual(profile.lifetime, {
      appearances: 2,
      kills: 8,
      deaths: 3,
      damageDealt: 110,
      damageReceived: 130,
      picks: 8,
      totalTimeTicks: 9000,
      bestRating: 1200,
      latestRating: 1200,
      favoriteKitKey: "mage",
    });

    assert.equal(profile.editions[0].number, 2);
    assert.equal(profile.editions[0].rank, 1);
    assert.equal(profile.editions[0].favoriteKitKey, "mage");
    assert.deepEqual(profile.editions[0].abilityMetrics, [
      {
        kitKey: "mage",
        name: "Utilisations",
        description: "Activations réussies.",
        value: 3,
        displayUnit: "utilisations",
      },
    ]);
    assert.deepEqual(profile.editions[0].kitStats, [
      {
        kitId: 8,
        kitKey: "mage",
        picks: 2,
        totalTimeTicks: 4800,
        kills: 5,
        deaths: 2,
        damageDealt: 70,
        damageReceived: 20,
        abilityMetrics: [
          {
            kitKey: "mage",
            name: "Utilisations",
            description: "Activations réussies.",
            value: 3,
            displayUnit: "utilisations",
          },
        ],
      },
      {
        kitId: 7,
        kitKey: "warrior",
        picks: 3,
        totalTimeTicks: 2400,
        kills: 0,
        deaths: 0,
        damageDealt: 0,
        damageReceived: 0,
        abilityMetrics: [],
      },
    ]);
    assert.deepEqual(profile.editions[1].kitStats, [
      {
        kitId: 10,
        kitKey: "warrior",
        picks: 2,
        totalTimeTicks: 1200,
        kills: 3,
        deaths: 1,
        damageDealt: 40,
        damageReceived: 110,
        abilityMetrics: [],
      },
      {
        kitId: 20,
        kitKey: "mage",
        picks: 1,
        totalTimeTicks: 600,
        kills: 0,
        deaths: 0,
        damageDealt: 0,
        damageReceived: 0,
        abilityMetrics: [],
      },
    ]);
    for (const edition of profile.editions) {
      assert.equal(edition.kitStats.reduce((sum, kit) => sum + kit.kills, 0), edition.kills);
      assert.equal(edition.kitStats.reduce((sum, kit) => sum + kit.deaths, 0), edition.deaths);
      assert.equal(edition.kitStats.reduce((sum, kit) => sum + kit.damageDealt, 0), edition.damageDealt);
      assert.equal(edition.kitStats.reduce((sum, kit) => sum + kit.damageReceived, 0), edition.damageReceived);
      assert.equal(edition.kitStats.reduce((sum, kit) => sum + kit.picks, 0), edition.picks);
      assert.equal(edition.kitStats.reduce((sum, kit) => sum + kit.totalTimeTicks, 0), edition.totalTimeTicks);
    }
    assert.equal(profile.editions[1].minecraftNameAtEvent, "OldAlpha");
    assert.equal(profile.editions[1].rank, 2);
    assert.equal((await queryPlayerProfile(fixture.database, alpha.toUpperCase()))?.uuid, alpha);
    assert.equal(await queryPlayerProfile(fixture.database, charlie), null);
  } finally {
    fixture.close();
  }
});

async function createFixture(t: TestContext) {
  const { database, close } = await createTestDatabase(t);

  const insertedEditions = await database
    .insert(schema.editions)
    .values([
      {
        number: 1,
        name: "Première édition",
        status: "archived",
        startsAt: new Date("2025-01-10T19:00:00Z"),
        minecraftVersion: "1.21.4",
        statisticsSchemaVersion: 7,
      },
      {
        number: 2,
        name: "Deuxième édition",
        status: "published",
        startsAt: new Date("2026-02-14T19:00:00Z"),
        minecraftVersion: "26.1",
        statisticsSchemaVersion: 7,
      },
      {
        number: 3,
        name: "Brouillon",
        status: "draft",
        minecraftVersion: "26.1",
        statisticsSchemaVersion: 7,
      },
    ])
    .returning({ id: schema.editions.id, number: schema.editions.number });
  const editionId = (number: number) => insertedEditions.find((edition) => edition.number === number)!.id;

  await database.insert(schema.players).values([
    { uuid: alpha, currentMinecraftName: "AlphaPrime" },
    { uuid: bravo, currentMinecraftName: "Bravo" },
    { uuid: charlie, currentMinecraftName: "Charlie" },
  ]);
  await database.insert(schema.editionPlayers).values([
    { editionId: editionId(1), playerUuid: alpha, sgpId: 1, minecraftNameAtEvent: "OldAlpha" },
    { editionId: editionId(1), playerUuid: bravo, sgpId: 2, minecraftNameAtEvent: "Bravo" },
    { editionId: editionId(2), playerUuid: alpha, sgpId: 4, minecraftNameAtEvent: "AlphaPrime" },
    { editionId: editionId(2), playerUuid: bravo, sgpId: 5, minecraftNameAtEvent: "Bravo" },
    { editionId: editionId(3), playerUuid: charlie, sgpId: 8, minecraftNameAtEvent: "Charlie" },
  ]);
  await database.insert(schema.kitSnapshots).values([
    { editionId: editionId(1), kitKey: "warrior", kitId: 10, manifestSchemaVersion: 3, manifest: {} },
    { editionId: editionId(1), kitKey: "mage", kitId: 20, manifestSchemaVersion: 3, manifest: {} },
    { editionId: editionId(2), kitKey: "warrior", kitId: 7, manifestSchemaVersion: 3, manifest: {} },
    { editionId: editionId(2), kitKey: "mage", kitId: 8, manifestSchemaVersion: 3, manifest: {} },
    { editionId: editionId(3), kitKey: "draft_kit", kitId: 1, manifestSchemaVersion: 3, manifest: {} },
  ]);
  await database.insert(schema.playerRatings).values([
    { editionId: editionId(1), playerUuid: alpha, rating: 1050, ratedEncounters: 4 },
    { editionId: editionId(1), playerUuid: bravo, rating: 1100, ratedEncounters: 5 },
    { editionId: editionId(2), playerUuid: alpha, rating: 1200, ratedEncounters: 7 },
    { editionId: editionId(2), playerUuid: bravo, rating: 1150, ratedEncounters: 6 },
    { editionId: editionId(3), playerUuid: charlie, rating: 999, ratedEncounters: 99 },
  ]);
  await database.insert(schema.editionKills).values([
    { editionId: editionId(1), killerUuid: alpha, killerKitId: 10, victimUuid: bravo, victimKitId: 20, causeId: 1, count: 3 },
    { editionId: editionId(1), killerUuid: bravo, killerKitId: 20, victimUuid: alpha, victimKitId: 10, causeId: 1, count: 1 },
    { editionId: editionId(2), killerUuid: alpha, killerKitId: 8, victimUuid: bravo, victimKitId: 7, causeId: 1, count: 5 },
    { editionId: editionId(2), killerUuid: bravo, killerKitId: 7, victimUuid: alpha, victimKitId: 8, causeId: 1, count: 2 },
    { editionId: editionId(3), killerUuid: charlie, killerKitId: 1, victimUuid: null, victimKitId: -1, causeId: 1, count: 99 },
  ]);
  await database.insert(schema.editionDamageReceived).values([
    { editionId: editionId(1), targetUuid: bravo, targetKitId: 20, sourceUuid: alpha, sourceKitId: 10, causeId: 1, amount: 40 },
    { editionId: editionId(1), targetUuid: alpha, targetKitId: 10, sourceUuid: bravo, sourceKitId: 20, causeId: 1, amount: 10 },
    { editionId: editionId(1), targetUuid: alpha, targetKitId: 10, sourceUuid: alpha, sourceKitId: 10, causeId: 2, amount: 100 },
    { editionId: editionId(2), targetUuid: bravo, targetKitId: 7, sourceUuid: alpha, sourceKitId: 8, causeId: 1, amount: 70 },
    { editionId: editionId(2), targetUuid: alpha, targetKitId: 8, sourceUuid: bravo, sourceKitId: 7, causeId: 1, amount: 20 },
  ]);
  await database.insert(schema.editionPicks).values([
    { editionId: editionId(1), playerUuid: alpha, kitId: 10, totalTimeTicks: 1200, count: 2 },
    { editionId: editionId(1), playerUuid: alpha, kitId: 20, totalTimeTicks: 600, count: 1 },
    { editionId: editionId(1), playerUuid: bravo, kitId: 20, totalTimeTicks: 1800, count: 2 },
    { editionId: editionId(2), playerUuid: alpha, kitId: 7, totalTimeTicks: 2400, count: 3 },
    { editionId: editionId(2), playerUuid: alpha, kitId: 8, totalTimeTicks: 4800, count: 2 },
    { editionId: editionId(2), playerUuid: bravo, kitId: 7, totalTimeTicks: 3600, count: 4 },
  ]);
  await database.insert(schema.editionAbilityMetricDefinitions).values({
    editionId: editionId(2),
    kitId: 8,
    abilityPath: "fireball",
    metricId: "uses",
    name: "Utilisations",
    description: "Activations réussies.",
    cooldownTicks: 400,
    durationTicks: null,
    settings: null,
    storedUnit: "count",
    displayUnit: "utilisations",
    displayScale: 1,
    source: { type: "ability_field", field: "uses" },
  });
  await database.insert(schema.editionAbilityMetrics).values({
    editionId: editionId(2),
    playerUuid: alpha,
    kitId: 8,
    abilityPath: "fireball",
    metricId: "uses",
    value: 3,
  });

  return { database, close };
}
