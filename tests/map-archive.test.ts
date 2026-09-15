import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createBlueMapConfigText,
  mapArchiveConfigSchema,
  prepareMapArchive,
  promoteMapRevision,
  readMapArchiveManifest,
  renderMapArchive,
  resolveMapArchivePaths,
} from "../src/map-archive/archive";
import { translateBlueMapHash } from "../src/lib/map-timeline";

const root = process.cwd();

async function fixture() {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "sgp-map-archive-"));
  const world = path.join(workspace, "world");
  const pack = path.join(workspace, "pack");
  await mkdir(path.join(world, "region"), { recursive: true });
  await mkdir(pack, { recursive: true });
  await writeFile(path.join(world, "level.dat"), "world");
  await writeFile(path.join(world, "region/r.0.0.mca"), "chunks");
  await writeFile(path.join(pack, "pack.mcmeta"), "{}");
  const config = mapArchiveConfigSchema.parse({
    archiveDirectory: path.join(workspace, "map-archive"),
    blueMapJar: path.join(workspace, "bluemap.jar"),
    retainRevisions: 2,
    editions: {
      "1": {
        snapshotKey: "edition-1",
        world,
        resourcePack: pack,
        minecraftVersion: "1.15.2",
        center: { x: 100, y: 72, z: -40 },
        renderRadius: 512,
      },
    },
  });
  await writeFile(config.blueMapJar!, "fake jar");
  let mutate: "world" | "pack" | null = null;
  let renderCounter = 0;
  const command = async (_executable: string, args: string[], cwd: string) => {
    assert.equal(args[0], "-jar");
    renderCounter += 1;
    await mkdir(path.join(cwd, "web/maps/world/tiles/0/x0"), { recursive: true });
    await writeFile(path.join(cwd, "web/index.html"), `<html>${renderCounter}</html>`);
    await writeFile(path.join(cwd, "web/settings.json"), "{}");
    await writeFile(path.join(cwd, "web/maps/world/settings.json"), "{}");
    await writeFile(path.join(cwd, "web/maps/world/tiles/0/x0/z0.prbm.gz"), "tile");
    if (mutate === "world") await writeFile(path.join(world, "region/r.0.0.mca"), `changed ${Date.now()}`);
    if (mutate === "pack") await writeFile(path.join(pack, "pack.mcmeta"), `changed ${Date.now()}`);
  };
  return {
    workspace,
    world,
    pack,
    config,
    command,
    mutate(value: "world" | "pack" | null) { mutate = value; },
    cleanup: () => rm(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }),
  };
}

test("duplicate snapshot keys are rejected before rendering", async () => {
  const f = await fixture();
  try {
    f.config.editions["2"] = { ...f.config.editions["1"], world: f.world };
    await assert.rejects(
      renderMapArchive({ root, configDirectory: f.workspace, config: f.config, editionNumber: 1, command: f.command }),
      /snapshotKey edition-1 is also used by edition 2/,
    );
  } finally { await f.cleanup(); }
});

test("generated BlueMap configuration is static, perspective-only and bounded", async () => {
  const f = await fixture();
  try {
    const configs = createBlueMapConfigText({
      world: f.world,
      webroot: path.join(f.workspace, "web"),
      data: path.join(f.workspace, "data"),
      resourcePack: f.pack,
      edition: f.config.editions["1"],
    });
    assert.match(configs["webserver.conf"], /enabled: false/);
    assert.match(configs["webapp.conf"], /client-decompression: true/);
    assert.match(configs["webapp.conf"], /scripts: \["\.\/bluemap-archive\.js"\]/);
    assert.match(configs["webapp.conf"], /styles: \["\.\/bluemap-archive\.css"\]/);
    assert.match(configs["maps/world.conf"], /enable-perspective-view: true/);
    assert.match(configs["maps/world.conf"], /enable-flat-view: false/);
    assert.match(configs["maps/world.conf"], /enable-free-flight-view: false/);
    assert.match(configs["maps/world.conf"], /type: box/);
    assert.match(configs["maps/world.conf"], /min-x: -412/);
    assert.match(configs["maps/world.conf"], /max-z: 472/);
    assert.match(configs["maps/world.conf"], /start-pos: \{ x: 100, z: -40 \}/);
    assert.doesNotMatch(configs["maps/world.conf"], /start-pos:.*y:/);
  } finally { await f.cleanup(); }
});

