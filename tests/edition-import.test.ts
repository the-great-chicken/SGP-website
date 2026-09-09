import assert from "node:assert/strict";
import test from "node:test";
import { count, eq } from "drizzle-orm";
import {
  assembleEditionBundle,
  editionBundleSchema,
  editionDetailsSchema,
  kitManifestSchema,
  statisticsSnapshotSchema,
  type EditionBundle,
} from "../src/db/edition-bundle";
import { replaceEdition, validateBundleRelations } from "../src/db/importer";
import * as schema from "../src/db/schema";
import { createTestDatabase } from "./support/database";

const playerUuid = "11111111-1111-4111-8111-111111111111";

test("edition imports are atomic replacements", async (t) => {
  const { database: db, close } = await createTestDatabase(t);

  try {
    const bundle = makeBundle(5, "Premier nom");

    await replaceEdition(db, bundle);
    await replaceEdition(db, bundle);

    const [editionCount] = await db.select({ value: count() }).from(schema.editions);
    const [edition] = await db
      .select({
        datapackVersion: schema.editions.datapackVersion,
        resourcePackVersion: schema.editions.resourcePackVersion,
      })
      .from(schema.editions);
    const [killCount] = await db.select({ value: count() }).from(schema.editionKills);
    const [playerCount] = await db.select({ value: count() }).from(schema.players);
    const [editionPlayer] = await db
      .select({ sgpId: schema.editionPlayers.sgpId })
      .from(schema.editionPlayers);

    assert.equal(editionCount.value, 1);
    assert.equal(killCount.value, 1);
    assert.equal(playerCount.value, 1);
    assert.equal(editionPlayer.sgpId, 1);
    assert.equal(edition.datapackVersion, "dp-release-1");
    assert.equal(edition.resourcePackVersion, "rp-release-1");
  } finally {
    close();
  }
});

test("reimporting an older edition does not regress the current player name", async (t) => {
  const { database: db, close } = await createTestDatabase(t);

  try {
    await replaceEdition(db, makeBundle(6, "Nom récent"));
    await replaceEdition(db, makeBundle(5, "Ancien nom"));

    const [player] = await db
      .select({ name: schema.players.currentMinecraftName })
      .from(schema.players)
      .where(eq(schema.players.uuid, playerUuid));

    assert.equal(player.name, "Nom récent");
  } finally {
    close();
  }
});

test("assembly rejects statistics and kits from different datapack releases", () => {
  const bundle = makeBundle(5, "Premier nom");
  const mismatchedManifest = {
    ...bundle.kitManifest,
    datapackRelease: "dp-release-2",
  };

  assert.throws(
    () =>
      assembleEditionBundle(
        editionDetailsSchema.parse({
          number: 5,
          name: null,
          status: "draft",
          startsAt: null,
          endsAt: null,
          publishedAt: null,
        }),
        statisticsSnapshotSchema.parse({
          $schema: "statistics-snapshot.schema.json",
          schemaVersion: 1,
          datapackRelease: "dp-release-1",
          statisticsSchemaVersion: bundle.edition.statisticsSchemaVersion,
          players: bundle.players,
          damageCauses: bundle.damageCauses,
          kills: bundle.kills,
          damageReceived: bundle.damageReceived,
          picks: bundle.picks,
          abilityMetricDefinitions: bundle.abilityMetricDefinitions,
          abilityMetrics: bundle.abilityMetrics,
          deathPositions: bundle.deathPositions,
          elo: bundle.elo,
        }),
        kitManifestSchema.parse(mismatchedManifest),
      ),
    /different datapack releases/,
  );
});

