import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { eq } from "drizzle-orm";
import {
  authenticateDiscordCode,
  buildDiscordAuthorizationUrl,
  discordAvatarUrl,
  getDiscordAuthConfig,
  type DiscordAuthConfig,
} from "../src/auth/discord";
import {
  queryAuthSession,
  removeAuthSession,
  storeAuthSession,
} from "../src/auth/session-query";
import {
  parseDiscordSrvAccountsAof,
  parseMinecraftUsercache,
  syncDiscordSrvLinks,
} from "../src/db/discordsrv";
import * as schema from "../src/db/schema";
import { createTestDatabase } from "./support/database";

const alpha = "11111111-1111-4111-8111-111111111111";
const bravo = "22222222-2222-4222-8222-222222222222";
const charlie = "33333333-3333-4333-8333-333333333333";
const discordAlpha = "111111111111111111";
const discordBravo = "222222222222222222";
const discordCharlie = "333333333333333333";

test("Discord OAuth requests only identity and converts the returned user", async () => {
  const config: DiscordAuthConfig = {
    clientId: "client-id",
    clientSecret: "client-secret",
    redirectUri: "http://localhost:3000/api/auth/discord/callback",
  };
  const authorizationUrl = buildDiscordAuthorizationUrl(config, "state-token");
  assert.equal(authorizationUrl.origin, "https://discord.com");
  assert.equal(authorizationUrl.searchParams.get("scope"), "identify");
  assert.equal(authorizationUrl.searchParams.get("state"), "state-token");

  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const fakeFetch = async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: input.toString(), init });
    if (requests.length === 1) {
      return Response.json({ access_token: "short-lived-token", token_type: "Bearer" });
    }
    return Response.json({
      id: discordAlpha,
      username: "alpha_discord",
      global_name: "Alpha Discord",
      avatar: "avatar-hash",
    });
  };

  const identity = await authenticateDiscordCode(config, "authorization-code", fakeFetch);
  assert.deepEqual(identity, {
    id: discordAlpha,
    username: "alpha_discord",
    displayName: "Alpha Discord",
    avatarUrl: discordAvatarUrl(discordAlpha, "avatar-hash"),
  });
  assert.match(String(requests[0].init?.body), /grant_type=authorization_code/);
  assert.equal(requests[1].init?.headers && (requests[1].init.headers as Record<string, string>).Authorization, "Bearer short-lived-token");
});

test("Discord OAuth rejects upstream failures and malformed identities", async () => {
  const config: DiscordAuthConfig = {
    clientId: "client-id",
    clientSecret: "client-secret",
    redirectUri: "https://sgp.test/api/auth/discord/callback",
  };

  await assert.rejects(
    authenticateDiscordCode(config, "authorization-code", async () => new Response("nope", { status: 503 })),
    /token exchange failed with status 503/,
  );

  let requestNumber = 0;
  await assert.rejects(
    authenticateDiscordCode(config, "authorization-code", async () => {
      requestNumber += 1;
      return requestNumber === 1
        ? Response.json({ access_token: "token", token_type: "Bearer" })
        : new Response("nope", { status: 502 });
    }),
    /user request failed with status 502/,
  );

  requestNumber = 0;
  await assert.rejects(
    authenticateDiscordCode(config, "authorization-code", async () => {
      requestNumber += 1;
      return requestNumber === 1
        ? Response.json({ access_token: "token", token_type: "Bearer" })
        : Response.json({ id: "not-a-discord-id", username: "alpha" });
    }),
    (error) => error instanceof Error && error.name === "ZodError",
  );

  assert.equal(discordAvatarUrl(discordAlpha, null), null);
  assert.match(discordAvatarUrl(discordAlpha, "a_animated") ?? "", /\.gif\?size=128$/);
});

