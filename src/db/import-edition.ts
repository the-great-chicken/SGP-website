import "dotenv/config";
import { resolve } from "node:path";
import { readEditionBundle } from "./edition-bundle";
import { databaseClient, db } from "./client";
import { replaceEdition } from "./importer";

async function main() {
  const bundlePath = process.argv[2];
  if (!bundlePath || process.argv.length !== 3) {
    throw new Error("Usage: npm run db:import-edition -- <edition-bundle.json>");
  }

  const resolvedPath = resolve(bundlePath);
  const bundle = await readEditionBundle(resolvedPath);
  const summary = await replaceEdition(db, bundle);

  console.log(
    `Imported edition ${summary.editionNumber}: ${summary.players} players, ` +
      `${summary.kills} kill rows, ${summary.damage} damage rows, ` +
      `${summary.abilityMetrics} ability metric rows and ${summary.ratings} ratings.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => databaseClient.close());
