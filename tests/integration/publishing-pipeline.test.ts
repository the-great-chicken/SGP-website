import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createClient } from "@libsql/client";
import { getItemRenderSignature } from "../../src/lib/item-rendering";
import { publishingConfigSchema, runCommand, runPublishing } from "../../src/publishing/workflow";

const repositoryRoot = process.cwd();
const playerUuid = "11111111-1111-4111-8111-111111111111";
const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=",
  "base64",
);

function pythonExecutable() {
  if (process.env.PYTHON) return process.env.PYTHON;
  const venv = path.join(repositoryRoot, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
  if (existsSync(venv)) return venv;
  return process.platform === "win32" ? "python" : "python3";
}

async function writeStatisticsSnapshot(output: string) {
  await writeFile(output, JSON.stringify({
    $schema: "statistics-snapshot.schema.json",
    schemaVersion: 1,
    datapackRelease: "dp-integration",
    statisticsSchemaVersion: 7,
    players: [{ sgpId: 1, uuid: playerUuid, minecraftName: "IntegrationPlayer" }],
    damageCauses: [],
    kills: [],
    damageReceived: [],
    picks: [],
    abilityMetricDefinitions: [],
    abilityMetrics: [],
    deathPositions: {
      metadata: {
        storedUnit: "block",
        displayUnit: "block",
        displayScale: 1,
        quantization: "none",
        positionReference: "feet",
      },
      entries: [],
    },
    elo: {
      metadata: { initialRating: 1000, kFactor: 32, ratingDivisor: 400, metrics: [] },
      ratings: [],
    },
  }), "utf8");
}

async function writeRenderedItemContract(stage: string) {
  const manifest = JSON.parse(await readFile(path.join(stage, "data/kit-manifest.json"), "utf8")) as {
    schemaVersion: number;
    datapackRelease: string;
    resourcePackRelease: string;
    minecraftVersion: string;
    kits: Array<{ operations: Array<{ item: Parameters<typeof getItemRenderSignature>[0] }> }>;
  };
  const outputDirectory = path.join(stage, "public/generated/item-icons");
  await mkdir(outputDirectory, { recursive: true });
  const items: Record<string, string> = {};

  for (const kit of manifest.kits) {
    for (const operation of kit.operations) {
      const key = createHash("sha256").update(getItemRenderSignature(operation.item)).digest("hex");
      const filename = `${key.slice(0, 20)}.png`;
      await writeFile(path.join(outputDirectory, filename), onePixelPng);
      items[key] = `/generated/item-icons/${filename}`;
    }
  }

  await writeFile(path.join(stage, "data/item-renders.json"), JSON.stringify({
    schemaVersion: 2,
    datapackRelease: manifest.datapackRelease,
    resourcePackRelease: manifest.resourcePackRelease,
    minecraftVersion: manifest.minecraftVersion,
    items,
  }), "utf8");
}

test("edition publication carries real Python exporter output through TypeScript validation and SQLite import", async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "sgp-real-publishing-"));
  const python = pythonExecutable();

  try {
    await mkdir(path.join(workspace, "inputs"), { recursive: true });
    await cp(path.join(repositoryRoot, "tests/fixtures/datapack"), path.join(workspace, "inputs/datapack"), { recursive: true });
    await cp(path.join(repositoryRoot, "drizzle"), path.join(workspace, "drizzle"), { recursive: true });
    await writeFile(path.join(workspace, "inputs/client.jar"), "renderer boundary fixture", "utf8");
    await runCommand(python, [path.join(repositoryRoot, "tests/support/build-publishing-world.py"), workspace], repositoryRoot);

    const source = {
      world: "inputs/world",
      datapack: "inputs/datapack",
      resourcePack: "inputs/pack",
      minecraftClient: "inputs/client.jar",
      minecraftVersion: "26.1",
      datapackRelease: "dp-integration",
      resourcePackRelease: "rp-integration",
      maps: [{ id: "world", dimension: "minecraft:overworld", playableArea: 1, spawnGroups: [1] }],
    };
    const config = publishingConfigSchema.parse({
      databaseUrl: "file:website.sqlite",
      editions: {
        "5": {
          name: "Integration edition",
          startsAt: "2026-08-01T18:00:00Z",
          endsAt: "2026-08-01T22:00:00Z",
          publishedAt: "2026-08-02T10:00:00Z",
          source,
        },
      },
    });

    const command = async (_executable: string, args: string[], cwd: string) => {
      if (args.includes("sgp_kit_exporter") || args.includes("sgp_map_exporter")) {
        await runCommand(python, args, cwd);
        return;
      }
      if (args[0]?.endsWith("export_web.py")) {
        await writeStatisticsSnapshot(args[args.indexOf("--output") + 1]);
        return;
      }
      if (args.some((argument) => argument.endsWith("render-kit-items.mts"))) {
        await writeRenderedItemContract(cwd);
        return;
      }
      throw new Error(`Unexpected publishing command in integration test: ${args.join(" ")}`);
    };

    const stage = await runPublishing({
      root: workspace,
      configDirectory: workspace,
      config,
      mode: { kind: "edition", number: 5 },
      command,
    });

    const manifest = JSON.parse(await readFile(path.join(stage, "data/kit-manifest.json"), "utf8"));
    assert.equal(manifest.datapackRelease, "dp-integration");
    assert.equal(manifest.resourcePackRelease, "rp-integration");
    assert.equal(manifest.kits[0].name, "Exemple");
    assert.equal(manifest.kits[0].operations.length, 2);

    const overlays = JSON.parse(await readFile(path.join(stage, "public/bluemap/overlays.json"), "utf8"));
    assert.equal(overlays.schemaVersion, 1);
    assert.ok(overlays.maps.world["sgp-locations"].markers["location-hall-0"]);
    assert.ok(overlays.maps.world["sgp-spawns"].markers["spawn-1-0"]);

    const databasePath = path.join(workspace, "website.sqlite");
    assert.ok((await stat(databasePath)).isFile());
    const client = createClient({ url: `file:${databasePath}` });
    try {
      const edition = (await client.execute("SELECT number, datapack_version, resource_pack_version FROM editions WHERE number = 5")).rows[0];
      assert.equal(Number(edition.number), 5);
      assert.equal(edition.datapack_version, "dp-integration");
      assert.equal(edition.resource_pack_version, "rp-integration");

      const player = (await client.execute("SELECT current_minecraft_name FROM players WHERE uuid = '11111111-1111-4111-8111-111111111111'")).rows[0];
      assert.equal(player.current_minecraft_name, "IntegrationPlayer");

      const snapshot = (await client.execute("SELECT kit_key, kit_id, manifest FROM kit_snapshots WHERE kit_key = 'example'")).rows[0];
      assert.equal(snapshot.kit_key, "example");
      assert.equal(Number(snapshot.kit_id), 3);
      const storedManifest = JSON.parse(String(snapshot.manifest));
      assert.equal(storedManifest.name, "Exemple");
      assert.equal(storedManifest.operations[0].item.id, "minecraft:trident");
    } finally {
      client.close();
    }
  } finally {
    await rm(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
