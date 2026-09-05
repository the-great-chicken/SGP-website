import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { prepareAssets, renderItem } from "block-model-renderer";
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

  await assertDirectory(resourcePackPath, "TGC resource pack");
  await assertFile(minecraftClientPath, "Minecraft client JAR");
  await mkdir(outputDirectory, { recursive: true });

  const uniqueItems = collectUniqueItems(manifest);
  const assets = await prepareAssets([resourcePackPath, minecraftClientPath], {
    cache: true,
    version: manifest.minecraftVersion,
  });
  const renderedItems: Record<string, string> = {};
  const expectedFiles = new Set<string>();

  for (const [index, [key, item]] of uniqueItems.entries()) {
    const fileName = `${slugItemId(item.id)}-${key.slice(0, 16)}.png`;
    const outputPath = path.join(outputDirectory, fileName);
    const input = getItemRenderInput(item);

    process.stdout.write(`\rRendering item ${index + 1}/${uniqueItems.length}`);
    const rendered = await renderItem({
      id: input.id,
      components: input.components,
      assets,
      version: manifest.minecraftVersion,
      width: 128,
      height: 128,
    });
    await writeFile(outputPath, rendered as unknown as Uint8Array);

    expectedFiles.add(fileName);
    renderedItems[key] = `/generated/item-icons/${fileName}`;
  }

  process.stdout.write("\n");
  const resourcePackVersion = await readResourcePackVersion(resourcePackPath);
  const renderIndex: ItemRenderIndex = {
    schemaVersion: 1,
    minecraftVersion: manifest.minecraftVersion,
    resourcePackVersion,
    items: Object.fromEntries(Object.entries(renderedItems).toSorted(([a], [b]) => a.localeCompare(b))),
  };
  const temporaryIndexPath = `${indexPath}.tmp`;
  await writeFile(temporaryIndexPath, `${JSON.stringify(renderIndex, null, 2)}\n`, "utf8");
  await rename(temporaryIndexPath, indexPath);
  await removeStaleImages(expectedFiles);

  console.log(
    `Rendered ${uniqueItems.length} item variants with TGC pack${resourcePackVersion ? ` v${resourcePackVersion}` : ""} over Minecraft ${manifest.minecraftVersion}.`,
  );
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

async function assertDirectory(target: string, label: string) {
  const targetStat = await stat(target).catch(() => null);
  if (!targetStat?.isDirectory()) {
    throw new Error(`${label} not found at ${target}`);
  }
}

async function assertFile(target: string, label: string) {
  const targetStat = await stat(target).catch(() => null);
  if (!targetStat?.isFile()) {
    throw new Error(`${label} not found at ${target}`);
  }
}

async function readResourcePackVersion(resourcePackPath: string): Promise<string | null> {
  for (const candidate of [
    path.join(resourcePackPath, "version.txt"),
    path.join(resourcePackPath, "..", "version.txt"),
  ]) {
    try {
      return (await readFile(candidate, "utf8")).trim() || null;
    } catch (error) {
      if (!(error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT")) {
        throw error;
      }
    }
  }
  return null;
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
