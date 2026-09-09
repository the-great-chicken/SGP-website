import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "../src/db/schema";
import { kitManifest } from "../e2e/kit-manifest";
import {
  e2eBaseUrl,
  e2eBravoUuid,
  e2eBridgeSecret,
  e2eDiscordId,
  e2eMockServerUrl,
  e2ePlayerUuid,
  e2eSessionToken,
} from "../e2e/fixture-values";

const databasePath = resolve(".data/e2e.sqlite");
const manifestPath = resolve(".data/e2e-kit-manifest.json");
const nextPort = Number(new URL(e2eBaseUrl).port);
const mockUrl = new URL(e2eMockServerUrl);

await ensureProductionBuild();
await prepareFixtures();

const mockServer = createServer(handleMockRequest);
await new Promise<void>((resolveReady, reject) => {
  mockServer.once("error", reject);
  mockServer.listen(Number(mockUrl.port), mockUrl.hostname, () => resolveReady());
});

const nextProcess = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-H", "0.0.0.0", "-p", String(nextPort)],
  {
    cwd: process.cwd(),
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "production",
      DATABASE_URL: `file:${databasePath}`,
      KIT_MANIFEST_PATH: manifestPath,
      DISCORD_CLIENT_ID: "e2e-client-id",
      DISCORD_CLIENT_SECRET: "e2e-client-secret",
      DISCORD_REDIRECT_URI: `${e2eBaseUrl}/api/auth/discord/callback`,
      COSMETICS_BRIDGE_URL: e2eMockServerUrl,
      COSMETICS_BRIDGE_SECRET: e2eBridgeSecret,
      MINECRAFT_SESSION_SERVER_URL: e2eMockServerUrl,
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
);

let shuttingDown = false;
function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  mockServer.close();
  if (!nextProcess.killed) nextProcess.kill(signal);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => shutdown(signal));
}

nextProcess.once("error", (error) => {
  console.error("Failed to start the Next.js E2E server.", error);
  shutdown("SIGTERM");
  process.exitCode = 1;
});
nextProcess.once("exit", (code, signal) => {
  mockServer.close();
  if (!shuttingDown) {
    console.error(`Next.js E2E server exited unexpectedly (${signal ?? code ?? "unknown"}).`);
    process.exitCode = code && code !== 0 ? code : 1;
  }
  process.exit();
});

async function ensureProductionBuild() {
  try {
    await access(resolve(".next/BUILD_ID"));
  } catch {
    throw new Error("Playwright smoke tests require a production build. Run `npm run build` before `npm run test:e2e`.");
  }
}

