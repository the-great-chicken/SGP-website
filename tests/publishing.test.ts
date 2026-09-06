import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createClient } from "@libsql/client";
import { promoteCurrent, publishingConfigSchema, runPublishing } from "../src/publishing/workflow";
import { getItemRenderSignature } from "../src/lib/item-rendering";

const root = process.cwd();
const uuid = "11111111-1111-4111-8111-111111111111";
const item = { id: "minecraft:stone", count: 1, components: {}, removedComponents: [] };
const itemKey = createHash("sha256").update(getItemRenderSignature(item)).digest("hex");

async function fixture() {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "sgp-publishing-"));
  for (const directory of ["inputs/world", "inputs/datapack", "inputs/pack", "data", "public/bluemap", "public/generated/item-icons"]) {
    await mkdir(path.join(workspace, directory), { recursive: true });
  }
  await writeFile(path.join(workspace, "inputs/client.jar"), "fixture");
  await writeFile(path.join(workspace, "data/kit-manifest.json"), "current manifest");
  await writeFile(path.join(workspace, "public/bluemap/overlays.json"), "current overlays");
  await cp(path.join(root, "drizzle"), path.join(workspace, "drizzle"), { recursive: true });
  const source = { world: "inputs/world", datapack: "inputs/datapack", resourcePack: "inputs/pack", minecraftClient: "inputs/client.jar",
    minecraftVersion: "26.1", datapackRelease: "dp-test", resourcePackRelease: "rp-test",
    maps: [{ id: "world", dimension: "minecraft:overworld", playableArea: 1, spawnGroups: [1] }] };
  const config = publishingConfigSchema.parse({ databaseUrl: "file:website.sqlite", current: source,
    editions: { "5": { name: "Edition five", startsAt: "2026-08-01T18:00:00Z", endsAt: "2026-08-01T22:00:00Z", publishedAt: "2026-08-02T10:00:00Z", source } } });
  const calls: string[][] = [];
  let fail = "";
  const command = async (_executable: string, args: string[], cwd: string) => {
    calls.push(args);
    if (fail && args.some((arg) => arg.includes(fail))) throw new Error("Simulated export failure");
    const out = args[args.indexOf("--output") + 1];
    if (args.includes("sgp_kit_exporter")) {
      await writeFile(out, JSON.stringify({ $schema: "../schemas/kit-manifest.schema.json", schemaVersion: 3,
        datapackRelease: "dp-test", resourcePackRelease: "rp-test", minecraftVersion: "26.1", dataPack: { id: "sgp", minFormat: 101.1, maxFormat: 101.1 },
        kits: [{ id: 3, key: "example", name: "Example", color: null, icon: null, ability: null, function: "sgp.kits:collection/example/items",
          operations: [{ kind: "give", source: { line: 1, endLine: 1 }, item }] }] }));
    } else if (args.includes("sgp_map_exporter")) {
      await mkdir(path.dirname(out), { recursive: true });
      await writeFile(out, JSON.stringify({ schemaVersion: 1, maps: { world: {} } }));
    } else if (args[0].endsWith("export_web.py")) {
      await writeFile(out, JSON.stringify({ $schema: "statistics-snapshot.schema.json", schemaVersion: 1, datapackRelease: "dp-test", statisticsSchemaVersion: 7,
        players: [{ sgpId: 1, uuid, minecraftName: "TestPlayer" }], damageCauses: [], kills: [], damageReceived: [], picks: [], abilityMetricDefinitions: [], abilityMetrics: [],
        deathPositions: { metadata: { storedUnit: "block", displayUnit: "block", displayScale: 1, quantization: "none", positionReference: "feet" }, entries: [] },
        elo: { metadata: { initialRating: 1000, kFactor: 32, ratingDivisor: 400, metrics: [] }, ratings: [] } }));
    } else {
      await mkdir(path.join(cwd, "public/generated/item-icons"), { recursive: true });
      await writeFile(path.join(cwd, "public/generated/item-icons/stone.png"), "rendered image");
      await writeFile(path.join(cwd, "data/item-renders.json"), JSON.stringify({ schemaVersion: 2, datapackRelease: "dp-test", resourcePackRelease: "rp-test", minecraftVersion: "26.1", items: { [itemKey]: "/generated/item-icons/stone.png" } }));
    }
  };
  return { workspace, config, command, calls, failAt: (value: string) => { fail = value; }, cleanup: () => rm(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }) };
}

test("failed refresh leaves current content and database untouched", async () => {
  const f = await fixture();
  try {
    f.failAt("render-kit-items");
    await assert.rejects(runPublishing({ root: f.workspace, configDirectory: f.workspace, config: f.config, mode: { kind: "refresh" }, command: f.command }), /Simulated/);
    assert.equal(await readFile(path.join(f.workspace, "data/kit-manifest.json"), "utf8"), "current manifest");
    assert.equal(await readFile(path.join(f.workspace, "public/bluemap/overlays.json"), "utf8"), "current overlays");
    assert.ok(!(await readdir(f.workspace)).includes("website.sqlite"));
    assert.ok(!(await readdir(path.join(f.workspace, ".data/publishing"))).includes("active.lock"));
  } finally { await f.cleanup(); }
});

