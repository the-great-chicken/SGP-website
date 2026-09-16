import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import {
  chmod,
  cp,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { SGP_HIRES_VIEW_DISTANCE } from "../lib/map-viewer-settings";

export const BLUE_MAP_VERSION = "5.24";
export const BLUE_MAP_DOWNLOAD_URL = `https://github.com/BlueMap-Minecraft/BlueMap/releases/download/v${BLUE_MAP_VERSION}/bluemap-${BLUE_MAP_VERSION}-cli.jar`;

const centerSchema = z.object({
  x: z.int(),
  y: z.int(),
  z: z.int(),
}).strict();

const editionSchema = z.object({
  snapshotKey: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  world: z.string().min(1).optional(),
  resourcePack: z.string().min(1).nullable().optional(),
  minecraftVersion: z.string().min(1),
  dimension: z.string().min(1).default("minecraft:overworld"),
  center: centerSchema,
  renderRadius: z.int().positive().max(100_000).default(768),
  minY: z.int().optional(),
}).strict();

export const mapArchiveConfigSchema = z.object({
  archiveDirectory: z.string().min(1).default("../map-archive"),
  java: z.string().min(1).default("java"),
  blueMapJar: z.string().min(1).optional(),
  retainRevisions: z.int().min(1).max(10).default(2),
  renderThreads: z.int().min(1).max(128).optional(),
  editions: z.record(z.string().regex(/^[1-9][0-9]*$/), editionSchema).default({}),
}).strict();

export type MapArchiveConfig = z.infer<typeof mapArchiveConfigSchema>;
export type MapArchiveEditionConfig = z.infer<typeof editionSchema>;
export type MapCenter = z.infer<typeof centerSchema>;

export type MapArchiveManifestEntry = {
  editionNumber: number;
  snapshotKey: string;
  revision: string;
  webPath: string;
  center: MapCenter;
  renderRadius: number;
  minY: number | null;
  dimension: string;
  minecraftVersion: string;
  blueMapVersion: string;
  renderedAt: string;
  sourceFingerprint: string;
  resourcePackFingerprint: string | null;
};

export type MapArchiveManifest = {
  schemaVersion: 1;
  editions: Record<string, MapArchiveManifestEntry>;
};

export type RenderMapArchiveOptions = {
  root: string;
  configDirectory: string;
  config: MapArchiveConfig;
  editionNumber: number;
  worldOverride?: string;
  resourcePackOverride?: string | null;
  command?: (executable: string, args: string[], cwd: string) => Promise<void>;
  now?: () => Date;
};

export type PreparedMapArchive = {
  entry: MapArchiveManifestEntry;
  previousRevision: string | null;
  promote: () => Promise<MapArchiveManifestEntry>;
  cleanup: () => Promise<void>;
};

async function exists(target: string) {
  try {
    await stat(target);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export async function runArchiveCommand(executable: string, args: string[], cwd: string) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(executable, args, { cwd, stdio: "inherit", windowsHide: true });
    child.on("error", reject);
    child.on("close", (code) => code === 0
      ? resolve()
      : reject(new Error(`Command failed (${code}): ${path.basename(executable)} ${args.join(" ")}`)));
  });
}

function quoteHocon(value: string) {
  return JSON.stringify(value);
}

function safeRevision(now: Date) {
  return `${now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}-${randomBytes(3).toString("hex")}`;
}

function archivePaths(configDirectory: string, config: MapArchiveConfig) {
  const root = path.resolve(configDirectory, config.archiveDirectory);
  const publicRoot = path.join(root, "public");
  const privateRoot = path.join(root, "private");
  const blueMapJar = path.resolve(
    configDirectory,
    config.blueMapJar ?? path.join(privateRoot, "bluemap", `bluemap-${BLUE_MAP_VERSION}-cli.jar`),
  );
  return { root, publicRoot, privateRoot, blueMapJar };
}

