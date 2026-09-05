import { getCurrentSession } from "@/auth/session";
import { cosmeticService } from "@/cosmetics/server";
import { cosmeticHandlers } from "@/cosmetics/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const { GET, PUT } = cosmeticHandlers(getCurrentSession, cosmeticService);
