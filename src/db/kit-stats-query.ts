import { and, desc, eq, isNotNull, ne, sum } from "drizzle-orm";
import {
  editionDamageReceived,
  editionKills,
  editionPicks,
  editions,
  kitSnapshots,
} from "./schema";
import { emptyStats, type KitAggregateStats, type KitStatsSnapshot } from "@/lib/kit-stats";

type SgpDatabase = typeof import("./client").db;

export async function queryKitStats(database: SgpDatabase): Promise<KitStatsSnapshot> {
  const [latestEdition] = await database
    .select({ id: editions.id })
    .from(editions)
    .where(ne(editions.status, "draft"))
    .orderBy(desc(editions.number))
    .limit(1);

  if (!latestEdition) {
    return {
      editionCount: 0,
      totalPicks: 0,
      byKitKey: {},
    };
  }

  const [pickRows, killRows, deathRows, damageRows] = await Promise.all([
    database
      .select({
        kitKey: kitSnapshots.kitKey,
        picks: sum(editionPicks.count),
        totalTimeTicks: sum(editionPicks.totalTimeTicks),
      })
      .from(editionPicks)
      .innerJoin(
        kitSnapshots,
        and(
          eq(editionPicks.editionId, kitSnapshots.editionId),
          eq(editionPicks.kitId, kitSnapshots.kitId),
        ),
      )
      .where(eq(editionPicks.editionId, latestEdition.id))
      .groupBy(kitSnapshots.kitKey),
    database
      .select({ kitKey: kitSnapshots.kitKey, value: sum(editionKills.count) })
      .from(editionKills)
      .innerJoin(
        kitSnapshots,
        and(
          eq(editionKills.editionId, kitSnapshots.editionId),
          eq(editionKills.killerKitId, kitSnapshots.kitId),
        ),
      )
      .where(eq(editionKills.editionId, latestEdition.id))
      .groupBy(kitSnapshots.kitKey),
    database
      .select({ kitKey: kitSnapshots.kitKey, value: sum(editionKills.count) })
      .from(editionKills)
      .innerJoin(
        kitSnapshots,
        and(
          eq(editionKills.editionId, kitSnapshots.editionId),
          eq(editionKills.victimKitId, kitSnapshots.kitId),
        ),
      )
      .where(eq(editionKills.editionId, latestEdition.id))
      .groupBy(kitSnapshots.kitKey),
    database
      .select({ kitKey: kitSnapshots.kitKey, value: sum(editionDamageReceived.amount) })
      .from(editionDamageReceived)
      .innerJoin(
        kitSnapshots,
        and(
          eq(editionDamageReceived.editionId, kitSnapshots.editionId),
          eq(editionDamageReceived.sourceKitId, kitSnapshots.kitId),
        ),
      )
      .where(
        and(
          eq(editionDamageReceived.editionId, latestEdition.id),
          isNotNull(editionDamageReceived.sourceUuid),
          ne(editionDamageReceived.sourceUuid, editionDamageReceived.targetUuid),
        ),
      )
      .groupBy(kitSnapshots.kitKey),
  ]);

  // These grouped SUMs aggregate NOT NULL columns; when a group row exists, its value is non-null.
  const byKitKey: Record<string, KitAggregateStats> = {};
  const getStats = (kitKey: string) => (byKitKey[kitKey] ??= emptyStats());

  for (const row of pickRows) {
    const stats = getStats(row.kitKey);
    stats.picks = Number(row.picks);
    stats.totalTimeTicks = Number(row.totalTimeTicks);
  }
  for (const row of killRows) {
    getStats(row.kitKey).kills = Number(row.value);
  }
  for (const row of deathRows) {
    getStats(row.kitKey).deaths = Number(row.value);
  }
  for (const row of damageRows) {
    getStats(row.kitKey).damageDealt = Number(row.value);
  }

  return {
    editionCount: 1,
    totalPicks: Object.values(byKitKey).reduce((total, stats) => total + stats.picks, 0),
    byKitKey,
  };
}
