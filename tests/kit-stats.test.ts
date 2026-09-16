import assert from "node:assert/strict";
import test from "node:test";
import { queryKitStats } from "../src/db/kit-stats-query";
import * as schema from "../src/db/schema";
import { createTestDatabase } from "./support/database";

test("kit aggregates follow edition kit snapshots instead of assuming stable numeric IDs", async (t) => {
  const { database, close } = await createTestDatabase(t);

  try {
    const [edition] = await database
      .insert(schema.editions)
      .values({
        number: 1,
        status: "archived",
        minecraftVersion: "26.1",
        statisticsSchemaVersion: 7,
      })
      .returning({ id: schema.editions.id });

    await database.insert(schema.players).values([
      {
        uuid: "11111111-1111-4111-8111-111111111111",
        currentMinecraftName: "Cible",
      },
      {
        uuid: "22222222-2222-4222-8222-222222222222",
        currentMinecraftName: "Source",
      },
    ]);
    await database.insert(schema.kitSnapshots).values([
      {
        editionId: edition.id,
        kitKey: "archer",
        kitId: 42,
        manifestSchemaVersion: 2,
        manifest: {},
      },
      {
        editionId: edition.id,
        kitKey: "pigeon",
        kitId: 3,
        manifestSchemaVersion: 2,
        manifest: {},
      },
    ]);
    await database.insert(schema.editionStatisticsMetadata).values({
      editionId: edition.id,
      deathPositionMetadata: {},
      elo: {},
    });
    await database.insert(schema.editionPicks).values([
      {
        editionId: edition.id,
        playerUuid: "11111111-1111-4111-8111-111111111111",
        kitId: 42,
        totalTimeTicks: 2_400,
        count: 4,
      },
      {
        editionId: edition.id,
        playerUuid: "11111111-1111-4111-8111-111111111111",
        kitId: 3,
        totalTimeTicks: 1_200,
        count: 2,
      },
    ]);
    await database.insert(schema.editionKills).values([
      {
        editionId: edition.id,
        killerUuid: null,
        killerKitId: 42,
        victimUuid: null,
        victimKitId: 3,
        causeId: 1,
        count: 6,
      },
      {
        editionId: edition.id,
        killerUuid: null,
        killerKitId: 3,
        victimUuid: null,
        victimKitId: 42,
        causeId: 1,
        count: 3,
      },
    ]);
    await database.insert(schema.editionDamageReceived).values({
      editionId: edition.id,
      targetUuid: "11111111-1111-4111-8111-111111111111",
      targetKitId: 3,
      sourceUuid: "22222222-2222-4222-8222-222222222222",
      sourceKitId: 42,
      causeId: 1,
      amount: 24,
    });

    const snapshot = await queryKitStats(database);

    assert.equal(snapshot.editionCount, 1);
    assert.equal(snapshot.totalPicks, 6);
    assert.deepEqual(snapshot.byKitKey.archer, {
      picks: 4,
      totalTimeTicks: 2_400,
      kills: 6,
      deaths: 3,
      damageDealt: 24,
    });
  } finally {
    close();
  }
});

