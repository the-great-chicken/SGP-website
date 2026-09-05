import { and, eq } from "drizzle-orm";
import { cosmetics, playerCosmeticUnlocks, playerEquipment, playerCosmeticSync } from "@/db/schema";
import { categories, categorySchema, type Cosmetic, type CosmeticView, type Snapshot } from "./model";

type Database = typeof import("@/db/client").db;
export async function saveCosmeticSnapshot(database: Database, snapshot: Snapshot) {
  await database.transaction(async (tx) => {
    await tx.update(cosmetics).set({ active: false });
    for (const cosmetic of snapshot.catalogue) {
      await tx.insert(cosmetics).values({ ...cosmetic, active: true })
        .onConflictDoUpdate({ target: cosmetics.id, set: { ...cosmetic, active: true } });
    }
    await tx.delete(playerCosmeticUnlocks).where(eq(playerCosmeticUnlocks.playerUuid, snapshot.playerUuid));
    if (snapshot.unlocked.length) {
      await tx.insert(playerCosmeticUnlocks).values(snapshot.unlocked.map((cosmeticId) => ({
        playerUuid: snapshot.playerUuid, cosmeticId, source: "minecraft",
      })));
    }
    await tx.delete(playerEquipment).where(eq(playerEquipment.playerUuid, snapshot.playerUuid));
    const equipment = categories.flatMap((category) => snapshot.equipment[category] ? [{
      playerUuid: snapshot.playerUuid, category, cosmeticId: snapshot.equipment[category]!,
      updatedAt: new Date(snapshot.observedAt),
    }] : []);
    if (equipment.length) await tx.insert(playerEquipment).values(equipment);
    const sync = { playerUuid: snapshot.playerUuid, observedAt: new Date(snapshot.observedAt), issues: snapshot.issues };
    await tx.insert(playerCosmeticSync).values(sync)
      .onConflictDoUpdate({ target: playerCosmeticSync.playerUuid, set: sync });
  });
}
export async function readCosmeticCache(database: Database, playerUuid: string): Promise<CosmeticView> {
  const [sync] = await database.select().from(playerCosmeticSync).where(eq(playerCosmeticSync.playerUuid, playerUuid));
  const unlocked = await database.select({ cosmetic: cosmetics }).from(playerCosmeticUnlocks)
    .innerJoin(cosmetics, eq(cosmetics.id, playerCosmeticUnlocks.cosmeticId))
    .where(and(eq(playerCosmeticUnlocks.playerUuid, playerUuid), eq(cosmetics.active, true)));
  const equipped = await database.select({ category: playerEquipment.category, cosmetic: cosmetics }).from(playerEquipment)
    .innerJoin(cosmetics, eq(cosmetics.id, playerEquipment.cosmeticId))
    .where(and(eq(playerEquipment.playerUuid, playerUuid), eq(cosmetics.active, true)));
  const convert = (row: typeof cosmetics.$inferSelect): Cosmetic => ({
    id: row.id, category: categorySchema.parse(row.category), name: row.name, sortOrder: row.sortOrder,
  });
  return {
    status: "unavailable", observedAt: sync?.observedAt.getTime() ?? null,
    cosmetics: sync ? unlocked.map(({ cosmetic }) => convert(cosmetic)) : [],
    equipment: Object.fromEntries(categories.map((category) => {
      const row = sync && equipped.find((row) => row.category === category && row.cosmetic.category === category);
      return [category, row ? convert(row.cosmetic) : null];
    })) as CosmeticView["equipment"],
    issues: sync?.issues ?? [],
  };
}