export function resolveMapArchivePaths(configDirectory: string, config: MapArchiveConfig) {
  return archivePaths(configDirectory, config);
}

async function fingerprintTree(root: string) {
  const hash = createHash("sha256");
  async function walk(directory: string, relative = "") {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const rel = path.posix.join(relative.split(path.sep).join(path.posix.sep), entry.name);
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        hash.update(`d\0${rel}\0`);
        await walk(full, path.join(relative, entry.name));
      } else if (entry.isFile()) {
        const info = await stat(full);
        hash.update(`f\0${rel}\0${info.size}\0${info.mtimeMs}\0`);
      } else if (entry.isSymbolicLink()) {
        throw new Error(`Archive sources must not contain symlinks: ${full}`);
      }
    }
  }
  await walk(root);
  return hash.digest("hex");
}

async function fingerprintFile(file: string) {
  const contents = await readFile(file);
  return createHash("sha256").update(contents).digest("hex");
}

async function sourceFingerprint(source: string) {
  const info = await stat(source);
  if (info.isDirectory()) return fingerprintTree(source);
  if (info.isFile()) return fingerprintFile(source);
  throw new Error(`Unsupported archive source: ${source}`);
}

function blueMapConfigs(options: {
  world: string;
  webroot: string;
  data: string;
  resourcePack: string | null;
  edition: MapArchiveEditionConfig;
  renderThreads?: number;
}) {
  const { world, webroot, data, resourcePack, edition, renderThreads } = options;
  const minX = Math.floor(edition.center.x - edition.renderRadius);
  const maxX = Math.ceil(edition.center.x + edition.renderRadius);
  const minZ = Math.floor(edition.center.z - edition.renderRadius);
  const maxZ = Math.ceil(edition.center.z + edition.renderRadius);
  // BlueMap's map start-pos is X/Z-only; start-location carries the full SGP
  // reset target, including the freely movable orbit target's initial Y.
  const startPos = `{ x: ${edition.center.x}, z: ${edition.center.z} }`;
  const startLocation = `world:${edition.center.x}:${edition.center.y}:${edition.center.z}:1500:0:0:0:0:perspective`;

  return {
    "core.conf": [
      "accept-download: true",
      `data: ${quoteHocon(data)}`,
      ...(renderThreads ? [`render-thread-count: ${renderThreads}`] : []),
      "metrics: false",
      "scan-for-mod-resources: true",
      "",
    ].join("\n"),
    "webserver.conf": [
      "enabled: false",
      `webroot: ${quoteHocon(webroot)}`,
      "sse-enabled: false",
      "",
    ].join("\n"),
    "webapp.conf": [
      "enabled: true",
      `webroot: ${quoteHocon(webroot)}`,
      "update-settings-file: true",
      "use-cookies: false",
      "default-to-flat-view: false",
      `hires-slider-default: ${SGP_HIRES_VIEW_DISTANCE}`,
      `start-location: ${quoteHocon(startLocation)}`,
      "client-decompression: true",
      "map-data-root: \"maps\"",
      "live-data-root: \"maps\"",
      "styles: [\"./bluemap-archive.css\"]",
      "scripts: [\"./bluemap-archive.js\"]",
      "",
    ].join("\n"),
    "storages/file.conf": [
      "storage-type: file",
      `root: ${quoteHocon(path.join(webroot, "maps"))}`,
      "compression: gzip",
      "atomic: true",
      "",
    ].join("\n"),
    "maps/world.conf": [
      `world: ${quoteHocon(world)}`,
      `dimension: ${quoteHocon(edition.dimension)}`,
      `name: ${quoteHocon(`Édition ${edition.snapshotKey.replace(/^edition-/, "")}`)}`,
      `start-pos: ${startPos}`,
      "storage: \"file\"",
      "enable-perspective-view: true",
      "enable-flat-view: false",
      "enable-free-flight-view: false",
      "enable-hires: true",
      "render-edges: true",
      "marker-sets: {}",
      "render-mask: [",
      "  {",
      "    type: box",
      "    subtract: false",
      `    min-x: ${minX}`,
      `    max-x: ${maxX}`,
      `    min-z: ${minZ}`,
      `    max-z: ${maxZ}`,
      ...(edition.minY === undefined ? [] : [`    min-y: ${edition.minY}`]),
      "  }",
      "]",
      "",
    ].join("\n"),
    resourcePack,
  };
}

