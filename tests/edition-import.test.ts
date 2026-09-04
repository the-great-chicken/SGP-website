import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import { createClient } from "@libsql/client";
import { count, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { editionBundleSchema, type EditionBundle } from "../src/db/edition-bundle";
import { replaceEdition } from "../src/db/importer";
import * as schema from "../src/db/schema";

const playerUuid = "11111111-1111-4111-8111-111111111111";

test("edition imports are atomic replacements", async () => {
  const client = createClient({ url: "file::memory:" });
  const db = drizzle(client, { schema });

  try {
    await migrate(db, { migrationsFolder: resolve("drizzle") });
    const bundle = makeBundle(5, "Premier nom");

    await replaceEdition(db, bundle);
    await replaceEdition(db, bundle);

    const [editionCount] = await db.select({ value: count() }).from(schema.editions);
    const [killCount] = await db.select({ value: count() }).from(schema.editionKills);
    const [playerCount] = await db.select({ value: count() }).from(schema.players);
    const [editionPlayer] = await db
      .select({ sgpId: schema.editionPlayers.sgpId })
      .from(schema.editionPlayers);

    assert.equal(editionCount.value, 1);
    assert.equal(killCount.value, 1);
    assert.equal(playerCount.value, 1);
    assert.equal(editionPlayer.sgpId, 1);
  } finally {
    client.close();
  }
});

test("reimporting an older edition does not regress the current player name", async () => {
  const client = createClient({ url: "file::memory:" });
  const db = drizzle(client, { schema });

  try {
    await migrate(db, { migrationsFolder: resolve("drizzle") });
    await replaceEdition(db, makeBundle(6, "Nom récent"));
    await replaceEdition(db, makeBundle(5, "Ancien nom"));

    const [player] = await db
      .select({ name: schema.players.currentMinecraftName })
      .from(schema.players)
      .where(eq(schema.players.uuid, playerUuid));

    assert.equal(player.name, "Nom récent");
  } finally {
    client.close();
  }
});

function makeBundle(editionNumber: number, minecraftName: string): EditionBundle {
  return editionBundleSchema.parse({
    schemaVersion: 1,
    edition: {
      number: editionNumber,
      name: `Édition ${editionNumber}`,
      status: "published",
      startsAt: "2026-08-01T16:00:00Z",
      endsAt: "2026-08-01T20:00:00Z",
      publishedAt: "2026-08-02T10:00:00Z",
      minecraftVersion: "26.1",
      datapackVersion: "test",
      resourcePackVersion: "test",
      statisticsSchemaVersion: 7,
    },
    kitManifest: {
      $schema: "../schemas/kit-manifest.schema.json",
      schemaVersion: 2,
      minecraftVersion: "26.1",
      dataPack: { id: "sgp", minFormat: 101.1, maxFormat: 101.1 },
      kits: [
        {
          id: 0,
          key: "pigeon",
          name: "Pigeon",
          color: "dark_gray",
          icon: "P",
          ability: {
            path: "pecking",
            name: "Picorage",
            description: "Attaque continuellement la cible.",
            activationKeybind: "key.drop",
            descriptionComponents: [
              { text: "Attaque continuellement la cible." },
            ],
          },
          function: "sgp.kits:collection/pigeon/items",
          operations: [
            {
              kind: "give",
              item: {
                id: "minecraft:feather",
                count: 1,
                components: {},
                removedComponents: [],
              },
              source: { line: 1, endLine: 1 },
            },
          ],
        },
      ],
    },
    players: [{ sgpId: 1, uuid: playerUuid, minecraftName }],
    damageCauses: [{ id: 1, name: "player_attack" }],
    kills: [
      {
        killerUuid: playerUuid,
        killerKitId: 0,
        victimUuid: playerUuid,
        victimKitId: 0,
        causeId: 1,
        count: 1,
      },
    ],
    damageReceived: [],
    picks: [
      {
        playerUuid,
        kitId: 0,
        totalTimeTicks: 1200,
        count: 1,
      },
    ],
    abilityMetricDefinitions: [
      {
        kitId: 0,
        abilityPath: "pecking",
        metricId: "uses",
        name: "Uses",
        description: "Valid starts.",
        cooldownTicks: 400,
        durationTicks: null,
        settings: null,
        storedUnit: "count",
        displayUnit: "uses",
        displayScale: 1,
        source: { type: "ability_field", field: "uses" },
      },
    ],
    abilityMetrics: [
      {
        playerUuid,
        kitId: 0,
        abilityPath: "pecking",
        metricId: "uses",
        value: 3,
      },
    ],
    deathPositions: {
      metadata: {
        storedUnit: "block_tenths",
        displayUnit: "blocks",
        displayScale: 0.1,
        quantization: "floor",
        positionReference: "feet",
      },
      entries: [],
    },
    elo: {
      metadata: {
        initialRating: 1000,
        kFactor: 80,
        ratingDivisor: 1050,
        metrics: [
          {
            id: "rating",
            name: "Elo rating",
            description: "Current rating.",
            storedUnit: "centi_elo",
            displayUnit: "elo",
            displayScale: 0.01,
          },
        ],
      },
      ratings: [{ playerUuid, rating: 1012.5, ratedEncounters: 4 }],
    },
  });
}