test("Discord auth configuration rejects partial or malformed environment values", () => {
  const names = ["DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET", "DISCORD_REDIRECT_URI"] as const;
  const previous = new Map(names.map((name) => [name, process.env[name]] as const));
  try {
    delete process.env.DISCORD_CLIENT_ID;
    process.env.DISCORD_CLIENT_SECRET = "secret";
    process.env.DISCORD_REDIRECT_URI = "https://sgp.test/callback";
    assert.equal(getDiscordAuthConfig(), null);

    process.env.DISCORD_CLIENT_ID = " client ";
    process.env.DISCORD_CLIENT_SECRET = " secret ";
    process.env.DISCORD_REDIRECT_URI = " https://sgp.test/callback ";
    assert.deepEqual(getDiscordAuthConfig(), {
      clientId: "client",
      clientSecret: "secret",
      redirectUri: "https://sgp.test/callback",
    });

    process.env.DISCORD_REDIRECT_URI = "not a URL";
    assert.throws(() => getDiscordAuthConfig(), /Invalid URL/);
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("DiscordSRV AOF replay produces the current one-to-one links", () => {
  const links = parseDiscordSrvAccountsAof([
    `${discordAlpha} ${alpha}`,
    `${discordBravo} ${bravo}`,
    `-${discordAlpha} ${alpha}`,
    `${discordCharlie} ${alpha}`,
    `-${bravo}`,
    "",
  ].join("\n"));

  assert.deepEqual(links, [{ discordId: discordCharlie, playerUuid: alpha }]);
  assert.throws(
    () => parseDiscordSrvAccountsAof("not a DiscordSRV entry"),
    /line 1/,
  );
});

test("Minecraft usercache provides current UUID/name identities", () => {
  const minecraftPlayers = parseMinecraftUsercache(JSON.stringify([
    { name: "Alpha", uuid: alpha, expiresOn: "2026-10-01 00:00:00 +0000" },
    { name: "BravoPrime", uuid: bravo, expiresOn: "2026-10-01 00:00:00 +0000" },
  ]));

  assert.deepEqual(minecraftPlayers, [
    { playerUuid: alpha, minecraftName: "Alpha" },
    { playerUuid: bravo, minecraftName: "BravoPrime" },
  ]);
  assert.throws(() => parseMinecraftUsercache("{}"), /expected a JSON array/);
  assert.throws(() => parseMinecraftUsercache("not-json"), /expected valid JSON/);
});

test("DiscordSRV sync atomically imports Minecraft identities, applies links and clears stale identities", async (t) => {
  const fixture = await createFixture(t);
  try {
    await fixture.database.insert(schema.players).values([
      {
        uuid: alpha,
        currentMinecraftName: "Alpha",
        discordId: discordAlpha,
        discordUsername: "alpha_old",
      },
      {
        uuid: bravo,
        currentMinecraftName: "Bravo",
        discordId: discordBravo,
        discordUsername: "bravo_old",
      },
      { uuid: charlie, currentMinecraftName: "Charlie" },
    ]);

    const delta = "44444444-4444-4444-8444-444444444444";
    const echo = "55555555-5555-4555-8555-555555555555";
    const result = await syncDiscordSrvLinks(
      fixture.database,
      [
        { discordId: discordAlpha, playerUuid: alpha },
        { discordId: discordCharlie, playerUuid: charlie },
        { discordId: "444444444444444444", playerUuid: delta },
        { discordId: "555555555555555555", playerUuid: echo },
      ],
      [
        { playerUuid: alpha, minecraftName: "AlphaPrime" },
        { playerUuid: delta, minecraftName: "Delta" },
      ],
    );
    assert.deepEqual(result, {
      linksInSource: 4,
      linkedPlayers: 3,
      changedPlayers: 2,
      clearedPlayers: 1,
      discoveredPlayers: 1,
      unknownPlayers: 1,
    });

    const rows = await fixture.database
      .select({
        uuid: schema.players.uuid,
        discordId: schema.players.discordId,
        discordUsername: schema.players.discordUsername,
        minecraftName: schema.players.currentMinecraftName,
      })
      .from(schema.players);
    assert.deepEqual(rows, [
      { uuid: alpha, discordId: discordAlpha, discordUsername: "alpha_old", minecraftName: "AlphaPrime" },
      { uuid: bravo, discordId: null, discordUsername: null, minecraftName: "Bravo" },
      { uuid: charlie, discordId: discordCharlie, discordUsername: null, minecraftName: "Charlie" },
      { uuid: delta, discordId: "444444444444444444", discordUsername: null, minecraftName: "Delta" },
    ]);
  } finally {
    fixture.close();
  }
});

test("opaque sessions resolve the current DiscordSRV Minecraft link", async (t) => {
  const fixture = await createFixture(t);
  try {
    const now = new Date("2026-09-05T12:00:00Z");
    const expiresAt = new Date("2026-10-05T12:00:00Z");
    const discord = {
      id: discordAlpha,
      username: "alpha_discord",
      displayName: "Alpha Discord",
      avatarUrl: discordAvatarUrl(discordAlpha, "avatar-hash"),
    };

    await storeAuthSession(fixture.database, "hashed-token", discord, expiresAt, now);
    assert.equal((await queryAuthSession(fixture.database, "hashed-token", now))?.player, null);
    await syncDiscordSrvLinks(
      fixture.database,
      [{ discordId: discordAlpha, playerUuid: alpha }],
      [{ playerUuid: alpha, minecraftName: "Alpha" }],
    );
    assert.deepEqual(await queryAuthSession(fixture.database, "hashed-token", now), {
      discord,
      player: { uuid: alpha, minecraftName: "Alpha" },
      expiresAt,
    });
    assert.equal(await queryAuthSession(fixture.database, "hashed-token", expiresAt), null);

    await storeAuthSession(fixture.database, "second-hashed-token", discord, expiresAt, now);
    const [player] = await fixture.database
      .select({ username: schema.players.discordUsername })
      .from(schema.players)
      .where(eq(schema.players.uuid, alpha));
    assert.equal(player.username, "alpha_discord");

    await removeAuthSession(fixture.database, "hashed-token");
    await removeAuthSession(fixture.database, "second-hashed-token");
    assert.equal(await queryAuthSession(fixture.database, "hashed-token", now), null);
  } finally {
    fixture.close();
  }
});

test("storing a session prunes expired authentication sessions", async (t) => {
  const fixture = await createFixture(t);
  try {
    const now = new Date("2026-09-05T12:00:00Z");
    await fixture.database.insert(schema.authSessions).values({
      tokenHash: "expired-token",
      discordId: discordAlpha,
      discordUsername: "expired",
      expiresAt: new Date("2026-09-05T11:59:59Z"),
    });
    await storeAuthSession(
      fixture.database,
      "fresh-token",
      { id: discordBravo, username: "fresh", displayName: null, avatarUrl: null },
      new Date("2026-10-05T12:00:00Z"),
      now,
    );
    const rows = await fixture.database
      .select({ tokenHash: schema.authSessions.tokenHash })
      .from(schema.authSessions);
    assert.deepEqual(rows, [{ tokenHash: "fresh-token" }]);
  } finally {
    fixture.close();
  }
});

async function createFixture(t: TestContext) {
  return createTestDatabase(t);
}
