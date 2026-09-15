import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadMapArchiveConfig, renderMapArchive } from "../src/map-archive/archive";

async function main() {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const args = process.argv.slice(2);
  const editionNumber = Number(args.shift());
  if (!Number.isSafeInteger(editionNumber) || editionNumber < 1) {
    throw new Error("Usage: npm run map:archive -- <edition> [--config map-archive.json] [--world /path/to/world] [--resource-pack /path/to/pack|none]");
  }
  let configPath = path.join(root, "map-archive.json");
  let worldOverride: string | undefined;
  let resourcePackOverride: string | null | undefined;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--config" && args[index + 1]) configPath = path.resolve(args[++index]);
    else if (arg === "--world" && args[index + 1]) worldOverride = path.resolve(args[++index]);
    else if (arg === "--resource-pack" && args[index + 1]) {
      const value = args[++index];
      resourcePackOverride = value === "none" ? null : path.resolve(value);
    } else throw new Error(`Unknown or incomplete option: ${arg}`);
  }
  const config = await loadMapArchiveConfig(configPath);
  await renderMapArchive({ root, configDirectory: path.dirname(configPath), config, editionNumber, worldOverride, resourcePackOverride });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