test("edition imports persist damage/death rows and report imported counts", async (t) => {
  const { database: db, close } = await createTestDatabase(t);

  try {
    const bundle = cloneBundle();
    bundle.damageReceived = [{
      targetUuid: playerUuid,
      targetKitId: 0,
      sourceUuid: playerUuid,
      sourceKitId: 0,
      causeId: 1,
      amount: 12.5,
    }];
    bundle.deathPositions.entries = [{
      dimension: "minecraft:overworld",
      x: 10.5,
      y: 64,
      z: -3.25,
      deaths: 2,
    }];

    const summary = await replaceEdition(db, bundle);
    const [damageCount] = await db.select({ value: count() }).from(schema.editionDamageReceived);
    const [deathCount] = await db.select({ value: count() }).from(schema.editionDeathPositions);

    assert.equal(summary.damage, 1);
    assert.equal(damageCount.value, 1);
    assert.equal(deathCount.value, 1);
  } finally {
    close();
  }
});

test("relation validation rejects dangling player, damage-cause, and metric references", () => {
  const unknownPlayer = "22222222-2222-4222-8222-222222222222";

  const cases: Array<{ name: string; mutate(bundle: EditionBundle): void; message: RegExp }> = [
    {
      name: "kill killer",
      mutate: (bundle) => { bundle.kills[0].killerUuid = unknownPlayer; },
      message: /kill killer references unknown player/,
    },
    {
      name: "kill cause",
      mutate: (bundle) => { bundle.kills[0].causeId = 999; },
      message: /kill references unknown damage cause 999/,
    },
    {
      name: "damage target",
      mutate: (bundle) => {
        bundle.damageReceived = [{ targetUuid: unknownPlayer, targetKitId: 0, sourceUuid: null, sourceKitId: -1, causeId: 1, amount: 1 }];
      },
      message: /damage target references unknown player/,
    },
    {
      name: "damage cause",
      mutate: (bundle) => {
        bundle.damageReceived = [{ targetUuid: playerUuid, targetKitId: 0, sourceUuid: null, sourceKitId: -1, causeId: 999, amount: 1 }];
      },
      message: /damage row references unknown damage cause 999/,
    },
    {
      name: "pick player",
      mutate: (bundle) => { bundle.picks[0].playerUuid = unknownPlayer; },
      message: /pick references unknown player/,
    },
    {
      name: "ability metric player",
      mutate: (bundle) => { bundle.abilityMetrics[0].playerUuid = unknownPlayer; },
      message: /ability metric references unknown player/,
    },
    {
      name: "ability metric definition",
      mutate: (bundle) => { bundle.abilityMetrics[0].metricId = "missing"; },
      message: /Ability metric has no definition/,
    },
    {
      name: "rating player",
      mutate: (bundle) => { bundle.elo.ratings[0].playerUuid = unknownPlayer; },
      message: /Elo rating references unknown player/,
    },
  ];

  for (const scenario of cases) {
    const bundle = cloneBundle();
    scenario.mutate(bundle);
    assert.throws(() => validateBundleRelations(bundle), scenario.message, scenario.name);
  }
});

