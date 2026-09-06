import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { prepareAssets, readFile as readAssetFile, renderItem } from "block-model-renderer";
import type { KitItem, KitManifest } from "../src/lib/kit-manifest";
import {
  getItemRenderInput,
  getItemRenderSignature,
  type ItemRenderIndex,
} from "../src/lib/item-rendering";

const projectRoot = process.cwd();
const manifestPath = path.join(projectRoot, "data", "kit-manifest.json");
const outputDirectory = path.join(projectRoot, "public", "generated", "item-icons");
const indexPath = path.join(projectRoot, "data", "item-renders.json");

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as KitManifest;
  if (
    manifest.schemaVersion !== 3 ||
    !manifest.datapackRelease ||
    !manifest.resourcePackRelease
  ) {
    throw new Error("Kit manifest must use schema 3 and identify both datapack and resource-pack releases");
  }
  const resourcePackPath = path.resolve(
    options.resourcePack ??
      process.env.TGC_RESOURCE_PACK_PATH ??
      path.join(projectRoot, "..", "TGC_PACK", "TGC_Pack"),
  );
  const minecraftClientPath = path.resolve(
    options.minecraftClient ??
      process.env.MINECRAFT_CLIENT_JAR_PATH ??
      getDefaultClientPath(manifest.minecraftVersion),
  );

  await assertAssetSource(resourcePackPath, "TGC resource pack");
  await assertFile(minecraftClientPath, "Minecraft client JAR");
  await mkdir(outputDirectory, { recursive: true });

  const uniqueItems = collectUniqueItems(manifest);
  const assets = await prepareAssets([resourcePackPath, minecraftClientPath], {
    cache: true,
    version: manifest.minecraftVersion,
  });
  const resourcePackRelease = await readResourcePackRelease(assets);
  if (resourcePackRelease !== manifest.resourcePackRelease) {
    throw new Error(
      `Resource-pack release ${resourcePackRelease} does not match kit manifest release ${manifest.resourcePackRelease}`,
    );
  }
  const renderedItems: Record<string, string> = {};
  const assetFingerprint = await fingerprintAssets([resourcePackPath, minecraftClientPath]);
  const expectedFiles = new Set<string>();
  let previousIndex: ItemRenderIndex | undefined;
  try {
    previousIndex = JSON.parse(await readFile(indexPath, "utf8")) as ItemRenderIndex;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const reusable = previousIndex?.schemaVersion === 2 &&
    previousIndex.resourcePackRelease === resourcePackRelease &&
    previousIndex.minecraftVersion === manifest.minecraftVersion;
  let renderedCount = 0;

  for (const [index, [key, item]] of uniqueItems.entries()) {
    const assetKey = createHash("sha256").update(`${resourcePackRelease}\0${manifest.minecraftVersion}\0${assetFingerprint}\0${key}`).digest("hex");
    const fileName = `${slugItemId(item.id)}-${assetKey.slice(0, 20)}.png`;
    const outputPath = path.join(outputDirectory, fileName);
    const input = getItemRenderInput(item);

    process.stdout.write(`\rPreparing item ${index + 1}/${uniqueItems.length}`);
    const exists = await stat(outputPath).then((file) => file.isFile() && file.size > 0).catch(() => false);
    if (!(reusable && previousIndex?.items[key] === `/generated/item-icons/${fileName}` && exists)) {
      const rendered = await renderItem({
        id: input.id,
        components: input.components,
        assets,
        version: manifest.minecraftVersion,
        width: 128,
        height: 128,
      });
      await writeFile(outputPath, rendered as unknown as Uint8Array);
      renderedCount += 1;
    }

    expectedFiles.add(fileName);
    renderedItems[key] = `/generated/item-icons/${fileName}`;
  }

  process.stdout.write("\n");
  const renderIndex: ItemRenderIndex = {
    schemaVersion: 2,
    datapackRelease: manifest.datapackRelease,
    resourcePackRelease,
    minecraftVersion: manifest.minecraftVersion,
    items: Object.fromEntries(Object.entries(renderedItems).toSorted(([a], [b]) => a.localeCompare(b))),
  };
  const temporaryIndexPath = `${indexPath}.tmp`;
  await writeFile(temporaryIndexPath, `${JSON.stringify(renderIndex, null, 2)}\n`, "utf8");
  await rename(temporaryIndexPath, indexPath);
  await removeStaleImages(expectedFiles);

  console.log(
    `Prepared ${uniqueItems.length} item variants (${renderedCount} rendered, ${uniqueItems.length - renderedCount} reused) for datapack ${manifest.datapackRelease} with resource pack ${manifest.resourcePackRelease} over Minecraft ${manifest.minecraftVersion}.`,
  );
}

