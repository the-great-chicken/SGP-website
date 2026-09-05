import { and, eq, gt, lte } from "drizzle-orm";
import type { DiscordIdentity } from "./discord";
import { authSessions, players } from "@/db/schema";

type SgpDatabase = typeof import("@/db/client").db;

export type AuthSession = {
  discord: DiscordIdentity;
  player: {
    uuid: string;
    minecraftName: string;
  } | null;
  expiresAt: Date;
};

export async function storeAuthSession(
  database: SgpDatabase,
  tokenHash: string,
  discord: DiscordIdentity,
  expiresAt: Date,
  now = new Date(),
) {
  await database.transaction(async (transaction) => {
    await transaction.delete(authSessions).where(lte(authSessions.expiresAt, now));
    await transaction.insert(authSessions).values({
      tokenHash,
      discordId: discord.id,
      discordUsername: discord.username,
      discordDisplayName: discord.displayName,
      discordAvatarUrl: discord.avatarUrl,
      expiresAt,
    });
    await transaction
      .update(players)
      .set({
        discordUsername: discord.username,
        discordDisplayName: discord.displayName,
        discordAvatarUrl: discord.avatarUrl,
        updatedAt: now,
      })
      .where(eq(players.discordId, discord.id));
  });
}

export async function queryAuthSession(
  database: SgpDatabase,
  tokenHash: string,
  now = new Date(),
): Promise<AuthSession | null> {
  const [row] = await database
    .select({
      discordId: authSessions.discordId,
      discordUsername: authSessions.discordUsername,
      discordDisplayName: authSessions.discordDisplayName,
      discordAvatarUrl: authSessions.discordAvatarUrl,
      expiresAt: authSessions.expiresAt,
      playerUuid: players.uuid,
      minecraftName: players.currentMinecraftName,
    })
    .from(authSessions)
    .leftJoin(players, eq(authSessions.discordId, players.discordId))
    .where(and(eq(authSessions.tokenHash, tokenHash), gt(authSessions.expiresAt, now)))
    .limit(1);

  if (!row) return null;
  return {
    discord: {
      id: row.discordId,
      username: row.discordUsername,
      displayName: row.discordDisplayName,
      avatarUrl: row.discordAvatarUrl,
    },
    player: row.playerUuid && row.minecraftName
      ? { uuid: row.playerUuid, minecraftName: row.minecraftName }
      : null,
    expiresAt: row.expiresAt,
  };
}

export async function removeAuthSession(database: SgpDatabase, tokenHash: string) {
  await database.delete(authSessions).where(eq(authSessions.tokenHash, tokenHash));
}
