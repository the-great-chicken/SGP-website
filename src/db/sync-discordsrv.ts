import "dotenv/config";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { databaseClient, db } from "./client";
import { parseDiscordSrvAccountsAof, syncDiscordSrvLinks } from "./discordsrv";

async function main() {
  const sourcePath = process.argv[2] ?? process.env.DISCORDSRV_ACCOUNTS_PATH;
  if (!sourcePath) {
    throw new Error("Pass the DiscordSRV accounts.aof path or set DISCORDSRV_ACCOUNTS_PATH.");
  }

  const links = parseDiscordSrvAccountsAof(await readFile(resolve(sourcePath), "utf8"));
  const result = await syncDiscordSrvLinks(db, links);
  console.log(
    `DiscordSRV sync complete: ${result.linkedPlayers} linked, ${result.changedPlayers} changed, ${result.clearedPlayers} cleared, ${result.unknownPlayers} ignored because their UUID is not in the website database.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => databaseClient.close());