async function fingerprintAssets(sources: string[]) {
  const hash = createHash("sha256");
  async function addFile(file: string, name: string) {
    const contents = createHash("sha256");
    for await (const chunk of createReadStream(file)) contents.update(chunk);
    hash.update(`${name}\0${contents.digest("hex")}\0`);
  }
  async function addDirectory(directory: string, prefix = "") {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    for (const entry of entries) {
      const file = path.join(directory, entry.name);
      const name = `${prefix}${entry.name}`;
      if (entry.isDirectory()) await addDirectory(file, `${name}/`);
      else await addFile(file, name);
    }
  }
  for (const [index, source] of sources.entries()) {
    hash.update(`source-${index}\0`);
    if ((await stat(source)).isDirectory()) await addDirectory(source);
    else await addFile(source, "archive");
  }
  return hash.digest("hex");
}

function collectUniqueItems(manifest: KitManifest): Array<[string, KitItem]> {
  const items = new Map<string, KitItem>();

  for (const kit of manifest.kits) {
    for (const operation of kit.operations) {
      const signature = getItemRenderSignature(operation.item);
      const key = createHash("sha256").update(signature).digest("hex");
      items.set(key, operation.item);
    }
  }

  return [...items.entries()].toSorted(([a], [b]) => a.localeCompare(b));
}

function parseOptions(args: string[]): {
  resourcePack?: string;
  minecraftClient?: string;
} {
  const options: { resourcePack?: string; minecraftClient?: string } = {};

  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    const value = args[index + 1];
    if ((option === "--resource-pack" || option === "--minecraft-client") && !value) {
      throw new Error(`${option} requires a path`);
    }
    if (option === "--resource-pack") {
      options.resourcePack = value;
      index += 1;
    } else if (option === "--minecraft-client") {
      options.minecraftClient = value;
      index += 1;
    } else {
      throw new Error(`Unknown option: ${option}`);
    }
  }

  return options;
}

function getDefaultClientPath(minecraftVersion: string): string {
  const appData = process.env.APPDATA;
  if (!appData) {
    throw new Error(
      "MINECRAFT_CLIENT_JAR_PATH or --minecraft-client is required outside a standard Windows Minecraft installation",
    );
  }
  return path.join(appData, ".minecraft", "versions", minecraftVersion, `${minecraftVersion}.jar`);
}

async function assertAssetSource(target: string, label: string) {
  const targetStat = await stat(target).catch(() => null);
  if (!targetStat || (!targetStat.isDirectory() && !targetStat.isFile())) {
    throw new Error(`${label} not found at ${target}`);
  }
}

async function assertFile(target: string, label: string) {
  const targetStat = await stat(target).catch(() => null);
  if (!targetStat?.isFile()) {
    throw new Error(`${label} not found at ${target}`);
  }
}

async function readResourcePackRelease(assets: Awaited<ReturnType<typeof prepareAssets>>) {
  const metadata = await readAssetFile("release.json", assets);
  if (!metadata) {
    throw new Error("TGC resource pack has no embedded release.json identity");
  }

  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(metadata));
  } catch {
    throw new Error("TGC resource pack has invalid release.json metadata");
  }
  if (
    typeof value !== "object" ||
    value === null ||
    !("schemaVersion" in value) ||
    value.schemaVersion !== 1 ||
    !("release" in value) ||
    typeof value.release !== "string" ||
    !value.release
  ) {
    throw new Error("TGC resource pack has invalid release.json metadata");
  }
  return value.release;
}

async function removeStaleImages(expectedFiles: Set<string>) {
  const existingFiles = await readdir(outputDirectory);
  await Promise.all(
    existingFiles
      .filter((fileName) => fileName.endsWith(".png") && !expectedFiles.has(fileName))
      .map((fileName) => unlink(path.join(outputDirectory, fileName))),
  );
}

function slugItemId(itemId: string): string {
  return itemId.replace(/^minecraft:/, "").replace(/[^a-z0-9._-]+/gi, "-");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
