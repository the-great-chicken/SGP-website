import { databaseClient } from "@/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await databaseClient.execute("SELECT count(*) FROM __drizzle_migrations");
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