test("kit stats only use the latest public edition", async (t) => {
  const { database, close } = await createTestDatabase(t);

  try {
    const editionRows = await database
      .insert(schema.editions)
      .values([
        {
          number: 3,
          status: "archived",
          minecraftVersion: "1.20.2",
          statisticsSchemaVersion: 7,
        },
        {
          number: 4,
          status: "published",
          minecraftVersion: "1.21.1",
          statisticsSchemaVersion: 7,
        },
      ])
      .returning({ id: schema.editions.id, number: schema.editions.number });
    const edition3 = editionRows.find((edition) => edition.number === 3)!;
    const edition4 = editionRows.find((edition) => edition.number === 4)!;

    await database.insert(schema.players).values({
      uuid: "44444444-4444-4444-8444-444444444444",
      currentMinecraftName: "LatestPlayer",
    });
    await database.insert(schema.kitSnapshots).values([
      {
        editionId: edition3.id,
        kitKey: "archer",
        kitId: 1,
        manifestSchemaVersion: 2,
        manifest: {},
      },
      {
        editionId: edition4.id,
        kitKey: "archer",
        kitId: 8,
        manifestSchemaVersion: 2,
        manifest: {},
      },
    ]);
    await database.insert(schema.editionStatisticsMetadata).values([
      { editionId: edition3.id, deathPositionMetadata: {}, elo: {} },
      { editionId: edition4.id, deathPositionMetadata: {}, elo: {} },
    ]);
    await database.insert(schema.editionPicks).values([
      {
        editionId: edition3.id,
        playerUuid: "44444444-4444-4444-8444-444444444444",
        kitId: 1,
        totalTimeTicks: 12_000,
        count: 20,
      },
      {
        editionId: edition4.id,
        playerUuid: "44444444-4444-4444-8444-444444444444",
        kitId: 8,
        totalTimeTicks: 1_800,
        count: 3,
      },
    ]);

    const snapshot = await queryKitStats(database);

    assert.equal(snapshot.editionCount, 1);
    assert.equal(snapshot.totalPicks, 3);
    assert.equal(snapshot.byKitKey.archer.picks, 3);
    assert.equal(snapshot.byKitKey.archer.totalTimeTicks, 1_800);
  } finally {
    close();
  }
});

test("a newer public edition with no statistics never falls back to an older edition", async (t) => {
  const { database, close } = await createTestDatabase(t);

  try {
    const editionRows = await database
      .insert(schema.editions)
      .values([
        {
          number: 4,
          status: "archived",
          minecraftVersion: "1.21.1",
          statisticsSchemaVersion: 7,
        },
        {
          number: 5,
          status: "published",
          minecraftVersion: "1.21.4",
          statisticsSchemaVersion: 7,
        },
      ])
      .returning({ id: schema.editions.id, number: schema.editions.number });
    const edition4 = editionRows.find((edition) => edition.number === 4)!;

    await database.insert(schema.players).values({
      uuid: "55555555-5555-4555-8555-555555555555",
      currentMinecraftName: "OlderPlayer",
    });
    await database.insert(schema.kitSnapshots).values({
      editionId: edition4.id,
      kitKey: "archer",
      kitId: 8,
      manifestSchemaVersion: 2,
      manifest: {},
    });
    await database.insert(schema.editionStatisticsMetadata).values({
      editionId: edition4.id,
      deathPositionMetadata: {},
      elo: {},
    });
    await database.insert(schema.editionPicks).values({
      editionId: edition4.id,
      playerUuid: "55555555-5555-4555-8555-555555555555",
      kitId: 8,
      totalTimeTicks: 9_000,
      count: 15,
    });

    const snapshot = await queryKitStats(database);

    assert.equal(snapshot.editionCount, 1);
    assert.equal(snapshot.totalPicks, 0);
    assert.deepEqual(snapshot.byKitKey, {});
  } finally {
    close();
  }
});

test("draft editions do not leak into public kit aggregates", async (t) => {
  const { database, close } = await createTestDatabase(t);
  try {
    const [edition] = await database
      .insert(schema.editions)
      .values({
        number: 99,
        status: "draft",
        minecraftVersion: "26.1",
        statisticsSchemaVersion: 7,
      })
      .returning({ id: schema.editions.id });
    await database.insert(schema.players).values({
      uuid: "33333333-3333-4333-8333-333333333333",
      currentMinecraftName: "DraftPlayer",
    });
    await database.insert(schema.kitSnapshots).values({
      editionId: edition.id,
      kitKey: "draft-kit",
      kitId: 1,
      manifestSchemaVersion: 2,
      manifest: {},
    });
    await database.insert(schema.editionStatisticsMetadata).values({
      editionId: edition.id,
      deathPositionMetadata: {},
      elo: {},
    });
    await database.insert(schema.editionPicks).values({
      editionId: edition.id,
      playerUuid: "33333333-3333-4333-8333-333333333333",
      kitId: 1,
      totalTimeTicks: 600,
      count: 2,
    });

    assert.deepEqual(await queryKitStats(database), {
      editionCount: 0,
      totalPicks: 0,
      byKitKey: {},
    });
  } finally {
    close();
  }
});
