import type { NextRequest } from "next/server";
import { getSessionFromRequest } from "@/auth/session";
import { cosmeticService } from "@/cosmetics/server";
import { cosmeticHandlers } from "@/cosmetics/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function handlersFor(request: NextRequest) {
  return cosmeticHandlers(() => getSessionFromRequest(request), cosmeticService);
}

export async function GET(request: NextRequest) {
  return handlersFor(request).GET();
}

export async function PUT(request: NextRequest) {
  return handlersFor(request).PUT(request);
}
