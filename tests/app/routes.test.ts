import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import * as schema from "../../src/db/schema";
import { createTestDatabase } from "../support/database";

const playerUuid = "11111111-1111-4111-8111-111111111111";
const discordId = "111111111111111111";
const bridgeSecret = "s".repeat(43);
const textureHash = "A".repeat(64);

const blueMapIndex = `<!doctype html>
<html lang="en"><head><meta name="theme-color" content="#006ede"><title>BlueMap</title></head>
<body><div id="map-container"></div><div id="app"></div></body></html>`;

type RecordedCall = { url: string; init?: RequestInit };
type BlueMapMode = "ok" | "http-error" | "wrong-type" | "throw";
type SkinMode = "ok" | "not-found" | "wrong-type" | "throw";

function cookieHeader(name: string, value: string) {
  return `${name}=${value}`;
}

function setCookieHeader(response: Response, name: string) {
  return response.headers.getSetCookie().find((value) => value.startsWith(`${name}=`)) ?? "";
}

function requestUrl(input: string | URL | Request) {
  return input instanceof Request ? input.url : input.toString();
}

function requestBody(init?: RequestInit) {
  return typeof init?.body === "string" ? JSON.parse(init.body) as Record<string, unknown> : null;
}

function setEnvironmentVariable(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

test("high-value Next route boundaries preserve auth, proxy, health and cosmetics semantics", async (t) => {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "sgp-app-boundaries-"));
  const databasePath = path.join(temporaryDirectory, "app.sqlite");
  const previousEnvironment = new Map<string, string | undefined>();
  for (const name of [
    "DATABASE_URL",
    "DISCORD_CLIENT_ID",
    "DISCORD_CLIENT_SECRET",
    "DISCORD_REDIRECT_URI",
    "COSMETICS_BRIDGE_URL",
    "COSMETICS_BRIDGE_SECRET",
    "BLUEMAP_INTERNAL_URL",
    "NODE_ENV",
  ]) previousEnvironment.set(name, process.env[name]);

  setEnvironmentVariable("NODE_ENV", "production");
  const databaseUrl = `file:${databasePath}`;
  process.env.DATABASE_URL = databaseUrl;
  process.env.DISCORD_CLIENT_ID = "client-id";
  process.env.DISCORD_CLIENT_SECRET = "client-secret";
  process.env.DISCORD_REDIRECT_URI = "https://sgp.test/api/auth/discord/callback";
  process.env.COSMETICS_BRIDGE_URL = "http://127.0.0.1:8766";
  process.env.COSMETICS_BRIDGE_SECRET = bridgeSecret;
  process.env.BLUEMAP_INTERNAL_URL = "http://127.0.0.1:8100";

  const migratedDatabase = await createTestDatabase(t, { url: databaseUrl });
  const { client: migrationClient, database } = migratedDatabase;
  await database.insert(schema.players).values({
    uuid: playerUuid,
    currentMinecraftName: "Alpha",
    discordId,
  });

  const calls: RecordedCall[] = [];
  let blueMapMode: BlueMapMode = "ok";
  let skinMode: SkinMode = "ok";
  const cosmeticSnapshot = {
    protocolVersion: 2 as const,
    playerUuid,
    observedAt: Date.now(),
    catalogue: [
      { id: "particle.cloud", category: "particle" as const, name: "Nuage", color: "#ffffff", sortOrder: 0 },
      { id: "intensity.light", category: "intensity" as const, name: "Légère", color: "#ffffff", sortOrder: 0 },
    ],
    unlocked: ["particle.cloud", "intensity.light"],
    equipment: { particle: null as string | null, intensity: null as string | null, kill: null as string | null },
    issues: [] as string[],
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = requestUrl(input);
    calls.push({ url, init });

    if (url === "https://discord.com/api/v10/oauth2/token") {
      return Response.json({ access_token: "discord-access-token", token_type: "Bearer" });
    }
    if (url === "https://discord.com/api/v10/users/@me") {
      return Response.json({
        id: discordId,
        username: "alpha_discord",
        global_name: "Alpha Discord",
        avatar: "avatar-hash",
      });
    }
    if (url.startsWith("https://textures.minecraft.net/texture/")) {
      if (skinMode === "throw") throw new Error("texture timeout");
      if (skinMode === "not-found") return new Response("missing", { status: 404 });
      if (skinMode === "wrong-type") return new Response("not an image", { headers: { "Content-Type": "text/plain" } });
      return new Response(new Uint8Array([137, 80, 78, 71]), {
        status: 200,
        headers: { "Content-Type": "image/png" },
      });
    }
    if (url === "http://127.0.0.1:8100/") {
      if (blueMapMode === "throw") throw new Error("BlueMap offline");
      if (blueMapMode === "http-error") return new Response("bad gateway", { status: 502 });
      if (blueMapMode === "wrong-type") return Response.json({ status: "ok" });
      return new Response(blueMapIndex, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    if (url === "http://127.0.0.1:8766/v1/state") {
      return Response.json(cosmeticSnapshot);
    }
    if (url === "http://127.0.0.1:8766/v1/equipment") {
      const body = requestBody(init);
      const category = body?.category;
      if (category === "particle" || category === "intensity" || category === "kill") {
        cosmeticSnapshot.equipment[category] = typeof body?.cosmeticId === "string" ? body.cosmeticId : null;
      }
      cosmeticSnapshot.observedAt += 1;
      return Response.json(cosmeticSnapshot);
    }
    throw new Error(`Unexpected network request in app-boundary test: ${url}`);
  }) as typeof fetch;

  let applicationDatabaseClient: { close(): void } | undefined;
  try {
    const { NextRequest } = await import("next/server");
    const session = await import("../../src/auth/session");
    applicationDatabaseClient = (await import("../../src/db/client")).databaseClient;
    const authStartRoute = await import("../../src/app/api/auth/discord/route");
    const authCallbackRoute = await import("../../src/app/api/auth/discord/callback/route");
    const logoutRoute = await import("../../src/app/api/auth/logout/route");
    const skinRoute = await import("../../src/app/api/minecraft/skin/[hash]/route");
    const mapRoute = await import("../../src/app/map/route");
    const healthRoute = await import("../../src/app/api/health/route");
    const cosmeticsRoute = await import("../../src/app/api/me/cosmetics/route");

    const oauthCookieName = session.oauthStateCookieName();
    const sessionCookieName = session.sessionCookieName();
    assert.equal(oauthCookieName, "__Host-sgp_oauth_state");
    assert.equal(sessionCookieName, "__Host-sgp_session");

    const beginOAuth = async () => {
      const response = await authStartRoute.GET(new Request("https://sgp.test/api/auth/discord"));
      const state = new URL(response.headers.get("location")!).searchParams.get("state") ?? "";
      assert.match(state, /^[A-Za-z0-9_-]{43}$/);
      return { response, state };
    };

    const createAuthenticatedSessionToken = async () => {
      await database.delete(schema.authSessions);
      const { state } = await beginOAuth();
      const request = new NextRequest(
        `https://sgp.test/api/auth/discord/callback?code=authorization-code&state=${encodeURIComponent(state)}`,
        { headers: { cookie: cookieHeader(oauthCookieName, state) } },
      );
      const response = await authCallbackRoute.GET(request);
      assert.equal(response.status, 307);
      const token = response.cookies.get(sessionCookieName)?.value ?? "";
      assert.match(token, /^[A-Za-z0-9_-]{43}$/);
      return token;
    };

    await t.test("OAuth start creates a short-lived HttpOnly state cookie matching the Discord redirect", async () => {
      const { response, state: oauthState } = await beginOAuth();
      assert.equal(response.status, 307);
      const location = new URL(response.headers.get("location")!);
      assert.equal(location.origin, "https://discord.com");
      assert.equal(location.pathname, "/oauth2/authorize");
      assert.equal(location.searchParams.get("client_id"), "client-id");
      assert.equal(location.searchParams.get("scope"), "identify");
      assert.equal(location.searchParams.get("redirect_uri"), process.env.DISCORD_REDIRECT_URI);

      assert.equal(location.searchParams.get("state"), oauthState);
      assert.equal(response.cookies.get(oauthCookieName)?.value, oauthState);
      const stateCookie = setCookieHeader(response, oauthCookieName);
      assert.match(stateCookie, /HttpOnly/i);
      assert.match(stateCookie, /Secure/i);
      assert.match(stateCookie, /SameSite=Lax/i);
      assert.match(stateCookie, /Path=\//i);
      assert.match(stateCookie, /Max-Age=600/i);
    });

    await t.test("OAuth callback rejects a mismatched state before contacting Discord and clears the state cookie", async () => {
      await database.delete(schema.authSessions);
      const { state: oauthState } = await beginOAuth();
      const discordCallsBefore = calls.filter((call) => call.url.startsWith("https://discord.com/")).length;
      const request = new NextRequest(
        "https://sgp.test/api/auth/discord/callback?code=authorization-code&state=attacker-state",
        { headers: { cookie: cookieHeader(oauthCookieName, oauthState) } },
      );
      const response = await authCallbackRoute.GET(request);
      assert.equal(response.status, 307);
      const location = new URL(response.headers.get("location")!);
      assert.equal(location.pathname, "/login");
      assert.equal(location.searchParams.get("error"), "invalid_state");
      assert.equal(response.cookies.get(oauthCookieName)?.value, "");
      assert.match(setCookieHeader(response, oauthCookieName), /Max-Age=0/i);
      assert.equal(calls.filter((call) => call.url.startsWith("https://discord.com/")).length, discordCallsBefore);
      assert.equal((await database.select().from(schema.authSessions)).length, 0);
    });

    await t.test("OAuth callback exchanges the code, persists only a token hash, clears state and sets the session cookie", async () => {
      await database.delete(schema.authSessions);
      const { state: oauthState } = await beginOAuth();
      const request = new NextRequest(
        `https://sgp.test/api/auth/discord/callback?code=authorization-code&state=${encodeURIComponent(oauthState)}`,
        { headers: { cookie: cookieHeader(oauthCookieName, oauthState) } },
      );
      const response = await authCallbackRoute.GET(request);
      assert.equal(response.status, 307);
      assert.equal(new URL(response.headers.get("location")!).href, "https://sgp.test/me");
      assert.equal(response.cookies.get(oauthCookieName)?.value, "");

      const sessionToken = response.cookies.get(sessionCookieName)?.value ?? "";
      assert.match(sessionToken, /^[A-Za-z0-9_-]{43}$/);
      const sessionCookie = setCookieHeader(response, sessionCookieName);
      assert.match(sessionCookie, /HttpOnly/i);
      assert.match(sessionCookie, /Secure/i);
      assert.match(sessionCookie, /SameSite=Lax/i);
      assert.match(sessionCookie, /Path=\//i);
      assert.match(sessionCookie, /Max-Age=2592000/i);

      const rows = await database.select().from(schema.authSessions);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].discordId, discordId);
      assert.equal(rows[0].tokenHash, session.hashSessionToken(sessionToken));
      assert.notEqual(rows[0].tokenHash, sessionToken);

      const tokenCall = calls.find((call) => call.url.endsWith("/oauth2/token"));
      const tokenBody = String(tokenCall?.init?.body ?? "");
      assert.match(tokenBody, /grant_type=authorization_code/);
      assert.match(tokenBody, /code=authorization-code/);
    });

    await t.test("Minecraft skin route validates hashes, preserves image safety headers, and maps upstream failures", async () => {
      const callsBeforeInvalid = calls.length;
      const invalid = await skinRoute.GET(
        new Request("https://sgp.test/api/minecraft/skin/not-a-hash"),
        { params: Promise.resolve({ hash: "not-a-hash" }) },
      );
      assert.equal(invalid.status, 404);
      assert.equal(calls.length, callsBeforeInvalid);

      skinMode = "ok";
      const ok = await skinRoute.GET(
        new Request(`https://sgp.test/api/minecraft/skin/${textureHash}`),
        { params: Promise.resolve({ hash: textureHash }) },
      );
      assert.equal(ok.status, 200);
      assert.equal(ok.headers.get("content-type"), "image/png");
      assert.equal(ok.headers.get("x-content-type-options"), "nosniff");
      assert.match(ok.headers.get("cache-control") ?? "", /immutable/);
      assert.deepEqual([...new Uint8Array(await ok.arrayBuffer())], [137, 80, 78, 71]);
      assert.equal(calls.at(-1)?.url, `https://textures.minecraft.net/texture/${textureHash.toLowerCase()}`);

      skinMode = "not-found";
      const missing = await skinRoute.GET(new Request("https://sgp.test/"), { params: Promise.resolve({ hash: textureHash }) });
      assert.equal(missing.status, 404);

      skinMode = "wrong-type";
      const invalidType = await skinRoute.GET(new Request("https://sgp.test/"), { params: Promise.resolve({ hash: textureHash }) });
      assert.equal(invalidType.status, 502);

      skinMode = "throw";
      const unavailable = await skinRoute.GET(new Request("https://sgp.test/"), { params: Promise.resolve({ hash: textureHash }) });
      assert.equal(unavailable.status, 503);
      assert.equal(unavailable.headers.get("cache-control"), "no-store");
      skinMode = "ok";
    });

    await t.test("BlueMap route injects the SGP shell on valid HTML and returns the navigable 503 shell on upstream failure", async (st) => {
      blueMapMode = "ok";
      const ok = await mapRoute.GET();
      assert.equal(ok.status, 200);
      assert.equal(ok.headers.get("cache-control"), "no-store");
      assert.match(ok.headers.get("content-type") ?? "", /^text\/html/);
      const html = await ok.text();
      assert.match(html, /<base href="\/map\/">/);
      assert.match(html, /data-sgp-map-header="true"/);
      const mapCall = calls.findLast((call) => call.url === "http://127.0.0.1:8100/");
      assert.equal((mapCall?.init?.headers as Record<string, string> | undefined)?.accept, "text/html");
      assert.equal(mapCall?.init?.cache, "no-store");

      st.mock.method(console, "error", () => undefined);
      blueMapMode = "wrong-type";
      assert.equal((await mapRoute.GET()).status, 503);

      blueMapMode = "http-error";
      const unavailable = await mapRoute.GET();
      assert.equal(unavailable.status, 503);
      assert.equal(unavailable.headers.get("retry-after"), "3");
      assert.equal(unavailable.headers.get("cache-control"), "no-store");
      assert.match(await unavailable.text(), /La carte ne répond pas\./);
      blueMapMode = "ok";
    });

    await t.test("/api/me/cosmetics uses the request session at the real route boundary and reaches the authenticated bridge", async () => {
      const sessionToken = await createAuthenticatedSessionToken();
      const bridgeCallsBeforeAnonymous = calls.filter((call) => call.url.startsWith("http://127.0.0.1:8766/")).length;
      const anonymous = await cosmeticsRoute.GET(new NextRequest("https://sgp.test/api/me/cosmetics"));
      assert.equal(anonymous.status, 401);
      assert.equal(calls.filter((call) => call.url.startsWith("http://127.0.0.1:8766/")).length, bridgeCallsBeforeAnonymous);

      const cookie = cookieHeader(sessionCookieName, sessionToken);
      const read = await cosmeticsRoute.GET(new NextRequest("https://sgp.test/api/me/cosmetics", {
        headers: { cookie },
      }));
      assert.equal(read.status, 200);
      assert.equal(read.headers.get("cache-control"), "private, no-store");
      const readBody = await read.json() as { view: { status: string; equipment: { particle: unknown } } };
      assert.equal(readBody.view.status, "live");
      assert.equal(readBody.view.equipment.particle, null);

      const stateCall = calls.findLast((call) => call.url.endsWith("/v1/state"));
      assert.equal((stateCall?.init?.headers as Record<string, string> | undefined)?.Authorization, `Bearer ${bridgeSecret}`);
      assert.deepEqual(requestBody(stateCall?.init), { discordId, playerUuid });

      const mutation = await cosmeticsRoute.PUT(new NextRequest("https://sgp.test/api/me/cosmetics", {
        method: "PUT",
        headers: {
          cookie,
          origin: "https://sgp.test",
          "content-type": "application/json",
        },
        body: JSON.stringify({ category: "particle", cosmeticId: "particle.cloud" }),
      }));
      assert.equal(mutation.status, 200);
      const mutationBody = await mutation.json() as {
        confirmed: boolean;
        view: { equipment: { particle: { id: string } | null } };
      };
      assert.equal(mutationBody.confirmed, true);
      assert.equal(mutationBody.view.equipment.particle?.id, "particle.cloud");

      const equipmentCall = calls.findLast((call) => call.url.endsWith("/v1/equipment"));
      const equipmentBody = requestBody(equipmentCall?.init);
      assert.equal(equipmentCall?.init?.method, "PUT");
      assert.equal(equipmentBody?.discordId, discordId);
      assert.equal(equipmentBody?.playerUuid, playerUuid);
      assert.equal(equipmentBody?.category, "particle");
      assert.equal(equipmentBody?.cosmeticId, "particle.cloud");
      assert.match(String(equipmentBody?.requestId), /^[a-f0-9-]{36}$/);
    });

    await t.test("logout rejects cross-origin and opaque-origin mutations, then deletes the session and expires the cookie", async () => {
      const sessionToken = await createAuthenticatedSessionToken();
      const cookie = cookieHeader(sessionCookieName, sessionToken);
      const forbidden = await logoutRoute.POST(new NextRequest("https://sgp.test/api/auth/logout", {
        method: "POST",
        headers: { cookie, origin: "https://attacker.test" },
      }));
      assert.equal(forbidden.status, 403);

      const malformedOrigin = await logoutRoute.POST(new NextRequest("https://sgp.test/api/auth/logout", {
        method: "POST",
        headers: { cookie, origin: "null" },
      }));
      assert.equal(malformedOrigin.status, 403);
      assert.equal((await database.select().from(schema.authSessions)).length, 1);

      const response = await logoutRoute.POST(new NextRequest("https://sgp.test/api/auth/logout", {
        method: "POST",
        headers: { cookie, origin: "https://sgp.test" },
      }));
      assert.equal(response.status, 303);
      assert.equal(new URL(response.headers.get("location")!).href, "https://sgp.test/");
      assert.equal(response.cookies.get(sessionCookieName)?.value, "");
      const clearedSessionCookie = setCookieHeader(response, sessionCookieName);
      assert.match(clearedSessionCookie, /HttpOnly/i);
      assert.match(clearedSessionCookie, /Secure/i);
      assert.match(clearedSessionCookie, /SameSite=Lax/i);
      assert.match(clearedSessionCookie, /Path=\//i);
      assert.match(clearedSessionCookie, /Max-Age=0/i);
      assert.equal((await database.select().from(schema.authSessions)).length, 0);
    });

    await t.test("health route is uncached and reports both migrated-database success and database-check failure", async () => {
      const healthy = await healthRoute.GET();
      assert.equal(healthy.status, 200);
      assert.equal(healthy.headers.get("cache-control"), "no-store");
      assert.deepEqual(await healthy.json(), { status: "ok" });

      await migrationClient.execute("DROP TABLE __drizzle_migrations");
      const unhealthy = await healthRoute.GET();
      assert.equal(unhealthy.status, 503);
      assert.equal(unhealthy.headers.get("cache-control"), "no-store");
      assert.deepEqual(await unhealthy.json(), { status: "unavailable" });
    });
  } finally {
    globalThis.fetch = originalFetch;
    applicationDatabaseClient?.close();
    migratedDatabase.close();
    for (const [name, value] of previousEnvironment) {
      setEnvironmentVariable(name, value);
    }
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});