test("a prepared render is invisible until promotion and then becomes current", async () => {
  const f = await fixture();
  try {
    const prepared = await prepareMapArchive({ root, configDirectory: f.workspace, config: f.config, editionNumber: 1, command: f.command,
      now: () => new Date("2026-09-15T06:00:00Z") });
    const paths = resolveMapArchivePaths(f.workspace, f.config);
    assert.deepEqual((await readMapArchiveManifest(paths.publicRoot)).editions, {});
    await prepared.promote();
    const manifest = await readMapArchiveManifest(paths.publicRoot);
    assert.equal(manifest.editions["edition-1"].revision, prepared.entry.revision);
    assert.equal(await readFile(path.join(paths.publicRoot, prepared.entry.webPath, "index.html"), "utf8"), "<html>1</html>");
    assert.equal(await readFile(path.join(paths.publicRoot, prepared.entry.webPath, "maps/world/live/players.json"), "utf8"), '{"players":[]}\n');
    assert.equal(await readFile(path.join(paths.publicRoot, prepared.entry.webPath, "maps/world/live/markers.json"), "utf8"), '{}\n');
    const provenance = await readFile(path.join(paths.publicRoot, prepared.entry.webPath, "sgp-archive.json"), "utf8");
    assert.doesNotMatch(provenance, /sourceWorld|sourceResourcePack/);
    assert.equal(await readFile(path.join(paths.publicRoot, prepared.entry.webPath, "bluemap-archive.js"), "utf8").then((value) => value.includes("mapEventSource.close()")), true);
    assert.equal(await readFile(path.join(paths.publicRoot, prepared.entry.webPath, "bluemap-archive.css"), "utf8").then((value) => value.includes("#map-container")), true);
    const mode = (await stat(path.join(paths.publicRoot, prepared.entry.webPath))).mode & 0o777;
    assert.equal(mode, 0o755);
    await prepared.cleanup();
  } finally { await f.cleanup(); }
});

test("promotion clears a lock left by a dead archive process", async () => {
  const f = await fixture();
  try {
    const prepared = await prepareMapArchive({ root, configDirectory: f.workspace, config: f.config, editionNumber: 1, command: f.command });
    const paths = resolveMapArchivePaths(f.workspace, f.config);
    await mkdir(paths.privateRoot, { recursive: true });
    await writeFile(path.join(paths.privateRoot, "archive.lock"), "node:99999999\n");
    await prepared.promote();
    assert.equal((await readMapArchiveManifest(paths.publicRoot)).editions["edition-1"].revision, prepared.entry.revision);
    await prepared.cleanup();
  } finally { await f.cleanup(); }
});

test("replacement keeps current plus previous revision and never renders over the active copy", async () => {
  const f = await fixture();
  try {
    for (const date of ["2026-09-15T06:00:00Z", "2026-09-15T07:00:00Z", "2026-09-15T08:00:00Z"]) {
      await renderMapArchive({ root, configDirectory: f.workspace, config: f.config, editionNumber: 1, command: f.command, now: () => new Date(date) });
    }
    const paths = resolveMapArchivePaths(f.workspace, f.config);
    const revisions = (await readdir(path.join(paths.publicRoot, "editions/edition-1"), { withFileTypes: true }))
      .filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    assert.equal(revisions.length, 2);
    const manifest = await readMapArchiveManifest(paths.publicRoot);
    assert.ok(revisions.includes(manifest.editions["edition-1"].revision));
  } finally { await f.cleanup(); }
});

