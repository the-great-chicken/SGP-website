import { eq, isNotNull } from "drizzle-orm";
import { players } from "./schema";

type SgpDatabase = typeof import("./client").db;

const uuidPattern = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const linkPattern = new RegExp(`^(\\d+) (${uuidPattern})(?:.*)?$`, "i");
const modificationTokenPattern = new RegExp(`^(?:\\d{17,}|${uuidPattern})$`, "i");
const uuidOnlyPattern = new RegExp(`^${uuidPattern}$`, "i");

export type DiscordSrvLink = {
  discordId: string;
  playerUuid: string;
};

export type MinecraftPlayerIdentity = {
  playerUuid: string;
  minecraftName: string;
};

export type DiscordSrvSyncResult = {
  linksInSource: number;
  linkedPlayers: number;
  changedPlayers: number;
  clearedPlayers: number;
  discoveredPlayers: number;
  unknownPlayers: number;
};

export function parseDiscordSrvAccountsAof(contents: string): DiscordSrvLink[] {
  const byDiscord = new Map<string, string>();
  const byUuid = new Map<string, string>();

  contents.replace(/^\uFEFF/, "").split(/\r?\n/).forEach((line, index) => {
    if (!line) return;
    const link = linkPattern.exec(line);
    if (link) {
      const discordId = link[1];
      const playerUuid = link[2].toLowerCase();
      removeDiscordLink(byDiscord, byUuid, discordId);
      removeUuidLink(byDiscord, byUuid, playerUuid);
      byDiscord.set(discordId, playerUuid);
      byUuid.set(playerUuid, discordId);
      return;
    }

    if (line.startsWith("-")) {
      const tokens = line.slice(1).trim().split(/\s+/);
      if (tokens.length >= 1 && tokens.length <= 2 && tokens.every((token) => modificationTokenPattern.test(token))) {
        for (const token of tokens) {
          if (uuidOnlyPattern.test(token)) removeUuidLink(byDiscord, byUuid, token.toLowerCase());
          else removeDiscordLink(byDiscord, byUuid, token);
        }
        return;
      }
    }

    throw new Error(`Invalid DiscordSRV accounts.aof entry on line ${index + 1}`);
  });

  return [...byDiscord].map(([discordId, playerUuid]) => ({ discordId, playerUuid }));
}

export function parseMinecraftUsercache(contents: string): MinecraftPlayerIdentity[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents.replace(/^\uFEFF/, ""));
  } catch (error) {
    throw new Error("Invalid Minecraft usercache.json: expected valid JSON", { cause: error });
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Invalid Minecraft usercache.json: expected a JSON array");
  }

  const byUuid = new Map<string, MinecraftPlayerIdentity>();
  parsed.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`Invalid Minecraft usercache.json entry at index ${index}`);
    }

    const uuid = "uuid" in entry ? entry.uuid : undefined;
    const name = "name" in entry ? entry.name : undefined;
    if (
      typeof uuid !== "string" ||
      !uuidOnlyPattern.test(uuid) ||
      typeof name !== "string" ||
      name.length === 0
    ) {
      throw new Error(`Invalid Minecraft usercache.json entry at index ${index}`);
    }

    const playerUuid = uuid.toLowerCase();
    byUuid.set(playerUuid, { playerUuid, minecraftName: name });
  });

  return [...byUuid.values()];
}

export async function syncDiscordSrvLinks(
  database: SgpDatabase,
  sourceLinks: DiscordSrvLink[],
  minecraftPlayers: MinecraftPlayerIdentity[] = [],
): Promise<DiscordSrvSyncResult> {
  return database.transaction(async (transaction) => {
    const now = new Date();
    const existingBefore = await transaction
      .select({
        uuid: players.uuid,
        currentMinecraftName: players.currentMinecraftName,
      })
      .from(players);
    const storedByNormalizedUuid = new Map(
      existingBefore.map((player) => [player.uuid.toLowerCase(), player]),
    );
    let discoveredPlayers = 0;

    for (const player of minecraftPlayers) {
      const normalizedUuid = player.playerUuid.toLowerCase();
      const stored = storedByNormalizedUuid.get(normalizedUuid);
      if (stored) {
        if (stored.currentMinecraftName !== player.minecraftName) {
          await transaction
            .update(players)
            .set({
              currentMinecraftName: player.minecraftName,
              updatedAt: now,
            })
            .where(eq(players.uuid, stored.uuid));
          storedByNormalizedUuid.set(normalizedUuid, {
            uuid: stored.uuid,
            currentMinecraftName: player.minecraftName,
          });
        }
      } else {
        await transaction.insert(players).values({
          uuid: normalizedUuid,
          currentMinecraftName: player.minecraftName,
          updatedAt: now,
        });
        storedByNormalizedUuid.set(normalizedUuid, {
          uuid: normalizedUuid,
          currentMinecraftName: player.minecraftName,
        });
        discoveredPlayers += 1;
      }
    }

    const existingPlayers = await transaction
      .select({
        uuid: players.uuid,
        discordId: players.discordId,
        discordUsername: players.discordUsername,
        discordDisplayName: players.discordDisplayName,
        discordAvatarUrl: players.discordAvatarUrl,
        updatedAt: players.updatedAt,
      })
      .from(players);
    const playersByUuid = new Map(existingPlayers.map((player) => [player.uuid.toLowerCase(), player]));
    const matchedLinks = sourceLinks.flatMap((link) => {
      const player = playersByUuid.get(link.playerUuid.toLowerCase());
      return player ? [{ link, player }] : [];
    });
    const matchedUuids = new Set(matchedLinks.map(({ player }) => player.uuid));
    const changedPlayers = matchedLinks.filter(({ link, player }) => player.discordId !== link.discordId).length;
    const clearedPlayers = existingPlayers.filter(
      (player) => player.discordId !== null && !matchedUuids.has(player.uuid),
    ).length;

    await transaction
      .update(players)
      .set({
        discordId: null,
        discordUsername: null,
        discordDisplayName: null,
        discordAvatarUrl: null,
        updatedAt: now,
      })
      .where(isNotNull(players.discordId));

    for (const { link, player } of matchedLinks) {
      const mappingUnchanged = player.discordId === link.discordId;
      await transaction
        .update(players)
        .set({
          discordId: link.discordId,
          discordUsername: mappingUnchanged ? player.discordUsername : null,
          discordDisplayName: mappingUnchanged ? player.discordDisplayName : null,
          discordAvatarUrl: mappingUnchanged ? player.discordAvatarUrl : null,
          updatedAt: mappingUnchanged ? player.updatedAt : now,
        })
        .where(eq(players.uuid, player.uuid));
    }

    return {
      linksInSource: sourceLinks.length,
      linkedPlayers: matchedLinks.length,
      changedPlayers,
      clearedPlayers,
      discoveredPlayers,
      unknownPlayers: sourceLinks.length - matchedLinks.length,
    };
  });
}

function removeDiscordLink(byDiscord: Map<string, string>, byUuid: Map<string, string>, discordId: string) {
  const uuid = byDiscord.get(discordId);
  if (uuid) byUuid.delete(uuid);
  byDiscord.delete(discordId);
}

function removeUuidLink(byDiscord: Map<string, string>, byUuid: Map<string, string>, playerUuid: string) {
  const discordId = byUuid.get(playerUuid);
  if (discordId) byDiscord.delete(discordId);
  byUuid.delete(playerUuid);
}