async function prepareFixtures() {
  await mkdir(resolve(".data"), { recursive: true });
  for (const suffix of ["", "-shm", "-wal"]) {
    await rm(`${databasePath}${suffix}`, { force: true });
  }
  await writeFile(manifestPath, `${JSON.stringify(kitManifest, null, 2)}\n`, "utf8");

  const client = createClient({ url: `file:${databasePath}` });
  const database = drizzle(client, { schema });
  try {
    await migrate(database, { migrationsFolder: resolve("drizzle") });

    const insertedEditions = await database
      .insert(schema.editions)
      .values([
        {
          number: 1,
          name: "Première édition",
          status: "archived",
          startsAt: new Date("2025-01-10T19:00:00Z"),
          minecraftVersion: "1.21.4",
          statisticsSchemaVersion: 7,
        },
        {
          number: 2,
          name: "Deuxième édition",
          status: "published",
          startsAt: new Date("2026-02-14T19:00:00Z"),
          minecraftVersion: "26.1",
          statisticsSchemaVersion: 7,
        },
      ])
      .returning({ id: schema.editions.id, number: schema.editions.number });
    const editionId = (number: number) => insertedEditions.find((edition) => edition.number === number)!.id;

    await database.insert(schema.players).values([
      {
        uuid: e2ePlayerUuid,
        currentMinecraftName: "AlphaPrime",
        discordId: e2eDiscordId,
        discordUsername: "alpha_discord",
        discordDisplayName: "Alpha Discord",
      },
      { uuid: e2eBravoUuid, currentMinecraftName: "Bravo" },
    ]);
    await database.insert(schema.editionPlayers).values([
      { editionId: editionId(1), playerUuid: e2ePlayerUuid, sgpId: 1, minecraftNameAtEvent: "OldAlpha" },
      { editionId: editionId(1), playerUuid: e2eBravoUuid, sgpId: 2, minecraftNameAtEvent: "Bravo" },
      { editionId: editionId(2), playerUuid: e2ePlayerUuid, sgpId: 4, minecraftNameAtEvent: "AlphaPrime" },
      { editionId: editionId(2), playerUuid: e2eBravoUuid, sgpId: 5, minecraftNameAtEvent: "Bravo" },
    ]);
    await database.insert(schema.kitSnapshots).values([
      { editionId: editionId(1), kitKey: "warrior", kitId: 10, manifestSchemaVersion: 3, manifest: {} },
      { editionId: editionId(1), kitKey: "mage", kitId: 20, manifestSchemaVersion: 3, manifest: {} },
      { editionId: editionId(2), kitKey: "warrior", kitId: 7, manifestSchemaVersion: 3, manifest: {} },
      { editionId: editionId(2), kitKey: "mage", kitId: 8, manifestSchemaVersion: 3, manifest: {} },
    ]);
    await database.insert(schema.playerRatings).values([
      { editionId: editionId(1), playerUuid: e2ePlayerUuid, rating: 1050, ratedEncounters: 4 },
      { editionId: editionId(1), playerUuid: e2eBravoUuid, rating: 1100, ratedEncounters: 5 },
      { editionId: editionId(2), playerUuid: e2ePlayerUuid, rating: 1200, ratedEncounters: 7 },
      { editionId: editionId(2), playerUuid: e2eBravoUuid, rating: 1150, ratedEncounters: 6 },
    ]);
    await database.insert(schema.editionKills).values([
      { editionId: editionId(1), killerUuid: e2ePlayerUuid, killerKitId: 10, victimUuid: e2eBravoUuid, victimKitId: 20, causeId: 1, count: 3 },
      { editionId: editionId(1), killerUuid: e2eBravoUuid, killerKitId: 20, victimUuid: e2ePlayerUuid, victimKitId: 10, causeId: 1, count: 1 },
      { editionId: editionId(2), killerUuid: e2ePlayerUuid, killerKitId: 8, victimUuid: e2eBravoUuid, victimKitId: 7, causeId: 1, count: 5 },
      { editionId: editionId(2), killerUuid: e2eBravoUuid, killerKitId: 7, victimUuid: e2ePlayerUuid, victimKitId: 8, causeId: 1, count: 2 },
    ]);
    await database.insert(schema.editionDamageReceived).values([
      { editionId: editionId(1), targetUuid: e2eBravoUuid, targetKitId: 20, sourceUuid: e2ePlayerUuid, sourceKitId: 10, causeId: 1, amount: 40 },
      { editionId: editionId(1), targetUuid: e2ePlayerUuid, targetKitId: 10, sourceUuid: e2eBravoUuid, sourceKitId: 20, causeId: 1, amount: 10 },
      { editionId: editionId(1), targetUuid: e2ePlayerUuid, targetKitId: 10, sourceUuid: e2ePlayerUuid, sourceKitId: 10, causeId: 2, amount: 100 },
      { editionId: editionId(2), targetUuid: e2eBravoUuid, targetKitId: 7, sourceUuid: e2ePlayerUuid, sourceKitId: 8, causeId: 1, amount: 70 },
      { editionId: editionId(2), targetUuid: e2ePlayerUuid, targetKitId: 8, sourceUuid: e2eBravoUuid, sourceKitId: 7, causeId: 1, amount: 20 },
    ]);
    await database.insert(schema.editionPicks).values([
      { editionId: editionId(1), playerUuid: e2ePlayerUuid, kitId: 10, totalTimeTicks: 1200, count: 2 },
      { editionId: editionId(1), playerUuid: e2ePlayerUuid, kitId: 20, totalTimeTicks: 600, count: 1 },
      { editionId: editionId(1), playerUuid: e2eBravoUuid, kitId: 20, totalTimeTicks: 1800, count: 2 },
      { editionId: editionId(2), playerUuid: e2ePlayerUuid, kitId: 7, totalTimeTicks: 2400, count: 3 },
      { editionId: editionId(2), playerUuid: e2ePlayerUuid, kitId: 8, totalTimeTicks: 4800, count: 2 },
      { editionId: editionId(2), playerUuid: e2eBravoUuid, kitId: 7, totalTimeTicks: 3600, count: 4 },
    ]);
    await database.insert(schema.editionStatisticsMetadata).values([
      { editionId: editionId(1), deathPositionMetadata: {}, elo: {} },
      { editionId: editionId(2), deathPositionMetadata: {}, elo: {} },
    ]);
    await database.insert(schema.authSessions).values({
      tokenHash: createHash("sha256").update(e2eSessionToken).digest("hex"),
      discordId: e2eDiscordId,
      discordUsername: "alpha_discord",
      discordDisplayName: "Alpha Discord",
      discordAvatarUrl: null,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
  } finally {
    client.close();
  }
}

type CosmeticSnapshot = {
  protocolVersion: 2;
  playerUuid: string;
  observedAt: number;
  catalogue: Array<{
    id: string;
    category: "particle" | "intensity" | "kill";
    name: string;
    color: string;
    sortOrder: number;
  }>;
  unlocked: string[];
  equipment: Record<"particle" | "intensity" | "kill", string | null>;
  issues: string[];
};

function freshCosmeticSnapshot(): CosmeticSnapshot {
  return {
    protocolVersion: 2,
    playerUuid: e2ePlayerUuid,
    observedAt: Date.now(),
    catalogue: [
      { id: "particle.spark", category: "particle", name: "Étincelle", color: "#ffd76a", sortOrder: 0 },
      { id: "particle.cloud", category: "particle", name: "Nuage", color: "#f5f3ea", sortOrder: 1 },
      { id: "intensity.light", category: "intensity", name: "Légère", color: "#d9efff", sortOrder: 0 },
    ],
    unlocked: ["particle.spark", "particle.cloud", "intensity.light"],
    equipment: { particle: null, intensity: "intensity.light", kill: null },
    issues: [],
  };
}

let cosmeticSnapshot = freshCosmeticSnapshot();
let failNextMutation = false;

async function handleMockRequest(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url ?? "/", e2eMockServerUrl);

  if (url.pathname.startsWith("/session/minecraft/profile/")) {
    response.writeHead(204).end();
    return;
  }

  if (request.headers.authorization !== `Bearer ${e2eBridgeSecret}`) {
    json(response, 401, { error: "UNAUTHENTICATED" });
    return;
  }

  if (request.method === "POST" && url.pathname === "/__test/reset") {
    cosmeticSnapshot = freshCosmeticSnapshot();
    failNextMutation = false;
    json(response, 200, { ok: true });
    return;
  }
  if (request.method === "POST" && url.pathname === "/__test/fail-next") {
    failNextMutation = true;
    json(response, 200, { ok: true });
    return;
  }
  if (request.method === "POST" && url.pathname === "/v1/state") {
    await readJsonBody(request);
    json(response, 200, cosmeticSnapshot);
    return;
  }
  if (request.method === "PUT" && url.pathname === "/v1/equipment") {
    const body = await readJsonBody(request);
    if (failNextMutation) {
      failNextMutation = false;
      json(response, 503, { error: "UNCONFIRMED" });
      return;
    }
    const category = body.category;
    const cosmeticId = body.cosmeticId;
    if (category !== "particle" && category !== "intensity" && category !== "kill") {
      json(response, 400, { error: "INVALID_CATEGORY" });
      return;
    }
    cosmeticSnapshot.equipment[category] = typeof cosmeticId === "string" ? cosmeticId : null;
    cosmeticSnapshot.observedAt = Date.now();
    json(response, 200, cosmeticSnapshot);
    return;
  }

  json(response, 404, { error: "NOT_FOUND" });
}

function json(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJsonBody(request: IncomingMessage) {
  let source = "";
  for await (const chunk of request) source += chunk;
  return source ? JSON.parse(source) as Record<string, unknown> : {};
}
