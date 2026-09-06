import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { publishingConfigSchema, runPublishing } from "../src/publishing/workflow";

async function main() {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const args = process.argv.slice(2);
  const kind = args.shift();
  const number = kind === "edition" ? Number(args.shift()) : undefined;
  if (kind !== "refresh" && kind !== "edition" || kind === "edition" && (!Number.isSafeInteger(number) || number! < 1)) {
    throw new Error("Usage: npm run content:refresh | npm run edition:publish -- <number> [--config publish.json] [--prepare-only]");
  }
  let configPath = path.join(root, "publish.json");
  let prepareOnly = false;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === "--prepare-only") prepareOnly = true;
    else if (args[index] === "--config" && args[index + 1]) configPath = path.resolve(args[++index]);
    else throw new Error(`Unknown or incomplete option: ${args[index]}`);
  }
  const contents = await readFile(configPath, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") throw new Error(`Missing ${configPath}. Copy publish.example.json there and fill in your sources and edition details.`);
    throw error;
  });
  const config = publishingConfigSchema.parse(JSON.parse(contents));
  await runPublishing({ root, configDirectory: path.dirname(configPath), config, prepareOnly,
    mode: kind === "refresh" ? { kind } : { kind, number: number! } });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