export function createBlueMapConfigText(options: Parameters<typeof blueMapConfigs>[0]) {
  return blueMapConfigs(options);
}

async function writeBlueMapConfig(configRoot: string, configs: ReturnType<typeof blueMapConfigs>) {
  await mkdir(path.join(configRoot, "maps"), { recursive: true });
  await mkdir(path.join(configRoot, "storages"), { recursive: true });
  for (const [name, contents] of Object.entries(configs)) {
    if (name === "resourcePack" || contents === null) continue;
    await writeFile(path.join(configRoot, name), contents);
  }
  if (configs.resourcePack) {
    await mkdir(path.join(configRoot, "packs"), { recursive: true });
    const info = await stat(configs.resourcePack);
    const extension = info.isFile() ? (path.extname(configs.resourcePack) || ".zip") : "";
    await cp(configs.resourcePack, path.join(configRoot, "packs", `99-sgp-resource-pack${extension}`), { recursive: true });
  }
}

export async function readMapArchiveManifest(publicRoot: string): Promise<MapArchiveManifest> {
  const file = path.join(publicRoot, "manifest.json");
  if (!await exists(file)) return { schemaVersion: 1, editions: {} };
  const parsed = JSON.parse(await readFile(file, "utf8"));
  if (parsed?.schemaVersion !== 1 || typeof parsed.editions !== "object" || parsed.editions === null || Array.isArray(parsed.editions)) {
    throw new Error(`Invalid map archive manifest: ${file}`);
  }
  for (const [snapshotKey, raw] of Object.entries(parsed.editions as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object") throw new Error(`Invalid map archive entry: ${snapshotKey}`);
    const entry = raw as MapArchiveManifestEntry;
    const center = entry.center;
    if (entry.snapshotKey !== snapshotKey || typeof entry.webPath !== "string" || typeof entry.revision !== "string"
      || !center || !Number.isFinite(center.x) || !Number.isFinite(center.y) || !Number.isFinite(center.z)
      || (entry.minY !== undefined && entry.minY !== null && !Number.isFinite(entry.minY))) {
      throw new Error(`Invalid map archive entry: ${snapshotKey}`);
    }
    validateWebPath(entry);
  }
  return parsed as MapArchiveManifest;
}

export function validateWebPath(entry: MapArchiveManifestEntry) {
  if (entry.webPath.includes("\\")) throw new Error(`Unsafe archived map path: ${entry.webPath}`);
  const normalized = path.posix.normalize(entry.webPath);
  if (normalized !== entry.webPath || normalized.startsWith("../") || normalized.startsWith("/") || normalized === "..") {
    throw new Error(`Unsafe archived map path: ${entry.webPath}`);
  }
  const expected = `editions/${entry.snapshotKey}/${entry.revision}`;
  if (normalized !== expected) throw new Error(`Archive path does not match ${entry.snapshotKey}/${entry.revision}`);
  return normalized;
}

async function clearStaleArchiveLock(lockPath: string) {
  const owner = await readFile(lockPath, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (owner === null) return true;
  const match = owner.trim().match(/(?:^|:)([1-9][0-9]*)$/);
  if (!match) return false;
  const pid = Number(match[1]);
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") return false;
    await rm(lockPath, { force: true });
    return true;
  }
}

async function acquireArchiveLock(privateRoot: string, timeoutMs = 60_000) {
  await mkdir(privateRoot, { recursive: true });
  const lockPath = path.join(privateRoot, "archive.lock");
  const deadline = Date.now() + timeoutMs;
  while (true) {
    try {
      const handle = await open(lockPath, "wx");
      await handle.writeFile(`node:${process.pid}\n`);
      return { handle, lockPath };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      if (await clearStaleArchiveLock(lockPath)) continue;
      if (Date.now() >= deadline) throw new Error(`Timed out waiting for map archive lock: ${lockPath}`);
      await delay(100);
    }
  }
}

async function withArchiveLock<T>(privateRoot: string, callback: () => Promise<T>) {
  const lock = await acquireArchiveLock(privateRoot);
  try {
    return await callback();
  } finally {
    await lock.handle.close();
    await rm(lock.lockPath, { force: true });
  }
}

async function pruneRevisions(
  publicRoot: string,
  snapshotKey: string,
  keep: number,
  activeRevision: string,
  previousRevision: string | null,
) {
  const directory = path.join(publicRoot, "editions", snapshotKey);
  const entries = await readdir(directory, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  const revisions = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort().reverse();
  // Prefer the revision that was actually active before this promotion. A hard
  // crash can leave an unreferenced directory newer than that predecessor; such
  // an orphan must not consume the rollback slot.
  const retained = new Set<string>([activeRevision]);
  if (keep > 1 && previousRevision && revisions.includes(previousRevision)) retained.add(previousRevision);
  for (const revision of revisions) {
    if (retained.size >= keep) break;
    retained.add(revision);
  }
  await Promise.all(revisions.filter((revision) => !retained.has(revision)).map((revision) => rm(path.join(directory, revision), { recursive: true, force: true })));
}

export async function promoteMapRevision(options: {
  publicRoot: string;
  privateRoot: string;
  stagingWebroot: string;
  entry: MapArchiveManifestEntry;
  retainRevisions: number;
  expectedPreviousRevision?: string | null;
}) {
  const { publicRoot, privateRoot, stagingWebroot, entry, retainRevisions } = options;
  return withArchiveLock(privateRoot, async () => {
    const manifest = await readMapArchiveManifest(publicRoot);
    const current = manifest.editions[entry.snapshotKey];
    if (options.expectedPreviousRevision !== undefined && (current?.revision ?? null) !== options.expectedPreviousRevision) {
      throw new Error(`Archived map ${entry.snapshotKey} changed while this render was being prepared`);
    }
    const relative = validateWebPath(entry);
    const target = path.join(publicRoot, ...relative.split("/"));
    if (await exists(target)) throw new Error(`Archive revision already exists: ${target}`);

    // Public archive files are served directly by Caddy, so the archive root and
    // every revision ancestor must stay traversable even with a restrictive umask.
    const editionsRoot = path.join(publicRoot, "editions");
    const editionRoot = path.join(editionsRoot, entry.snapshotKey);
    await mkdir(editionRoot, { recursive: true, mode: 0o755 });
    for (const directory of [publicRoot, editionsRoot, editionRoot]) await chmod(directory, 0o755);

    await rename(stagingWebroot, target);
    const next: MapArchiveManifest = {
      schemaVersion: 1,
      editions: { ...manifest.editions, [entry.snapshotKey]: entry },
    };
    const tempManifest = path.join(publicRoot, `.manifest-${process.pid}-${randomBytes(3).toString("hex")}.json`);
    try {
      await writeFile(tempManifest, JSON.stringify(next, null, 2) + "\n");
      await chmod(tempManifest, 0o644);
      await rename(tempManifest, path.join(publicRoot, "manifest.json"));
    } catch (error) {
      await rm(tempManifest, { force: true });
      await rm(target, { recursive: true, force: true });
      throw error;
    }
    // The manifest rename is the commit point. Cleanup must never make a successful
    // promotion look failed, or a caller could delete the newly active revision.
    await pruneRevisions(publicRoot, entry.snapshotKey, retainRevisions, entry.revision, current?.revision ?? null).catch((error) => {
      console.warn(`Archived map promoted, but old revision cleanup failed: ${error instanceof Error ? error.message : error}`);
    });
    return entry;
  });
}


async function treeContainsFile(directory: string): Promise<boolean> {
  const entries = await readdir(directory, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isFile()) return true;
    if (entry.isDirectory() && await treeContainsFile(target)) return true;
    if (entry.isSymbolicLink()) throw new Error(`BlueMap output must not contain symlinks: ${target}`);
  }
  return false;
}

async function makePublicTreeReadable(directory: string) {
  await chmod(directory, 0o755);
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) await makePublicTreeReadable(target);
    else if (entry.isFile()) await chmod(target, 0o644);
    else if (entry.isSymbolicLink()) throw new Error(`BlueMap output must not contain symlinks: ${target}`);
  }
}