test("relation validation rejects duplicate identities and inconsistent ability definitions", () => {
  const secondPlayerUuid = "33333333-3333-4333-8333-333333333333";
  const cases: Array<{ name: string; mutate(bundle: EditionBundle): void; message: RegExp }> = [
    {
      name: "duplicate player uuid",
      mutate: (bundle) => { bundle.players.push({ sgpId: 2, uuid: playerUuid, minecraftName: "Duplicate" }); },
      message: /duplicate player UUID/,
    },
    {
      name: "duplicate sgp id",
      mutate: (bundle) => { bundle.players.push({ sgpId: 1, uuid: secondPlayerUuid, minecraftName: "Second" }); },
      message: /duplicate sgp\.id/,
    },
    {
      name: "duplicate damage cause",
      mutate: (bundle) => { bundle.damageCauses.push({ ...bundle.damageCauses[0] }); },
      message: /duplicate damage cause/,
    },
    {
      name: "duplicate kit id",
      mutate: (bundle) => { bundle.kitManifest.kits.push({ ...structuredClone(bundle.kitManifest.kits[0]), key: "second" }); },
      message: /duplicate kit id/,
    },
    {
      name: "duplicate kit key",
      mutate: (bundle) => { bundle.kitManifest.kits.push({ ...structuredClone(bundle.kitManifest.kits[0]), id: 2 }); },
      message: /duplicate kit key/,
    },
    {
      name: "duplicate ability definition",
      mutate: (bundle) => { bundle.abilityMetricDefinitions.push(structuredClone(bundle.abilityMetricDefinitions[0])); },
      message: /duplicate ability metric definition/,
    },
    {
      name: "unknown definition kit",
      mutate: (bundle) => {
        bundle.abilityMetricDefinitions[0].kitId = 99;
        bundle.abilityMetrics[0].kitId = 99;
      },
      message: /Ability definition references unknown kit id 99/,
    },
    {
      name: "definition path not in snapshot",
      mutate: (bundle) => {
        bundle.abilityMetricDefinitions[0].abilityPath = "missing";
        bundle.abilityMetrics[0].abilityPath = "missing";
      },
      message: /Ability definition does not match the kit snapshot/,
    },
  ];

  for (const scenario of cases) {
    const bundle = cloneBundle();
    scenario.mutate(bundle);
    assert.throws(() => validateBundleRelations(bundle), scenario.message, scenario.name);
  }
});

test("edition bundle contracts reject release/version drift and incomplete publication metadata", () => {
  const resourcePackMismatch = cloneBundle();
  resourcePackMismatch.edition.resourcePackVersion = "rp-release-2";
  assert.throws(() => editionBundleSchema.parse(resourcePackMismatch), /different resource-pack releases/);

  const minecraftMismatch = cloneBundle();
  minecraftMismatch.edition.minecraftVersion = "26.2";
  assert.throws(() => editionBundleSchema.parse(minecraftMismatch), /Minecraft versions differ/);

  assert.throws(() => editionDetailsSchema.parse({
    number: 5,
    name: "Edition 5",
    status: "published",
    startsAt: null,
    endsAt: null,
    publishedAt: null,
  }), /Published editions require publishedAt/);
});

function cloneBundle() {
  return structuredClone(makeBundle(5, "Premier nom")) as EditionBundle;
}

function makeBundle(editionNumber: number, minecraftName: string): EditionBundle {
  const combined = {
    schemaVersion: 1,
    edition: {
      number: editionNumber,
      name: `Édition ${editionNumber}`,
      status: "published",
      startsAt: "2026-08-01T16:00:00Z",
      endsAt: "2026-08-01T20:00:00Z",
      publishedAt: "2026-08-02T10:00:00Z",
      minecraftVersion: "26.1",
      datapackVersion: "dp-release-1",
      resourcePackVersion: "rp-release-1",
      statisticsSchemaVersion: 7,
    },
    kitManifest: {
      $schema: "../schemas/kit-manifest.schema.json",
      schemaVersion: 3,
      datapackRelease: "dp-release-1",
      resourcePackRelease: "rp-release-1",
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
  };

  return assembleEditionBundle(
    editionDetailsSchema.parse({
      number: combined.edition.number,
      name: combined.edition.name,
      status: combined.edition.status,
      startsAt: combined.edition.startsAt,
      endsAt: combined.edition.endsAt,
      publishedAt: combined.edition.publishedAt,
    }),
    statisticsSnapshotSchema.parse({
      $schema: "statistics-snapshot.schema.json",
      schemaVersion: 1,
      datapackRelease: "dp-release-1",
      statisticsSchemaVersion: combined.edition.statisticsSchemaVersion,
      players: combined.players,
      damageCauses: combined.damageCauses,
      kills: combined.kills,
      damageReceived: combined.damageReceived,
      picks: combined.picks,
      abilityMetricDefinitions: combined.abilityMetricDefinitions,
      abilityMetrics: combined.abilityMetrics,
      deathPositions: combined.deathPositions,
      elo: combined.elo,
    }),
    kitManifestSchema.parse(combined.kitManifest),
  );
}
