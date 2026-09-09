import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "../src/db/schema";

const repositoryRoot = process.cwd();
const legacyMigrationIndex = 4;
const playerUuid = "11111111-1111-4111-8111-111111111111";

async function createLegacyMigrationFolder(root: string) {
  const source = path.join(repositoryRoot, "drizzle");
  const destination = path.join(root, "legacy-drizzle");
  await cp(source, destination, { recursive: true });

  const journalPath = path.join(destination, "meta/_journal.json");
  const journal = JSON.parse(await readFile(journalPath, "utf8")) as {
    entries: Array<{ idx: number }>;
  };
  journal.entries = journal.entries.filter((entry) => entry.idx <= legacyMigrationIndex);
  await writeFile(journalPath, `${JSON.stringify(journal, null, 2)}\n`, "utf8");
  return destination;
}

test("a populated v0004 database upgrades to the current schema without losing legacy data", async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "sgp-migration-upgrade-"));
  const databasePath = path.join(workspace, "legacy.sqlite");
  const client = createClient({ url: `file:${databasePath}` });

  try {
    const database = drizzle(client, { schema });
    const legacyMigrations = await createLegacyMigrationFolder(workspace);
    await migrate(database, { migrationsFolder: legacyMigrations });
    await client.executeMultiple(
      await readFile(path.join(repositoryRoot, "tests/fixtures/database/legacy-v0004.seed.sql"), "utf8"),
    );

    // This is the production upgrade path: an existing, populated database with
    // Drizzle migration history is migrated in place using the current folder.
    await migrate(database, { migrationsFolder: path.join(repositoryRoot, "drizzle") });

    const cosmetic = (await client.execute({
      sql: "SELECT id, active, color FROM cosmetics WHERE id = ?",
      args: ["particle.legacy"],
    })).rows[0];
    assert.equal(cosmetic.id, "particle.legacy");
    assert.equal(Number(cosmetic.active), 0);
    assert.equal(cosmetic.color, "#ffffff");

    const player = (await client.execute({
      sql: "SELECT current_minecraft_name, discord_id FROM players WHERE uuid = ?",
      args: [playerUuid],
    })).rows[0];
    assert.equal(player.current_minecraft_name, "LegacyPlayer");
    assert.equal(player.discord_id, "111111111111111111");

    const edition = (await client.execute("SELECT number, datapack_version FROM editions WHERE number = 4")).rows[0];
    assert.equal(Number(edition.number), 4);
    assert.equal(edition.datapack_version, "dp-legacy");

    const equipment = (await client.execute({
      sql: "SELECT cosmetic_id FROM player_equipment WHERE player_uuid = ? AND category = 'particle'",
      args: [playerUuid],
    })).rows[0];
    assert.equal(equipment.cosmetic_id, "particle.legacy");

    const session = (await client.execute("SELECT discord_username FROM auth_sessions WHERE token_hash = 'legacy-token-hash'")).rows[0];
    assert.equal(session.discord_username, "legacy-user");

    // Exercise the table introduced by 0005, not just its existence.
    await client.execute({
      sql: "INSERT INTO player_cosmetic_sync (player_uuid, observed_at, issues) VALUES (?, ?, ?)",
      args: [playerUuid, 1788800000000, "[]"],
    });
    const sync = (await client.execute({
      sql: "SELECT observed_at, issues FROM player_cosmetic_sync WHERE player_uuid = ?",
      args: [playerUuid],
    })).rows[0];
    assert.equal(Number(sync.observed_at), 1788800000000);
    assert.equal(sync.issues, "[]");

    const columns = (await client.execute("PRAGMA table_info(cosmetics)")).rows.map((row) => String(row.name));
    assert.ok(columns.includes("active"));
    assert.ok(columns.includes("color"));
  } finally {
    client.close();
    await rm(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
