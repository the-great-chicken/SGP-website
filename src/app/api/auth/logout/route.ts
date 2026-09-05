import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  authCookieOptions,
  deleteCurrentSession,
  sessionCookieName,
} from "@/auth/session";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).origin !== request.nextUrl.origin) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  await deleteCurrentSession(request.cookies.get(sessionCookieName())?.value);
  const response = NextResponse.redirect(new URL("/", request.url), { status: 303 });
  response.cookies.set(sessionCookieName(), "", authCookieOptions(0));
  return response;
}
