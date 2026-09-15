import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import path from "node:path";
import { getMapArchivePublicRoot } from "@/map-archive/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MIME: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".gz": "application/gzip",
};

function safeTarget(parts: string[]) {
  if (!parts.length || parts.some((part) => !part || part === "." || part === ".." || part.includes("/") || part.includes("\\") || part.includes("\0"))) return null;
  const root = getMapArchivePublicRoot();
  const target = path.resolve(root, ...parts);
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return null;
  return { target };
}

async function serve(context: { params: Promise<{ path: string[] }> }, body: boolean) {
  const parts = (await context.params).path;
  const resolved = safeTarget(parts);
  if (!resolved) return new Response("Not found", { status: 404 });
  let info;
  try {
    info = await stat(resolved.target);
  } catch (error) {
    if (["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) {
      // Missing BlueMap tiles are expected near render-mask edges.
      return new Response(null, { status: parts.at(-1)?.includes(".") ? 204 : 404 });
    }
    throw error;
  }
  if (!info.isFile()) return new Response("Not found", { status: 404 });

  const immutable = parts[0] === "editions" && parts.length >= 4;
  const headers = new Headers({
    "Content-Type": MIME[path.extname(resolved.target).toLowerCase()] ?? "application/octet-stream",
    "Content-Length": String(info.size),
    "Cache-Control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
    "X-Content-Type-Options": "nosniff",
  });
  if (!body) return new Response(null, { status: 200, headers });
  return new Response(Readable.toWeb(createReadStream(resolved.target)) as ReadableStream, { status: 200, headers });
}

export function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  return serve(context, true);
}

export function HEAD(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  return serve(context, false);
}
