import { and, count, eq, isNotNull, ne, sum } from "drizzle-orm";
import {
  editionDamageReceived,
  editionKills,
  editionPicks,
  editionStatisticsMetadata,
  editions,
  kitSnapshots,
} from "./schema";
import { emptyStats, type KitAggregateStats, type KitStatsSnapshot } from "@/lib/kit-stats";

type SgpDatabase = typeof import("./client").db;

export async function queryKitStats(database: SgpDatabase): Promise<KitStatsSnapshot> {
  const [editionRows, pickRows, killRows, deathRows, damageRows] = await Promise.all([
    database
      .select({ value: count() })
      .from(editionStatisticsMetadata)
      .innerJoin(editions, eq(editionStatisticsMetadata.editionId, editions.id))
      .where(ne(editions.status, "draft")),
    database
      .select({
        kitKey: kitSnapshots.kitKey,
        picks: sum(editionPicks.count),
        totalTimeTicks: sum(editionPicks.totalTimeTicks),
      })
      .from(editionPicks)
      .innerJoin(editions, eq(editionPicks.editionId, editions.id))
      .innerJoin(
        kitSnapshots,
        and(
          eq(editionPicks.editionId, kitSnapshots.editionId),
          eq(editionPicks.kitId, kitSnapshots.kitId),
        ),
      )
      .where(ne(editions.status, "draft"))
      .groupBy(kitSnapshots.kitKey),
    database
      .select({ kitKey: kitSnapshots.kitKey, value: sum(editionKills.count) })
      .from(editionKills)
      .innerJoin(editions, eq(editionKills.editionId, editions.id))
      .innerJoin(
        kitSnapshots,
        and(
          eq(editionKills.editionId, kitSnapshots.editionId),
          eq(editionKills.killerKitId, kitSnapshots.kitId),
        ),
      )
      .where(ne(editions.status, "draft"))
      .groupBy(kitSnapshots.kitKey),
    database
      .select({ kitKey: kitSnapshots.kitKey, value: sum(editionKills.count) })
      .from(editionKills)
      .innerJoin(editions, eq(editionKills.editionId, editions.id))
      .innerJoin(
        kitSnapshots,
        and(
          eq(editionKills.editionId, kitSnapshots.editionId),
          eq(editionKills.victimKitId, kitSnapshots.kitId),
        ),
      )
      .where(ne(editions.status, "draft"))
      .groupBy(kitSnapshots.kitKey),
    database
      .select({ kitKey: kitSnapshots.kitKey, value: sum(editionDamageReceived.amount) })
      .from(editionDamageReceived)
      .innerJoin(editions, eq(editionDamageReceived.editionId, editions.id))
      .innerJoin(
        kitSnapshots,
        and(
          eq(editionDamageReceived.editionId, kitSnapshots.editionId),
          eq(editionDamageReceived.sourceKitId, kitSnapshots.kitId),
        ),
      )
      .where(
        and(
          ne(editions.status, "draft"),
          isNotNull(editionDamageReceived.sourceUuid),
          ne(editionDamageReceived.sourceUuid, editionDamageReceived.targetUuid),
        ),
      )
      .groupBy(kitSnapshots.kitKey),
  ]);

  const byKitKey: Record<string, KitAggregateStats> = {};
  const getStats = (kitKey: string) => (byKitKey[kitKey] ??= emptyStats());

  for (const row of pickRows) {
    const stats = getStats(row.kitKey);
    stats.picks = Number(row.picks ?? 0);
    stats.totalTimeTicks = Number(row.totalTimeTicks ?? 0);
  }
  for (const row of killRows) {
    getStats(row.kitKey).kills = Number(row.value ?? 0);
  }
  for (const row of deathRows) {
    getStats(row.kitKey).deaths = Number(row.value ?? 0);
  }
  for (const row of damageRows) {
    getStats(row.kitKey).damageDealt = Number(row.value ?? 0);
  }

  return {
    editionCount: editionRows[0]?.value ?? 0,
    totalPicks: Object.values(byKitKey).reduce((total, stats) => total + stats.picks, 0),
    byKitKey,
  };
}
