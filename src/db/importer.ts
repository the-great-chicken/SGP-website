import { eq, inArray, max } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type { EditionBundle } from "./edition-bundle";
import * as schema from "./schema";

export type EditionImportSummary = {
  editionId: number;
  editionNumber: number;
  players: number;
  kills: number;
  damage: number;
  picks: number;
  abilityMetrics: number;
  ratings: number;
};

export async function replaceEdition(
  db: LibSQLDatabase<typeof schema>,
  bundle: EditionBundle,
): Promise<EditionImportSummary> {
  validateBundleRelations(bundle);

  return db.transaction(async (transaction) => {
    const playerUuids = bundle.players.map((player) => player.uuid);
    const latestEditionByPlayer = new Map<string, number>();

    if (playerUuids.length > 0) {
      const latestEditions = await transaction
        .select({
          playerUuid: schema.editionPlayers.playerUuid,
          editionNumber: max(schema.editions.number),
        })
        .from(schema.editionPlayers)
        .innerJoin(schema.editions, eq(schema.editionPlayers.editionId, schema.editions.id))
        .where(inArray(schema.editionPlayers.playerUuid, playerUuids))
        .groupBy(schema.editionPlayers.playerUuid);

      for (const row of latestEditions) {
        if (row.editionNumber !== null) {
          latestEditionByPlayer.set(row.playerUuid, row.editionNumber);
        }
      }
    }

    const existingEdition = await transaction
      .select({ id: schema.editions.id })
      .from(schema.editions)
      .where(eq(schema.editions.number, bundle.edition.number))
      .limit(1);

    if (existingEdition[0]) {
      await transaction
        .delete(schema.editions)
        .where(eq(schema.editions.id, existingEdition[0].id));
    }

    if (bundle.players.length > 0) {
      await insertInChunks(bundle.players, (players) =>
        transaction
          .insert(schema.players)
          .values(
            players.map((player) => ({
              uuid: player.uuid,
              currentMinecraftName: player.minecraftName,
            })),
          )
          .onConflictDoNothing(),
      );

      for (const player of bundle.players) {
        const latestEdition = latestEditionByPlayer.get(player.uuid);
        if (latestEdition === undefined || latestEdition <= bundle.edition.number) {
          await transaction
            .update(schema.players)
            .set({
              currentMinecraftName: player.minecraftName,
              updatedAt: new Date(),
            })
            .where(eq(schema.players.uuid, player.uuid));
        }
      }
    }

    const insertedEdition = await transaction
      .insert(schema.editions)
      .values({
        number: bundle.edition.number,
        name: bundle.edition.name,
        status: bundle.edition.status,
        startsAt: toDate(bundle.edition.startsAt),
        endsAt: toDate(bundle.edition.endsAt),
        publishedAt: toDate(bundle.edition.publishedAt),
        minecraftVersion: bundle.edition.minecraftVersion,
        datapackVersion: bundle.edition.datapackVersion,
        resourcePackVersion: bundle.edition.resourcePackVersion,
        statisticsSchemaVersion: bundle.edition.statisticsSchemaVersion,
      })
      .returning({ id: schema.editions.id });
    const editionId = insertedEdition[0].id;

    await insertInChunks(bundle.players, (players) =>
      transaction.insert(schema.editionPlayers).values(
        players.map((player) => ({
          editionId,
          playerUuid: player.uuid,
          sgpId: player.sgpId,
          minecraftNameAtEvent: player.minecraftName,
        })),
      ),
    );

    await insertInChunks(bundle.kitManifest.kits, (kits) =>
      transaction.insert(schema.kitSnapshots).values(
        kits.map((kit) => ({
          editionId,
          kitKey: kit.key,
          kitId: kit.id,
          manifestSchemaVersion: bundle.kitManifest.schemaVersion,
          manifest: kit as unknown as Record<string, unknown>,
        })),
      ),
    );

    await insertInChunks(bundle.damageCauses, (causes) =>
      transaction.insert(schema.editionDamageCauses).values(
        causes.map((cause) => ({
          editionId,
          causeId: cause.id,
          name: cause.name,
        })),
      ),
    );

    await insertInChunks(bundle.kills, (kills) =>
      transaction.insert(schema.editionKills).values(
        kills.map((kill) => ({
          editionId,
          killerUuid: kill.killerUuid,
          killerKitId: kill.killerKitId,
          victimUuid: kill.victimUuid,
          victimKitId: kill.victimKitId,
          causeId: kill.causeId,
          count: kill.count,
        })),
      ),
    );

    await insertInChunks(bundle.damageReceived, (damageRows) =>
      transaction.insert(schema.editionDamageReceived).values(
        damageRows.map((damage) => ({
          editionId,
          targetUuid: damage.targetUuid,
          targetKitId: damage.targetKitId,
          sourceUuid: damage.sourceUuid,
          sourceKitId: damage.sourceKitId,
          causeId: damage.causeId,
          amount: damage.amount,
        })),
      ),
    );

    await insertInChunks(bundle.picks, (picks) =>
      transaction.insert(schema.editionPicks).values(
        picks.map((pick) => ({
          editionId,
          playerUuid: pick.playerUuid,
          kitId: pick.kitId,
          totalTimeTicks: pick.totalTimeTicks,
          count: pick.count,
        })),
      ),
    );

    await insertInChunks(bundle.abilityMetricDefinitions, (definitions) =>
      transaction.insert(schema.editionAbilityMetricDefinitions).values(
        definitions.map((definition) => ({
          editionId,
          kitId: definition.kitId,
          abilityPath: definition.abilityPath,
          metricId: definition.metricId,
          name: definition.name,
          description: definition.description,
          cooldownTicks: definition.cooldownTicks,
          durationTicks: definition.durationTicks,
          settings: definition.settings,
          storedUnit: definition.storedUnit,
          displayUnit: definition.displayUnit,
          displayScale: definition.displayScale,
          source: definition.source,
        })),
      ),
    );

    await insertInChunks(bundle.abilityMetrics, (metrics) =>
      transaction.insert(schema.editionAbilityMetrics).values(
        metrics.map((metric) => ({
          editionId,
          playerUuid: metric.playerUuid,
          kitId: metric.kitId,
          abilityPath: metric.abilityPath,
          metricId: metric.metricId,
          value: metric.value,
        })),
      ),
    );

    await insertInChunks(bundle.deathPositions.entries, (positions) =>
      transaction.insert(schema.editionDeathPositions).values(
        positions.map((position) => ({
          editionId,
          dimension: position.dimension,
          x: position.x,
          y: position.y,
          z: position.z,
          deaths: position.deaths,
        })),
      ),
    );

    await transaction.insert(schema.editionStatisticsMetadata).values({
      editionId,
      deathPositionMetadata: bundle.deathPositions.metadata,
      elo: bundle.elo.metadata,
    });

    await insertInChunks(bundle.elo.ratings, (ratings) =>
      transaction.insert(schema.playerRatings).values(
        ratings.map((rating) => ({
          editionId,
          playerUuid: rating.playerUuid,
          rating: rating.rating,
          ratedEncounters: rating.ratedEncounters,
        })),
      ),
    );

    return {
      editionId,
      editionNumber: bundle.edition.number,
      players: bundle.players.length,
      kills: bundle.kills.length,
      damage: bundle.damageReceived.length,
      picks: bundle.picks.length,
      abilityMetrics: bundle.abilityMetrics.length,
      ratings: bundle.elo.ratings.length,
    };
  });
}

