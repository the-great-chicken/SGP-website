import { mkdir, open, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BLUE_MAP_DOWNLOAD_URL, BLUE_MAP_VERSION, loadMapArchiveConfig, resolveMapArchivePaths } from "../src/map-archive/archive";

async function exists(file: string) {
  try { await stat(file); return true; } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function main() {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const args = process.argv.slice(2);
  let configPath = path.join(root, "map-archive.json");
  if (args.length) {
    if (args.length !== 2 || args[0] !== "--config") throw new Error("Usage: npm run map:setup -- [--config map-archive.json]");
    configPath = path.resolve(args[1]);
  }
  const config = await loadMapArchiveConfig(configPath);
  const paths = resolveMapArchivePaths(path.dirname(configPath), config);
  if (await exists(paths.blueMapJar)) {
    console.log(`BlueMap ${BLUE_MAP_VERSION} already exists: ${paths.blueMapJar}`);
    return;
  }
  await mkdir(path.dirname(paths.blueMapJar), { recursive: true });
  const response = await fetch(BLUE_MAP_DOWNLOAD_URL, { redirect: "follow" });
  if (!response.ok || !response.body) throw new Error(`BlueMap download failed: HTTP ${response.status}`);
  const temporary = `${paths.blueMapJar}.download-${process.pid}`;
  try {
    const output = await open(temporary, "wx");
    try {
      const reader = response.body.getReader();
      let header = Buffer.alloc(0);
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value?.length) continue;
        if (header.length < 2) header = Buffer.concat([header, Buffer.from(value.subarray(0, 2 - header.length))]);
        await output.write(value);
      }
      if (header.length < 2 || header[0] !== 0x50 || header[1] !== 0x4b) {
        throw new Error("Downloaded BlueMap asset is not a JAR/ZIP file");
      }
    } finally {
      await output.close();
    }
    await rename(temporary, paths.blueMapJar);
    await writeFile(`${paths.blueMapJar}.version`, `${BLUE_MAP_VERSION}\n${BLUE_MAP_DOWNLOAD_URL}\n`);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
  console.log(`Installed BlueMap ${BLUE_MAP_VERSION}: ${paths.blueMapJar}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
