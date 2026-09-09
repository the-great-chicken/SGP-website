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
