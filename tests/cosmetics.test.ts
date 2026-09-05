import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema";
import { queryAuthSession, storeAuthSession, type AuthSession } from "../src/auth/session-query";
import { syncDiscordSrvLinks } from "../src/db/discordsrv";
import { createCosmeticBridge, type CosmeticBridge } from "../src/cosmetics/bridge";
import { cosmeticHandlers } from "../src/cosmetics/http";
import { CosmeticError, snapshotSchema, type Identity, type Selection, type Snapshot } from "../src/cosmetics/model";
import { createCosmeticService } from "../src/cosmetics/service";
import { readCosmeticCache, saveCosmeticSnapshot } from "../src/cosmetics/store";

const alpha = "11111111-1111-4111-8111-111111111111";
const bravo = "22222222-2222-4222-8222-222222222222";
const discordId = "111111111111111111";
const session: AuthSession = {
  discord: { id: discordId, username: "alpha", displayName: null, avatarUrl: null },
  player: { uuid: alpha, minecraftName: "Alpha" }, expiresAt: new Date(Date.now() + 3_600_000),
};
function snapshot(playerUuid = alpha): Snapshot {
  return {
    protocolVersion: 1, playerUuid, observedAt: Date.now(),
    catalogue: [
      { id: "particle.cloud", category: "particle", name: "Nuage", sortOrder: 0 },
      { id: "particle.smoke", category: "particle", name: "Fumée", sortOrder: 1 },
      { id: "intensity.light", category: "intensity", name: "Légère", sortOrder: 0 },
      { id: "kill.anvil", category: "kill", name: "Enclume", sortOrder: 0 },
    ],
    unlocked: ["particle.cloud", "intensity.light"],
    equipment: { particle: null, intensity: null, kill: null }, issues: [],
  };
}
class FakeBridge implements CosmeticBridge {
  current = snapshot();
  readError: CosmeticError | null = null;
  changeError: CosmeticError | null = null;
  loseReply = false;
  wrongReadback = false;
  reads: Identity[] = [];
  changes: Array<{ identity: Identity; selection: Selection }> = [];
  async read(identity: Identity) {
    this.reads.push(identity);
    if (this.readError) throw this.readError;
    if (identity.playerUuid !== alpha || identity.discordId !== discordId) throw new CosmeticError("LINK_MISMATCH", 403);
    return structuredClone(this.current);
  }
  async change(identity: Identity, selection: Selection) {
    this.changes.push({ identity, selection });
    if (this.changeError) throw this.changeError;
    if (!this.wrongReadback) this.current.equipment[selection.category] = selection.cosmeticId;
    if (this.loseReply) throw new CosmeticError("UNCONFIRMED");
    return structuredClone(this.current);
  }
}
async function fixture() {
  const client = createClient({ url: "file::memory:" });
  const database = drizzle(client, { schema });
  await migrate(database, { migrationsFolder: resolve("drizzle") });
  await database.insert(schema.players).values([
    { uuid: alpha, currentMinecraftName: "Alpha", discordId },
    { uuid: bravo, currentMinecraftName: "Bravo" },
  ]);
  const bridge = new FakeBridge();
  const store = {
    save: (value: Snapshot) => saveCosmeticSnapshot(database, value),
    read: (uuid: string) => readCosmeticCache(database, uuid),
  };
  const service = createCosmeticService(bridge, store);
  return { client, database, bridge, store, service };
}
function request(body: unknown, origin = "https://sgp.test") {
  return new Request("https://sgp.test/api/me/cosmetics", {
    method: "PUT", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}
test("HTTP rejects anonymous, expired and unlinked sessions before contacting Minecraft", async () => {
  const f = await fixture();
  try {
    for (const [user, status] of [
      [null, 401], [{ ...session, expiresAt: new Date(0) }, 401], [{ ...session, player: null }, 403],
    ] as const) {
      const handlers = cosmeticHandlers(async () => user, f.service);
      assert.equal((await handlers.GET()).status, status);
      assert.equal((await handlers.PUT(request({ category: "particle", cosmeticId: "particle.cloud" }))).status, status);
    }
    assert.equal(f.bridge.reads.length, 0);
    assert.equal(f.bridge.changes.length, 0);
  } finally { f.client.close(); }
});
test("HTTP rejects forged identities, cross-site requests, malformed and oversized JSON", async () => {
  const f = await fixture();
  try {
    const handlers = cosmeticHandlers(async () => session, f.service);
    const selection = { category: "particle", cosmeticId: "particle.cloud" };
    assert.equal((await handlers.PUT(request({ ...selection, playerUuid: bravo }))).status, 400);
    assert.equal((await handlers.PUT(request({ ...selection, discordId: "222222222222222222" }))).status, 400);
    assert.equal((await handlers.PUT(request(selection, "https://attacker.test"))).status, 403);
    assert.equal((await handlers.PUT(request(selection, ""))).status, 403);
    assert.equal((await handlers.PUT(request({ category: "x".repeat(5000), cosmeticId: null }))).status, 413);
    assert.equal((await handlers.PUT(new Request("https://sgp.test/api/me/cosmetics", {
      method: "PUT", headers: { Origin: "https://sgp.test", "Content-Type": "application/json" }, body: "{",
    }))).status, 400);
    assert.equal(f.bridge.changes.length, 0);
  } finally { f.client.close(); }
});
test("only session identity reaches Minecraft and another player's cache is untouched", async () => {
  const f = await fixture();
  try {
    const other = snapshot(bravo);
    other.equipment.intensity = "intensity.light";
    await f.store.save(other);
    const handlers = cosmeticHandlers(async () => session, f.service);
    assert.equal((await handlers.PUT(request({ category: "particle", cosmeticId: "particle.cloud" }))).status, 200);
    assert.deepEqual(f.bridge.changes[0].identity, { discordId, playerUuid: alpha });
    assert.equal((await f.store.read(alpha)).equipment.particle?.id, "particle.cloud");
    assert.equal((await f.store.read(bravo)).equipment.intensity?.id, "intensity.light");
    assert.equal((await f.store.read(bravo)).equipment.particle, null);
  } finally { f.client.close(); }
});
test("same-origin mutations work behind a TLS proxy preserving the public Host", async () => {
  const f = await fixture();
  try {
    const handlers = cosmeticHandlers(async () => session, f.service);
    const reply = await handlers.PUT(new Request("http://localhost:3000/api/me/cosmetics", {
      method: "PUT", headers: { Host: "sgp.test", Origin: "https://sgp.test", "Content-Type": "application/json" },
      body: JSON.stringify({ category: "particle", cosmeticId: "particle.cloud" }),
    }));
    assert.equal(reply.status, 200);
    const forged = await handlers.PUT(new Request("http://localhost:3000/api/me/cosmetics", {
      method: "PUT", headers: { Host: "sgp.test", Origin: "https://attacker.test",
        "X-Forwarded-Host": "attacker.test", "Content-Type": "application/json" },
      body: JSON.stringify({ category: "particle", cosmeticId: null }),
    }));
    assert.equal(forged.status, 403);
  } finally { f.client.close(); }
});
test("unknown categories, cosmetics, locked and wrong-category selections cannot mutate", async () => {
  const f = await fixture();
  try {
    await assert.rejects(f.service.change(session, { category: "title", cosmeticId: null }), /INVALID_REQUEST/);
    for (const selection of [
      { category: "particle", cosmeticId: "particle.missing" },
      { category: "particle", cosmeticId: "particle.smoke" },
      { category: "kill", cosmeticId: "particle.cloud" },
    ]) assert.equal((await f.service.change(session, selection)).confirmed, false);
    assert.equal(f.bridge.changes.length, 0);
  } finally { f.client.close(); }
});
test("repeated equip and unequip preserve one row per slot and other slots", async () => {
  const f = await fixture();
  try {
    for (let i = 0; i < 2; i++) {
      assert.equal((await f.service.change(session, { category: "particle", cosmeticId: "particle.cloud" })).confirmed, true);
    }
    assert.equal((await f.database.select().from(schema.playerEquipment)).length, 1);
    await f.service.change(session, { category: "intensity", cosmeticId: "intensity.light" });
    for (let i = 0; i < 2; i++) {
      assert.equal((await f.service.change(session, { category: "particle", cosmeticId: null })).confirmed, true);
    }
    const equipment = await f.database.select().from(schema.playerEquipment);
    assert.equal(equipment.length, 1);
    assert.equal(equipment[0].category, "intensity");
  } finally { f.client.close(); }
});
test("Minecraft rejects stale unlocks even when the website read allowed them", async () => {
  const f = await fixture();
  try {
    f.bridge.current.equipment.intensity = "intensity.light";
    f.bridge.changeError = new CosmeticError("LOCKED", 403);
    const result = await f.service.change(session, { category: "particle", cosmeticId: "particle.cloud" });
    assert.equal(result.confirmed, false);
    assert.equal(result.view.equipment.particle, null);
    assert.equal(result.view.equipment.intensity?.id, "intensity.light");
  } finally { f.client.close(); }
});
test("offline and unavailable states show dated cache and never queue changes", async () => {
  const f = await fixture();
  try {
    await f.service.read(session);
    f.bridge.readError = new CosmeticError("OFFLINE", 409);
    const result = await f.service.change(session, { category: "particle", cosmeticId: "particle.cloud" });
    assert.equal(result.confirmed, false);
    assert.equal(result.view.status, "offline");
    assert.equal(result.view.cosmetics.length, 2);
    assert.ok(result.view.observedAt);
    assert.equal(f.bridge.changes.length, 0);
    f.bridge.readError = new CosmeticError("UNCONFIRMED");
    assert.equal((await f.service.read(session)).status, "unavailable");
  } finally { f.client.close(); }
});
test("a lost reply refreshes actual state without claiming or replaying success", async () => {
  const f = await fixture();
  try {
    f.bridge.loseReply = true;
    const result = await f.service.change(session, { category: "particle", cosmeticId: "particle.cloud" });
    assert.equal(result.confirmed, false);
    assert.equal(result.view.equipment.particle?.id, "particle.cloud");
    assert.equal((await f.store.read(alpha)).equipment.particle?.id, "particle.cloud");
    assert.equal(f.bridge.changes.length, 1);
  } finally { f.client.close(); }
});
test("wrong readback is unconfirmed, and cache failures distinguish confirmed Minecraft state", async () => {
  const f = await fixture();
  try {
    f.bridge.wrongReadback = true;
    assert.equal((await f.service.change(session, { category: "particle", cosmeticId: "particle.cloud" })).confirmed, false);
    f.bridge.wrongReadback = false;
    let saves = 0;
    const service = createCosmeticService(f.bridge, {
      ...f.store, save: async (value) => { if (++saves === 2) throw new Error("disk full"); await f.store.save(value); },
    });
    const result = await service.change(session, { category: "particle", cosmeticId: "particle.cloud" });
    assert.equal(result.confirmed, true);
    assert.match(result.message, /copie du site/);
    assert.equal((await f.store.read(alpha)).equipment.particle, null);
  } finally { f.client.close(); }
});
test("DiscordSRV unlink invalidates existing sessions and stale link caches fail closed", async () => {
  const f = await fixture();
  try {
    await storeAuthSession(f.database, "token-hash", session.discord, session.expiresAt);
    await f.service.read(session);
    f.bridge.readError = new CosmeticError("LINK_MISMATCH", 403);
    const view = await f.service.read(session);
    assert.equal(view.status, "link_mismatch");
    assert.equal(view.cosmetics.length, 0);
    await syncDiscordSrvLinks(f.database, []);
    const unlinked = await queryAuthSession(f.database, "token-hash");
    await assert.rejects(f.service.change(unlinked, { category: "particle", cosmeticId: null }), /UNLINKED/);
  } finally { f.client.close(); }
});
test("fresh snapshots reconcile in-game changes, removed unlocks and catalogue entries", async () => {
  const f = await fixture();
  try {
    f.bridge.current.equipment.particle = "particle.cloud";
    await f.service.read(session);
    f.bridge.current.catalogue = f.bridge.current.catalogue.filter((c) => c.id !== "particle.cloud");
    f.bridge.current.unlocked = ["intensity.light"];
    f.bridge.current.equipment.particle = null;
    const result = await f.service.read(session);
    assert.equal(result.cosmetics.length, 1);
    assert.equal(result.equipment.particle, null);
    const [removed] = await f.database.select().from(schema.cosmetics).where(eq(schema.cosmetics.id, "particle.cloud"));
    assert.equal(removed.active, false);
    assert.equal((await f.store.read(alpha)).cosmetics.length, 1);
  } finally { f.client.close(); }
});
test("simultaneous changes and refreshes are serialized for the authenticated player", async () => {
  const f = await fixture();
  try {
    await Promise.all([
      f.service.change(session, { category: "particle", cosmeticId: "particle.cloud" }),
      f.service.read(session),
      f.service.change(session, { category: "particle", cosmeticId: null }),
    ]);
    assert.equal((await f.store.read(alpha)).equipment.particle, null);
    assert.equal(f.bridge.changes.length, 2);
  } finally { f.client.close(); }
});
test("bridge authenticates requests and rejects malformed, foreign, redirected and unavailable replies", async () => {
  const config = { url: "http://127.0.0.1:8766", secret: "a".repeat(43) };
  const identity = { discordId, playerUuid: alpha };
  const calls: RequestInit[] = [];
  const bridge = createCosmeticBridge(config, async (_url, init) => {
    calls.push(init!);
    return Response.json(snapshot());
  });
  await bridge.read(identity);
  await bridge.change(identity, { category: "particle", cosmeticId: null });
  assert.equal((calls[0].headers as Record<string, string>).Authorization, "Bearer " + config.secret);
  assert.equal(calls[0].cache, "no-store");
  assert.equal(calls[0].redirect, "error");
  const mutation = JSON.parse(calls[1].body as string);
  assert.match(mutation.requestId, /^[a-f0-9-]{36}$/);
  assert.equal(mutation.playerUuid, alpha);
  for (const response of [
    Response.json(snapshot(bravo)), Response.json({ success: true }),
    Response.json({ ...snapshot(), equipment: { particle: "kill.anvil", intensity: null, kill: null } }),
    Response.json({ error: "UNAUTHORIZED" }, { status: 401 }),
    new Response("redirect", { status: 302 }),
  ]) {
    await assert.rejects(createCosmeticBridge(config, async () => response).read(identity), CosmeticError);
  }
  await assert.rejects(createCosmeticBridge(config, async () => { throw new Error("timeout"); }).read(identity), /UNCONFIRMED/);
  await assert.rejects(createCosmeticBridge({ ...config, url: "http://public.example" }).read(identity), /BRIDGE_UNAVAILABLE/);
  assert.equal(snapshotSchema.safeParse({ ...snapshot(), unlocked: ["particle.missing"] }).success, false);
});