test("refresh promotes validated current content without exporting statistics", async () => {
  const f = await fixture();
  try {
    await runPublishing({ root: f.workspace, configDirectory: f.workspace, config: f.config, mode: { kind: "refresh" }, command: f.command });
    assert.equal(JSON.parse(await readFile(path.join(f.workspace, "data/kit-manifest.json"), "utf8")).datapackRelease, "dp-test");
    assert.equal(JSON.parse(await readFile(path.join(f.workspace, "public/bluemap/overlays.json"), "utf8")).schemaVersion, 1);
    assert.ok(!f.calls.some((args) => args[0].endsWith("export_web.py")));
  } finally { await f.cleanup(); }
});

test("publishing an edition is repeatable and leaves the current map and kits alone", async () => {
  const f = await fixture();
  try {
    // Current inputs need not even exist when publishing a saved edition.
    f.config.current!.world = "missing-current-world";
    const options = { root: f.workspace, configDirectory: f.workspace, config: f.config, mode: { kind: "edition" as const, number: 5 }, command: f.command };
    await runPublishing(options);
    const secondRun = await runPublishing(options);
    const client = createClient({ url: `file:${path.join(f.workspace, "website.sqlite")}` });
    try {
      assert.equal((await client.execute("SELECT count(*) AS n FROM editions WHERE status = 'published'")).rows[0].n, 1);
      assert.equal((await client.execute("SELECT count(*) AS n FROM players")).rows[0].n, 1);
    } finally { client.close(); }
    assert.ok((await readdir(secondRun)).includes("before-publish.sqlite"));
    assert.equal(await readFile(path.join(f.workspace, "data/kit-manifest.json"), "utf8"), "current manifest");
    assert.equal(await readFile(path.join(f.workspace, "public/bluemap/overlays.json"), "utf8"), "current overlays");
  } finally { await f.cleanup(); }
});

test("invalid statistics fail before rendering or touching an existing database", async () => {
  const f = await fixture();
  try {
    await writeFile(path.join(f.workspace, "website.sqlite"), "untouched database");
    const command = async (executable: string, args: string[], cwd: string) => {
      await f.command(executable, args, cwd);
      if (args[0].endsWith("export_web.py")) {
        const out = args[args.indexOf("--output") + 1];
        const snapshot = JSON.parse(await readFile(out, "utf8"));
        snapshot.players.push(snapshot.players[0]);
        await writeFile(out, JSON.stringify(snapshot));
      }
    };
    await assert.rejects(runPublishing({ root: f.workspace, configDirectory: f.workspace, config: f.config, mode: { kind: "edition", number: 5 }, command }), /duplicate player UUID/);
    assert.equal(await readFile(path.join(f.workspace, "website.sqlite"), "utf8"), "untouched database");
    assert.ok(!f.calls.some((args) => args.some((arg) => arg.endsWith("render-kit-items.mts"))));
  } finally { await f.cleanup(); }
});

test("missing item images prevent promotion", async () => {
  const f = await fixture();
  try {
    const command = async (executable: string, args: string[], cwd: string) => {
      await f.command(executable, args, cwd);
      if (args.some((arg) => arg.endsWith("render-kit-items.mts"))) {
        const out = path.join(cwd, "data/item-renders.json");
        const index = JSON.parse(await readFile(out, "utf8"));
        index.items = {};
        await writeFile(out, JSON.stringify(index));
      }
    };
    await assert.rejects(runPublishing({ root: f.workspace, configDirectory: f.workspace, config: f.config, mode: { kind: "refresh" }, command }), /Missing item image/);
    assert.equal(await readFile(path.join(f.workspace, "data/kit-manifest.json"), "utf8"), "current manifest");
  } finally { await f.cleanup(); }
});

test("promotion restores earlier files when a later file cannot be copied", async () => {
  const f = await fixture();
  try {
    const stage = path.join(f.workspace, "stage");
    await mkdir(path.join(stage, "data"), { recursive: true });
    await mkdir(path.join(stage, "public/generated/item-icons"), { recursive: true });
    await writeFile(path.join(stage, "data/kit-manifest.json"), "replacement manifest");
    await writeFile(path.join(stage, "data/item-renders.json"), "replacement index");
    await assert.rejects(promoteCurrent(f.workspace, stage), /ENOENT/);
    assert.equal(await readFile(path.join(f.workspace, "data/kit-manifest.json"), "utf8"), "current manifest");
    assert.ok(!(await readdir(path.join(f.workspace, "data"))).includes("item-renders.json"));
    assert.equal(await readFile(path.join(f.workspace, "public/bluemap/overlays.json"), "utf8"), "current overlays");
  } finally { await f.cleanup(); }
});

test("prepare-only validates an edition without creating its database", async () => {
  const f = await fixture();
  try {
    await runPublishing({ root: f.workspace, configDirectory: f.workspace, config: f.config, mode: { kind: "edition", number: 5 }, command: f.command, prepareOnly: true });
    assert.ok(!(await readdir(f.workspace)).includes("website.sqlite"));
  } finally { await f.cleanup(); }
});
