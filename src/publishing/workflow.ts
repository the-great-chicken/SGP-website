import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, open, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { z } from "zod";
import { assembleEditionBundle, editionDetailsSchema, readKitManifest, readStatisticsSnapshot, type EditionBundle } from "../db/edition-bundle";
import { replaceEdition, validateBundleRelations } from "../db/importer";
import * as schema from "../db/schema";
import { getItemRenderMismatch, getItemRenderSignature, type ItemRenderIndex } from "../lib/item-rendering";

const release = z.string().trim().min(1).refine((value) => !value.startsWith("REPLACE_"), "Fill in the release identifier");
const sourceSchema = z.object({
  world: z.string().min(1), datapack: z.string().min(1), resourcePack: z.string().min(1), minecraftClient: z.string().min(1),
  minecraftVersion: z.string().min(1), datapackRelease: release, resourcePackRelease: release,
  maps: z.array(z.object({
    id: z.string().min(1), dimension: z.string().min(1), playableArea: z.int().positive(),
    spawnGroups: z.array(z.int().positive()).min(1),
  }).strict()).min(1),
}).strict();

export const publishingConfigSchema = z.object({
  databaseUrl: z.string().startsWith("file:").optional(),
  current: sourceSchema.optional(),
  editions: z.record(z.string().regex(/^[1-9][0-9]*$/), z.object({
    name: z.string().min(1), startsAt: z.iso.datetime({ offset: true }), endsAt: z.iso.datetime({ offset: true }),
    publishedAt: z.iso.datetime({ offset: true }), source: sourceSchema,
  }).strict()).default({}),
}).strict();

type Config = z.infer<typeof publishingConfigSchema>;
type Mode = { kind: "refresh" } | { kind: "edition"; number: number };
type Command = (executable: string, args: string[], cwd: string) => Promise<void>;

export async function runCommand(executable: string, args: string[], cwd: string) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd, stdio: "inherit", windowsHide: true,
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1", PYTHONUTF8: "1" },
    });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`Command failed (${code}): ${path.basename(executable)} ${args[0]}`)));
  });
}