test("retention prefers the actual previous manifest revision over a crash orphan", async () => {
  const f = await fixture();
  try {
    const first = await renderMapArchive({ root, configDirectory: f.workspace, config: f.config, editionNumber: 1, command: f.command,
      now: () => new Date("2026-09-15T06:00:00Z") });
    const paths = resolveMapArchivePaths(f.workspace, f.config);
    const editionRoot = path.join(paths.publicRoot, "editions/edition-1");
    const orphan = "99999999T999999Z-orphan";
    await mkdir(path.join(editionRoot, orphan));
    const second = await renderMapArchive({ root, configDirectory: f.workspace, config: f.config, editionNumber: 1, command: f.command,
      now: () => new Date("2026-09-15T07:00:00Z") });
    const revisions = (await readdir(editionRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    assert.deepEqual(new Set(revisions), new Set([first.revision, second.revision]));
  } finally { await f.cleanup(); }
});

test("stale prepared render cannot overwrite a newer manual replacement", async () => {
  const f = await fixture();
  try {
    const older = await prepareMapArchive({ root, configDirectory: f.workspace, config: f.config, editionNumber: 1, command: f.command,
      now: () => new Date("2026-09-15T06:00:00Z") });
    const newer = await prepareMapArchive({ root, configDirectory: f.workspace, config: f.config, editionNumber: 1, command: f.command,
      now: () => new Date("2026-09-15T07:00:00Z") });
    await newer.promote();
    await assert.rejects(older.promote(), /changed while this render was being prepared/);
    const paths = resolveMapArchivePaths(f.workspace, f.config);
    assert.equal((await readMapArchiveManifest(paths.publicRoot)).editions["edition-1"].revision, newer.entry.revision);
    await older.cleanup();
    await newer.cleanup();
  } finally { await f.cleanup(); }
});

test("world and resource-pack mutation during rendering are rejected", async () => {
  for (const source of ["world", "pack"] as const) {
    const f = await fixture();
    try {
      f.mutate(source);
      await assert.rejects(
        renderMapArchive({ root, configDirectory: f.workspace, config: f.config, editionNumber: 1, command: f.command }),
        source === "world" ? /source world changed/ : /resource pack changed/,
      );
      const paths = resolveMapArchivePaths(f.workspace, f.config);
      assert.deepEqual((await readMapArchiveManifest(paths.publicRoot)).editions, {});
    } finally { await f.cleanup(); }
  }
});

test("render refuses to publish a BlueMap shell with no map tiles", async () => {
  const f = await fixture();
  try {
    const noTiles = async (_executable: string, _args: string[], cwd: string) => {
      await mkdir(path.join(cwd, "web/maps/world"), { recursive: true });
      await writeFile(path.join(cwd, "web/index.html"), "<html></html>");
      await writeFile(path.join(cwd, "web/settings.json"), "{}");
      await writeFile(path.join(cwd, "web/maps/world/settings.json"), "{}");
    };
    await assert.rejects(
      renderMapArchive({ root, configDirectory: f.workspace, config: f.config, editionNumber: 1, command: noTiles }),
      /no map tiles were produced/,
    );
    const paths = resolveMapArchivePaths(f.workspace, f.config);
    assert.deepEqual((await readMapArchiveManifest(paths.publicRoot)).editions, {});
  } finally { await f.cleanup(); }
});

test("promotion rejects unsafe manifest paths", async () => {
  const f = await fixture();
  try {
    const paths = resolveMapArchivePaths(f.workspace, f.config);
    const staging = path.join(f.workspace, "staging-web");
    await mkdir(staging);
    await assert.rejects(promoteMapRevision({
      publicRoot: paths.publicRoot,
      privateRoot: paths.privateRoot,
      stagingWebroot: staging,
      retainRevisions: 2,
      entry: {
        editionNumber: 1, snapshotKey: "edition-1", revision: "r1", webPath: "../escape", center: { x: 0, z: 0 },
        renderRadius: 1, dimension: "minecraft:overworld", minecraftVersion: "1.15.2", blueMapVersion: "5.24",
        renderedAt: new Date().toISOString(), sourceFingerprint: "x", resourcePackFingerprint: null,
      },
    }), /Unsafe archived map path|does not match/);
  } finally { await f.cleanup(); }
});

test("camera translation preserves BlueMap view fields and aligns centers", () => {
  const source = "#world:125:80:-10:320:1.2:0.6:0.2:false:perspective";
  assert.equal(
    translateBlueMapHash(source, { x: 100, y: 70, z: -40 }, { x: -200, y: 65, z: 300 }),
    "#world:-175:75:330:320:1.2:0.6:0.2:false:perspective",
  );
  assert.equal(
    translateBlueMapHash(source, { x: 100, z: -40 }, { x: -200, z: 300 }),
    "#world:-175:80:330:320:1.2:0.6:0.2:false:perspective",
  );
  assert.equal(translateBlueMapHash("#not-a-camera", { x: 0, z: 0 }, { x: 1, z: 1 }), "");
});
