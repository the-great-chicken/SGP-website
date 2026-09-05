import "dotenv/config";
import { resolve } from "node:path";
import {
  assembleEditionBundle,
  editionDetailsSchema,
  readKitManifest,
  readStatisticsSnapshot,
} from "./edition-bundle";
import { databaseClient, db } from "./client";
import { replaceEdition } from "./importer";

type ImportOptions = {
  statisticsPath: string;
  kitManifestPath: string;
  editionNumber: number;
  name: string | null;
  status: "draft" | "published" | "archived";
  startsAt: string | null;
  endsAt: string | null;
  publishedAt: string | null;
};

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const [statistics, kitManifest] = await Promise.all([
    readStatisticsSnapshot(resolve(options.statisticsPath)),
    readKitManifest(resolve(options.kitManifestPath)),
  ]);
  const edition = editionDetailsSchema.parse({
    number: options.editionNumber,
    name: options.name,
    status: options.status,
    startsAt: options.startsAt,
    endsAt: options.endsAt,
    publishedAt: options.publishedAt,
  });
  const bundle = assembleEditionBundle(edition, statistics, kitManifest);
  const summary = await replaceEdition(db, bundle);

  console.log(
    `Imported edition ${summary.editionNumber} from datapack release ${statistics.datapackRelease}: ` +
      `${summary.players} players, ${summary.kills} kill rows, ${summary.damage} damage rows, ` +
      `${summary.abilityMetrics} ability metric rows and ${summary.ratings} ratings.`,
  );
}

function parseOptions(args: string[]): ImportOptions {
  let statisticsPath: string | undefined;
  let kitManifestPath: string | undefined;
  let editionNumber: number | undefined;
  let name: string | null = null;
  let status: ImportOptions["status"] = "draft";
  let startsAt: string | null = null;
  let endsAt: string | null = null;
  let publishedAt: string | null = null;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!argument.startsWith("--") && statisticsPath === undefined) {
      statisticsPath = argument;
      continue;
    }

    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${argument} requires a value`);
    }

    if (argument === "--kit-manifest") {
      kitManifestPath = value;
    } else if (argument === "--edition") {
      editionNumber = Number(value);
    } else if (argument === "--name") {
      name = value;
    } else if (argument === "--status") {
      if (value !== "draft" && value !== "published" && value !== "archived") {
        throw new Error(`Unsupported edition status: ${value}`);
      }
      status = value;
    } else if (argument === "--starts-at") {
      startsAt = value;
    } else if (argument === "--ends-at") {
      endsAt = value;
    } else if (argument === "--published-at") {
      publishedAt = value;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
    index += 1;
  }

  if (
    !statisticsPath ||
    !kitManifestPath ||
    editionNumber === undefined ||
    !Number.isInteger(editionNumber)
  ) {
    throw new Error(
      "Usage: npm run db:import-edition -- <statistics-snapshot.json> --kit-manifest <kit-manifest.json> --edition <number> [--name <name>] [--status <draft|published|archived>] [--starts-at <datetime>] [--ends-at <datetime>] [--published-at <datetime>]",
    );
  }

  return {
    statisticsPath,
    kitManifestPath,
    editionNumber,
    name,
    status,
    startsAt,
    endsAt,
    publishedAt,
  };
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => databaseClient.close());
