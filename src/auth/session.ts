import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/db/client";
import type { DiscordIdentity } from "./discord";
import { queryAuthSession, removeAuthSession, storeAuthSession } from "./session-query";

const sessionLifetimeSeconds = 60 * 60 * 24 * 30;
const oauthStateLifetimeSeconds = 60 * 10;

export function sessionCookieName() {
  return process.env.NODE_ENV === "production" ? "__Host-sgp_session" : "sgp_session";
}

export function oauthStateCookieName() {
  return process.env.NODE_ENV === "production" ? "__Host-sgp_oauth_state" : "sgp_oauth_state";
}

export function authCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export function createOpaqueToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function stateMatches(received: string | null, expected: string | undefined) {
  if (!received || !expected) return false;
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}

export async function createSession(discord: DiscordIdentity) {
  const token = createOpaqueToken();
  const expiresAt = new Date(Date.now() + sessionLifetimeSeconds * 1_000);
  await storeAuthSession(db, hashSessionToken(token), discord, expiresAt);
  return { token, expiresAt };
}

export async function getCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName())?.value;
  return token ? queryAuthSession(db, hashSessionToken(token)) : null;
}

export async function deleteCurrentSession(token: string | undefined) {
  if (token) await removeAuthSession(db, hashSessionToken(token));
}

export const sessionCookieLifetime = sessionLifetimeSeconds;
export const oauthStateCookieLifetime = oauthStateLifetimeSeconds;
