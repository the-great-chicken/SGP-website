import { resolve } from "node:path";
import type { TestContext } from "node:test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "../../src/db/schema";

export async function createTestDatabase(
  t: Pick<TestContext, "after">,
  options: { url?: string } = {},
) {
  const client = createClient({ url: options.url ?? "file::memory:" });
  const database = drizzle(client, { schema });
  let closed = false;

  const close = () => {
    if (closed) return;
    closed = true;
    client.close();
  };

  t.after(close);

  try {
    await migrate(database, { migrationsFolder: resolve("drizzle") });
  } catch (error) {
    close();
    throw error;
  }

  return { client, database, close };
}
