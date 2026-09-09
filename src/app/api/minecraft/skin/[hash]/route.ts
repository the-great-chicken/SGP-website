const textureHashPattern = /^[0-9a-f]{64}$/i;

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params;
  if (!textureHashPattern.test(hash)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const response = await fetch(`https://textures.minecraft.net/texture/${hash.toLowerCase()}`, {
      next: { revalidate: 31_536_000 },
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) return new Response("Not found", { status: 404 });

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("image/")) {
      return new Response("Invalid texture", { status: 502 });
    }

    return new Response(response.body, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": contentType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Texture service unavailable", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
