import { serveBlueMapShell } from "@/lib/bluemap-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return serveBlueMapShell();
}
