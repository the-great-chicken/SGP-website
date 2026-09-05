import { z } from "zod";

const discordApiUrl = "https://discord.com/api/v10";

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().min(1),
});

const discordUserSchema = z.object({
  id: z.string().regex(/^\d{17,20}$/),
  username: z.string().min(1),
  global_name: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
});

export type DiscordAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export type DiscordIdentity = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export function getDiscordAuthConfig(): DiscordAuthConfig | null {
  const clientId = process.env.DISCORD_CLIENT_ID?.trim();
  const clientSecret = process.env.DISCORD_CLIENT_SECRET?.trim();
  const redirectUri = process.env.DISCORD_REDIRECT_URI?.trim();

  if (!clientId || !clientSecret || !redirectUri) return null;
  new URL(redirectUri);
  return { clientId, clientSecret, redirectUri };
}

export function buildDiscordAuthorizationUrl(config: DiscordAuthConfig, state: string) {
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("scope", "identify");
  url.searchParams.set("state", state);
  url.searchParams.set("redirect_uri", config.redirectUri);
  return url;
}

export async function authenticateDiscordCode(
  config: DiscordAuthConfig,
  code: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<DiscordIdentity> {
  const tokenResponse = await fetchImplementation(`${discordApiUrl}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri,
    }),
    cache: "no-store",
  });

  if (!tokenResponse.ok) {
    throw new Error(`Discord token exchange failed with status ${tokenResponse.status}`);
  }
  const token = tokenResponseSchema.parse(await tokenResponse.json());

  const userResponse = await fetchImplementation(`${discordApiUrl}/users/@me`, {
    headers: { Authorization: `${token.token_type} ${token.access_token}` },
    cache: "no-store",
  });
  if (!userResponse.ok) {
    throw new Error(`Discord user request failed with status ${userResponse.status}`);
  }
  const user = discordUserSchema.parse(await userResponse.json());

  return {
    id: user.id,
    username: user.username,
    displayName: user.global_name ?? null,
    avatarUrl: discordAvatarUrl(user.id, user.avatar ?? null),
  };
}

export function discordAvatarUrl(discordId: string, avatarHash: string | null) {
  if (!avatarHash) return null;
  const extension = avatarHash.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.${extension}?size=128`;
}
