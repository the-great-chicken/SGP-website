import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

if (databaseUrl.startsWith("file:")) {
  const databasePath = databaseUrl.slice("file:".length);
  mkdirSync(dirname(resolve(databasePath)), { recursive: true });
}

const globalDatabase = globalThis as typeof globalThis & {
  sgpDatabaseClient?: Client;
};

export const databaseClient =
  globalDatabase.sgpDatabaseClient ?? createClient({ url: databaseUrl });

if (process.env.NODE_ENV !== "production") {
  globalDatabase.sgpDatabaseClient = databaseClient;
}

export const db = drizzle(databaseClient, { schema });