function validateBundleRelations(bundle: EditionBundle) {
  const playerUuids = unique(
    bundle.players.map((player) => player.uuid),
    "player UUID",
  );
  unique(
    bundle.players.map((player) => player.sgpId.toString()),
    "sgp.id",
  );

  const causeIds = unique(
    bundle.damageCauses.map((cause) => cause.id.toString()),
    "damage cause",
  );
  const kitIds = unique(
    bundle.kitManifest.kits
      .map((kit) => kit.id)
      .filter((id): id is number => id !== null)
      .map(String),
    "kit id",
  );
  const kitAbilities = new Set(
    bundle.kitManifest.kits.flatMap((kit) =>
      kit.id !== null && kit.ability !== null
        ? [`${kit.id}:${kit.ability.path}`]
        : [],
    ),
  );
  unique(
    bundle.kitManifest.kits.map((kit) => kit.key),
    "kit key",
  );

  const abilityDefinitions = unique(
    bundle.abilityMetricDefinitions.map(abilityMetricKey),
    "ability metric definition",
  );

  for (const kill of bundle.kills) {
    requirePlayer(kill.killerUuid, playerUuids, "kill killer");
    requirePlayer(kill.victimUuid, playerUuids, "kill victim");
    requireCause(kill.causeId, causeIds, "kill");
  }
  for (const damage of bundle.damageReceived) {
    requirePlayer(damage.targetUuid, playerUuids, "damage target");
    requirePlayer(damage.sourceUuid, playerUuids, "damage source");
    requireCause(damage.causeId, causeIds, "damage row");
  }
  for (const pick of bundle.picks) {
    requirePlayer(pick.playerUuid, playerUuids, "pick");
  }
  for (const metric of bundle.abilityMetrics) {
    requirePlayer(metric.playerUuid, playerUuids, "ability metric");
    if (!abilityDefinitions.has(abilityMetricKey(metric))) {
      throw new Error(`Ability metric has no definition: ${abilityMetricKey(metric)}`);
    }
  }
  for (const rating of bundle.elo.ratings) {
    requirePlayer(rating.playerUuid, playerUuids, "Elo rating");
  }

  for (const definition of bundle.abilityMetricDefinitions) {
    if (!kitIds.has(definition.kitId.toString())) {
      throw new Error(`Ability definition references unknown kit id ${definition.kitId}`);
    }
    if (!kitAbilities.has(`${definition.kitId}:${definition.abilityPath}`)) {
      throw new Error(
        `Ability definition does not match the kit snapshot: ${definition.kitId}:${definition.abilityPath}`,
      );
    }
  }
}

function abilityMetricKey(value: {
  kitId: number;
  abilityPath: string;
  metricId: string;
}) {
  return `${value.kitId}:${value.abilityPath}:${value.metricId}`;
}

function requirePlayer(
  uuid: string | null,
  players: Set<string>,
  label: string,
) {
  if (uuid !== null && !players.has(uuid)) {
    throw new Error(`${label} references unknown player ${uuid}`);
  }
}

function requireCause(causeId: number, causes: Set<string>, label: string) {
  if (!causes.has(causeId.toString())) {
    throw new Error(`${label} references unknown damage cause ${causeId}`);
  }
}

function unique(values: string[], label: string) {
  const result = new Set(values);
  if (result.size !== values.length) {
    throw new Error(`Edition bundle contains a duplicate ${label}`);
  }
  return result;
}

async function insertInChunks<T>(
  rows: T[],
  insert: (rows: T[]) => Promise<unknown>,
) {
  const chunkSize = 250;
  for (let index = 0; index < rows.length; index += chunkSize) {
    await insert(rows.slice(index, index + chunkSize));
  }
}

function toDate(value: string | null) {
  return value === null ? null : new Date(value);
}