async function exists(file: string) {
  try { await stat(file); return true; } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export async function promoteCurrent(root: string, stage: string) {
  // Image filenames include the resource-pack identity. Keep previous images usable by open pages.
  await cp(path.join(stage, "public/generated/item-icons"), path.join(root, "public/generated/item-icons"), { recursive: true, force: false });
  const files = ["data/kit-manifest.json", "data/item-renders.json", "public/bluemap/overlays.json"];
  const previous = new Map<string, Buffer | null>();
  const changed: string[] = [];
  try {
    for (const name of files) {
      const target = path.join(root, name);
      await mkdir(path.dirname(target), { recursive: true });
      previous.set(name, await exists(target) ? await readFile(target) : null);
      await cp(path.join(stage, name), `${target}.publishing`);
      await rename(`${target}.publishing`, target);
      changed.push(name);
    }
  } catch (error) {
    for (const name of changed.reverse()) {
      const target = path.join(root, name);
      const contents = previous.get(name);
      if (contents === null) await unlink(target);
      else {
        await writeFile(`${target}.publishing`, contents!);
        await rename(`${target}.publishing`, target);
      }
    }
    throw error;
  }
}

export async function publishEdition(root: string, stage: string, databaseUrl: string, bundle: EditionBundle) {
  const filename = databaseUrl.slice("file:".length);
  if (!filename || filename === ":memory:") throw new Error("Publishing requires a persistent SQLite database file");
  const databasePath = path.resolve(filename);
  await mkdir(path.dirname(databasePath), { recursive: true });
  const alreadyExists = await exists(databasePath);
  const client = createClient({ url: `file:${databasePath}` });
  try {
    if (alreadyExists) {
      await client.execute({ sql: "VACUUM INTO ?", args: [path.join(stage, "before-publish.sqlite")] });
      console.log(`Database recovery copy: ${path.join(stage, "before-publish.sqlite")}`);
    }
    const database = drizzle(client, { schema });
    await migrate(database, { migrationsFolder: path.join(root, "drizzle") });
    return await replaceEdition(database, bundle);
  } finally {
    client.close();
  }
}

export async function runPublishing(options: {
  root: string; configDirectory: string; config: Config; mode: Mode; prepareOnly?: boolean; command?: Command;
}) {
  const { root, configDirectory, config, mode } = options;
  const command = options.command ?? runCommand;
  const edition = mode.kind === "edition" ? config.editions[String(mode.number)] : undefined;
  const configuredSource = mode.kind === "refresh" ? config.current : edition?.source;
  if (!configuredSource) throw new Error(mode.kind === "refresh" ? "Configure current sources first" : `Configure edition ${mode.number} first`);
  const source = { ...configuredSource };
  for (const key of ["world", "datapack", "resourcePack", "minecraftClient"] as const) {
    source[key] = path.resolve(configDirectory, source[key]);
    if (!await exists(source[key])) throw new Error(`Missing ${key}: ${source[key]}`);
  }
  let databaseUrl: string | undefined;
  if (mode.kind === "edition") {
    if (!config.databaseUrl) throw new Error("Set databaseUrl in publish.json before publishing an edition");
    const filename = config.databaseUrl.slice(5);
    if (!filename || filename === ":memory:") throw new Error("databaseUrl must point to a persistent SQLite file");
    const target = path.resolve(configDirectory, filename);
    for (const sourcePath of [source.world, source.datapack, source.resourcePack]) {
      const relative = path.relative(sourcePath, target);
      if (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) {
        throw new Error("The publication database must be outside the read-only source directories");
      }
    }
    databaseUrl = `file:${target}`;
  }

  const python = (directory: string) => path.join(root, directory, process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
  if (!options.command) {
    for (const directory of mode.kind === "edition" ? [".venv", ".venv-statistics"] : [".venv"]) {
      if (!await exists(python(directory))) throw new Error("Run npm run content:setup once to prepare the exporters");
    }
  }
  const work = path.join(root, ".data/publishing");
  await mkdir(work, { recursive: true });
  const lockPath = path.join(work, "active.lock");
  const lock = await open(lockPath, "wx").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "EEXIST") throw new Error(`Another publishing run holds ${lockPath}`);
    throw error;
  });
  let stage: string | undefined;
  try {
    await lock.writeFile(String(process.pid));
    stage = await mkdtemp(path.join(work, mode.kind === "refresh" ? "current-" : `edition-${mode.number}-`));
    const data = path.join(stage, "data");
    await mkdir(data);
    console.log(`Preparing ${mode.kind === "refresh" ? "current content" : `edition ${mode.number}`} in ${stage}`);
    await command(python(".venv"), ["-m", "sgp_kit_exporter", "--datapack", source.datapack,
      "--minecraft-version", source.minecraftVersion, "--datapack-release", source.datapackRelease,
      "--resource-pack-release", source.resourcePackRelease, "--output", path.join(data, "kit-manifest.json")], root);
    const manifest = await readKitManifest(path.join(data, "kit-manifest.json"));
    await writeFile(path.join(data, "maps.json"), JSON.stringify(source.maps));
    await command(python(".venv"), ["-m", "sgp_map_exporter", "--world", source.world, "--maps", path.join(data, "maps.json"),
      "--output", path.join(stage, "public/bluemap/overlays.json")], root);

    let bundle: EditionBundle | undefined;
    if (edition && mode.kind === "edition") {
      await command(python(".venv-statistics"), [path.join(source.datapack, "stats_analysis/export_web.py"),
        path.join(source.world, "data/sgp.kits/command_storage.dat"), "--datapack-release", source.datapackRelease,
        "--output", path.join(data, "statistics-snapshot.json")], stage);
      const details = editionDetailsSchema.parse({ number: mode.number, name: edition.name, status: "published",
        startsAt: edition.startsAt, endsAt: edition.endsAt, publishedAt: edition.publishedAt });
      bundle = assembleEditionBundle(details, await readStatisticsSnapshot(path.join(data, "statistics-snapshot.json")), manifest);
      validateBundleRelations(bundle);
    }

    // Give the renderer a copy of the current image cache; it only reuses matching release identities.
    for (const name of ["data/item-renders.json", "public/generated/item-icons"]) {
      if (await exists(path.join(root, name))) await cp(path.join(root, name), path.join(stage, name), { recursive: true });
    }
    await command(process.execPath, ["--import", "tsx", path.join(root, "scripts/render-kit-items.mts"),
      "--resource-pack", source.resourcePack, "--minecraft-client", source.minecraftClient], stage);
    const index = JSON.parse(await readFile(path.join(data, "item-renders.json"), "utf8")) as ItemRenderIndex;
    const mismatch = getItemRenderMismatch(index, manifest);
    if (index.schemaVersion !== 2 || mismatch) throw new Error(`Invalid item image index: ${mismatch ?? "schema version"}`);
    for (const kit of manifest.kits) {
      for (const operation of kit.operations) {
        const key = createHash("sha256").update(getItemRenderSignature(operation.item)).digest("hex");
        if (!index.items[key]) throw new Error(`Missing item image for ${kit.key}: ${operation.item.id}`);
      }
    }
    for (const url of Object.values(index.items)) {
      if (!/^\/generated\/item-icons\/[a-zA-Z0-9_.-]+\.png$/.test(url) || !await exists(path.join(stage, "public", url.slice(1)))) {
        throw new Error(`Missing or invalid rendered item: ${url}`);
      }
    }
    const overlays = JSON.parse(await readFile(path.join(stage, "public/bluemap/overlays.json"), "utf8"));
    if (overlays.schemaVersion !== 1 || !source.maps.every((map) => Object.hasOwn(overlays.maps, map.id))) {
      throw new Error("Map overlays do not match the configured maps");
    }
    await writeFile(path.join(stage, "publication.json"), JSON.stringify({ mode, source, edition: edition && { ...edition, source: undefined }, preparedAt: new Date().toISOString() }, null, 2) + "\n");
    if (options.prepareOnly) {
      console.log(`Validated exports ready: ${stage}. Website and database unchanged.`);
      return stage;
    }
    if (mode.kind === "refresh") {
      await promoteCurrent(root, stage);
      console.log("Current kits, item images and map overlays refreshed. Include generated files in the next website deployment.");
    } else {
      const summary = await publishEdition(root, stage, databaseUrl!, bundle!);
      console.log(`Published edition ${summary.editionNumber}: ${summary.players} players. Current kits and map overlays unchanged.`);
    }
    return stage;
  } catch (error) {
    if (stage) console.error(`Run stopped. Prepared files and any database recovery copy are in ${stage}`);
    throw error;
  } finally {
    await lock.close();
    await unlink(lockPath);
  }
}
