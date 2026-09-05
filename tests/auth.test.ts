import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import {
  authenticateDiscordCode,
  buildDiscordAuthorizationUrl,
  discordAvatarUrl,
  type DiscordAuthConfig,
} from "../src/auth/discord";
import {
  queryAuthSession,
  removeAuthSession,
  storeAuthSession,
} from "../src/auth/session-query";
import { parseDiscordSrvAccountsAof, syncDiscordSrvLinks } from "../src/db/discordsrv";
import * as schema from "../src/db/schema";

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

test("DiscordSRV sync atomically applies links and clears stale identities", async () => {
  const fixture = await createFixture();
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

    const result = await syncDiscordSrvLinks(fixture.database, [
      { discordId: discordAlpha, playerUuid: alpha },
      { discordId: discordCharlie, playerUuid: charlie },
      { discordId: "444444444444444444", playerUuid: "44444444-4444-4444-8444-444444444444" },
    ]);
    assert.deepEqual(result, {
      linksInSource: 3,
      linkedPlayers: 2,
      changedPlayers: 1,
      clearedPlayers: 1,
      unknownPlayers: 1,
    });

    const rows = await fixture.database
      .select({
        uuid: schema.players.uuid,
        discordId: schema.players.discordId,
        discordUsername: schema.players.discordUsername,
      })
      .from(schema.players);
    assert.deepEqual(rows, [
      { uuid: alpha, discordId: discordAlpha, discordUsername: "alpha_old" },
      { uuid: bravo, discordId: null, discordUsername: null },
      { uuid: charlie, discordId: discordCharlie, discordUsername: null },
    ]);
  } finally {
    fixture.client.close();
  }
});

test("opaque sessions resolve the current DiscordSRV Minecraft link", async () => {
  const fixture = await createFixture();
  try {
    await fixture.database.insert(schema.players).values({
      uuid: alpha,
      currentMinecraftName: "Alpha",
    });
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
    await syncDiscordSrvLinks(fixture.database, [{ discordId: discordAlpha, playerUuid: alpha }]);
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
    fixture.client.close();
  }
});

async function createFixture() {
  const client = createClient({ url: "file::memory:" });
  const database = drizzle(client, { schema });
  await migrate(database, { migrationsFolder: resolve("drizzle") });
  return { client, database };
}
