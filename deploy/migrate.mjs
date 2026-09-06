import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";

const url = process.env.DATABASE_URL;
if (!url?.startsWith("file:/")) throw new Error("An absolute SQLite DATABASE_URL is required.");
const client = createClient({ url });
try {
  const migrations = readMigrationFiles({ migrationsFolder: "drizzle" });
  const table = await client.execute("SELECT name FROM sqlite_master WHERE name = '__drizzle_migrations'");
  if (table.rows.length) {
    const applied = await client.execute("SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at");
    for (const row of applied.rows) {
      if (!migrations.some((migration) => migration.hash === row.hash && migration.folderMillis === Number(row.created_at))) {
        throw new Error("Database migrations differ from this release. Restore a matching backup before rolling back.");
      }
    }
  }
  if (!process.argv.includes("--check")) {
    await migrate(drizzle(client), { migrationsFolder: "drizzle" });
    console.log("SQLite migrations applied.");
  }
} finally {
  client.close();
}
