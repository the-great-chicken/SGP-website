import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authenticateDiscordCode, getDiscordAuthConfig } from "@/auth/discord";
import {
  authCookieOptions,
  createSession,
  oauthStateCookieName,
  sessionCookieLifetime,
  sessionCookieName,
  stateMatches,
} from "@/auth/session";

export async function GET(request: NextRequest) {
  const config = getDiscordAuthConfig();
  if (!config) return loginError(request, "not_configured");

  const oauthError = request.nextUrl.searchParams.get("error");
  if (oauthError) return loginError(request, "denied", config.redirectUri);

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(oauthStateCookieName())?.value;
  if (!code || !stateMatches(state, expectedState)) {
    return loginError(request, "invalid_state", config.redirectUri);
  }

  try {
    const discord = await authenticateDiscordCode(config, code);
    const session = await createSession(discord);
    const response = NextResponse.redirect(new URL("/me", config.redirectUri));
    clearOauthState(response);
    response.cookies.set(
      sessionCookieName(),
      session.token,
      authCookieOptions(sessionCookieLifetime),
    );
    return response;
  } catch (error) {
    console.error("Discord OAuth callback failed", error);
    return loginError(request, "oauth_failed", config.redirectUri);
  }
}

function loginError(request: NextRequest, error: string, baseUrl = request.url) {
  const response = NextResponse.redirect(new URL(`/login?error=${error}`, baseUrl));
  clearOauthState(response);
  return response;
}

function clearOauthState(response: NextResponse) {
  response.cookies.set(oauthStateCookieName(), "", authCookieOptions(0));
}