export async function prepareMapArchive(options: RenderMapArchiveOptions): Promise<PreparedMapArchive> {
  const edition = options.config.editions[String(options.editionNumber)];
  if (!edition) throw new Error(`Configure map archive edition ${options.editionNumber} first`);
  for (const [number, candidate] of Object.entries(options.config.editions)) {
    if (number !== String(options.editionNumber) && candidate.snapshotKey === edition.snapshotKey) {
      throw new Error(`Map archive snapshotKey ${edition.snapshotKey} is also used by edition ${number}`);
    }
  }
  const paths = archivePaths(options.configDirectory, options.config);
  const worldConfigured = options.worldOverride ?? edition.world;
  if (!worldConfigured) throw new Error(`Edition ${options.editionNumber} has no world path; pass a world override or configure one`);
  const world = path.resolve(options.configDirectory, worldConfigured);
  const resourcePackConfigured = options.resourcePackOverride !== undefined ? options.resourcePackOverride : edition.resourcePack;
  const resourcePack = resourcePackConfigured ? path.resolve(options.configDirectory, resourcePackConfigured) : null;
  if (!await exists(world)) throw new Error(`Missing archive world: ${world}`);
  if (!await exists(path.join(world, "level.dat"))) throw new Error(`Not a Minecraft world (level.dat missing): ${world}`);
  if (resourcePack && !await exists(resourcePack)) throw new Error(`Missing archive resource pack: ${resourcePack}`);
  if (!await exists(paths.blueMapJar)) {
    throw new Error(`Missing BlueMap ${BLUE_MAP_VERSION} CLI at ${paths.blueMapJar}. Run npm run map:setup first.`);
  }

  await mkdir(path.join(paths.privateRoot, "staging"), { recursive: true });
  const stage = await mkdtemp(path.join(paths.privateRoot, "staging", `edition-${options.editionNumber}-`));
  const configRoot = path.join(stage, "config");
  const webroot = path.join(stage, "web");
  const data = path.join(stage, "data");
  const command = options.command ?? runArchiveCommand;
  const now = options.now ?? (() => new Date());
  const renderedAt = now();
  const revision = safeRevision(renderedAt);
  const previousManifest = await readMapArchiveManifest(paths.publicRoot);
  const previousRevision = previousManifest.editions[edition.snapshotKey]?.revision ?? null;
  const beforeWorld = await sourceFingerprint(world);
  const beforePack = resourcePack ? await sourceFingerprint(resourcePack) : null;
  let cleaned = false;
  let promoted = false;

  try {
    await mkdir(webroot, { recursive: true });
    await mkdir(data, { recursive: true });
    await writeBlueMapConfig(configRoot, blueMapConfigs({
      world,
      webroot,
      data,
      resourcePack,
      edition,
      renderThreads: options.config.renderThreads,
    }));
    await command(options.config.java, ["-jar", paths.blueMapJar, "-c", configRoot, "-r"], stage);

    for (const required of ["index.html", "settings.json", "maps/world/settings.json"]) {
      if (!await exists(path.join(webroot, required))) throw new Error(`BlueMap render is incomplete; missing ${required}`);
    }
    const tilesRoot = path.join(webroot, "maps/world/tiles");
    if (!await treeContainsFile(tilesRoot)) {
      throw new Error("BlueMap render is incomplete; no map tiles were produced (check the world path, dimension, center and renderRadius)");
    }
    const [afterWorld, afterPack] = await Promise.all([
      sourceFingerprint(world),
      resourcePack ? sourceFingerprint(resourcePack) : Promise.resolve(null),
    ]);
    if (afterWorld !== beforeWorld) throw new Error("The source world changed while BlueMap was rendering; refusing to archive an inconsistent snapshot");
    if (afterPack !== beforePack) throw new Error("The resource pack changed while BlueMap was rendering; refusing to archive an inconsistent snapshot");

    const entry: MapArchiveManifestEntry = {
      editionNumber: options.editionNumber,
      snapshotKey: edition.snapshotKey,
      revision,
      webPath: `editions/${edition.snapshotKey}/${revision}`,
      center: edition.center,
      renderRadius: edition.renderRadius,
      minY: edition.minY ?? null,
      dimension: edition.dimension,
      minecraftVersion: edition.minecraftVersion,
      blueMapVersion: BLUE_MAP_VERSION,
      renderedAt: renderedAt.toISOString(),
      sourceFingerprint: afterWorld,
      resourcePackFingerprint: afterPack,
    };
    // BlueMap initializes live managers before loading our custom script. Give those
    // first requests valid empty data, then the script disposes all live machinery.
    const liveRoot = path.join(webroot, "maps", "world", "live");
    await mkdir(liveRoot, { recursive: true });
    await writeFile(path.join(liveRoot, "players.json"), '{"players":[]}\n');
    await writeFile(path.join(liveRoot, "markers.json"), '{}\n');

    // Keep the minimal archive bridge inside each immutable revision. That way a
    // future BlueMap upgrade cannot change the behaviour of already-published maps.
    for (const name of ["bluemap-archive.css", "bluemap-archive.js"] as const) {
      await cp(path.join(options.root, "public/map-archive", name), path.join(webroot, name));
    }
    await cp(path.join(options.root, "public/bluemap/sgp-controls.mjs"), path.join(webroot, "sgp-controls.mjs"));

    // Public provenance intentionally excludes absolute source paths. Fingerprints
    // identify the source tree without publishing server filesystem layout.
    await writeFile(path.join(webroot, "sgp-archive.json"), JSON.stringify(entry, null, 2) + "\n");
    // Revisions are served directly by Caddy, not by the sgp account. Enforce
    // predictable read/traverse permissions regardless of the publisher's umask.
    await makePublicTreeReadable(webroot);

    return {
      entry,
      previousRevision,
      async promote() {
        if (cleaned) throw new Error("Cannot promote an archived map after its staging directory was cleaned");
        if (promoted) return entry;
        const result = await promoteMapRevision({
          publicRoot: paths.publicRoot,
          privateRoot: paths.privateRoot,
          stagingWebroot: webroot,
          entry,
          retainRevisions: options.config.retainRevisions,
          expectedPreviousRevision: previousRevision,
        });
        promoted = true;
        return result;
      },
      async cleanup() {
        if (cleaned) return;
        cleaned = true;
        await rm(stage, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      },
    };
  } catch (error) {
    await rm(stage, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    throw error;
  }
}

export async function renderMapArchive(options: RenderMapArchiveOptions) {
  const prepared = await prepareMapArchive(options);
  try {
    const entry = await prepared.promote();
    console.log(`Archived edition ${options.editionNumber}: ${entry.webPath}`);
    return entry;
  } finally {
    await prepared.cleanup();
  }
}

export async function loadMapArchiveConfig(configPath: string) {
  const contents = await readFile(configPath, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") throw new Error(`Missing ${configPath}. Copy map-archive.example.json there and configure the archive.`);
    throw error;
  });
  return mapArchiveConfigSchema.parse(JSON.parse(contents));
}
