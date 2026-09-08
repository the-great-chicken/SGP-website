import "dotenv/config";

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { databaseClient, db } from "./client";
import {
  parseDiscordSrvAccountsAof,
  parseMinecraftUsercache,
  syncDiscordSrvLinks,
  type MinecraftPlayerIdentity,
} from "./discordsrv";

async function main() {
  const sourcePath = process.argv[2] ?? process.env.DISCORDSRV_ACCOUNTS_PATH;
  if (!sourcePath) {
    throw new Error("Pass the DiscordSRV accounts.aof path or set DISCORDSRV_ACCOUNTS_PATH.");
  }

  const accountsPath = resolve(sourcePath);
  const explicitUsercachePath = process.argv[3] ?? process.env.MINECRAFT_USERCACHE_PATH;
  const inferredUsercachePath = resolve(dirname(accountsPath), "..", "..", "usercache.json");
  const usercachePath = resolve(explicitUsercachePath ?? inferredUsercachePath);

  const links = parseDiscordSrvAccountsAof(await readFile(accountsPath, "utf8"));
  const minecraftPlayers = await readMinecraftPlayers(usercachePath, Boolean(explicitUsercachePath));
  const result = await syncDiscordSrvLinks(db, links, minecraftPlayers);

  console.log(
    `DiscordSRV sync complete: ${result.linkedPlayers} linked, ${result.changedPlayers} changed, ${result.clearedPlayers} cleared, ${result.discoveredPlayers} player identities discovered from usercache.json, ${result.unknownPlayers} unresolved UUIDs.`,
  );
  if (result.unknownPlayers > 0 && minecraftPlayers.length === 0) {
    console.warn(
      "No Minecraft user cache was loaded. Set MINECRAFT_USERCACHE_PATH to the server's usercache.json so newly joined players can be created before edition statistics are imported.",
    );
  }
}

async function readMinecraftPlayers(path: string, required: boolean): Promise<MinecraftPlayerIdentity[]> {
  try {
    return parseMinecraftUsercache(await readFile(path, "utf8"));
  } catch (error) {
    if (!required && isFileNotFound(error)) {
      console.warn(`Minecraft user cache not found at ${path}; continuing with existing website players only.`);
      return [];
    }
    throw error;
  }
}

function isFileNotFound(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => databaseClient.close());
