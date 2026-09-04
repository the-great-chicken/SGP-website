import "dotenv/config";
import { migrate } from "drizzle-orm/libsql/migrator";
import { databaseClient, db } from "./client";

async function runMigrations() {
  await migrate(db, { migrationsFolder: "drizzle" });
  databaseClient.close();
  console.log("SQLite migrations applied.");
}

runMigrations().catch((error: unknown) => {
  databaseClient.close();
  console.error(error);
  process.exitCode = 1;
});
