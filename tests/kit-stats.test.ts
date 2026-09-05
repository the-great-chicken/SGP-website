import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { queryKitStats } from "../src/db/kit-stats-query";
import * as schema from "../src/db/schema";

test("kit aggregates follow edition kit snapshots instead of assuming stable numeric IDs", async () => {
  const client = createClient({ url: "file::memory:" });
  const database = drizzle(client, { schema });

  try {
    await migrate(database, { migrationsFolder: resolve("drizzle") });
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
    client.close();
  }
});
