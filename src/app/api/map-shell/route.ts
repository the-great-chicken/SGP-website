import { serveBlueMapShell } from "@/lib/bluemap-server";

// Compatibility endpoint for hosts that still have the previous Caddy rule
// installed. New navigation goes straight to /map and does not depend on it.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return serveBlueMapShell();
}
