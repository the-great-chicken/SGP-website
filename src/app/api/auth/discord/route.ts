import { NextResponse } from "next/server";
import { buildDiscordAuthorizationUrl, getDiscordAuthConfig } from "@/auth/discord";
import {
  authCookieOptions,
  createOpaqueToken,
  oauthStateCookieLifetime,
  oauthStateCookieName,
} from "@/auth/session";

export async function GET(request: Request) {
  const config = getDiscordAuthConfig();
  if (!config) {
    return NextResponse.redirect(new URL("/login?error=not_configured", request.url));
  }

  const state = createOpaqueToken();
  const response = NextResponse.redirect(buildDiscordAuthorizationUrl(config, state));
  response.cookies.set(
    oauthStateCookieName(),
    state,
    authCookieOptions(oauthStateCookieLifetime),
  );
  return response;
}
