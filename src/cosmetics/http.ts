import type { AuthSession } from "@/auth/session-query";
import { readBoundedText } from "./bridge";
import { CosmeticError, errorMessage } from "./model";
import { requireCosmeticIdentity, type createCosmeticService } from "./service";

export function cosmeticHandlers(
  getSession: () => Promise<AuthSession | null>,
  service: ReturnType<typeof createCosmeticService>,
) {
  const json = (body: unknown, status = 200) => Response.json(body, {
    status, headers: { "Cache-Control": "private, no-store" },
  });
  const failure = (error: unknown) => {
    const e = error instanceof CosmeticError ? error : new CosmeticError("UNCONFIRMED");
    return json({ error: e.code, message: errorMessage(e.code) }, e.status);
  };
  return {
    async GET() {
      try { return json({ view: await service.read(await getSession()) }); }
      catch (error) { return failure(error); }
    },
    async PUT(request: Request) {
      try {
        const session = await getSession();
        requireCosmeticIdentity(session);
        // Browser mutations are same-origin JSON requests, never cross-site forms.
        const origin = request.headers.get("origin");
        let source: URL;
        try { source = new URL(origin ?? ""); }
        catch { throw new CosmeticError("FORBIDDEN", 403); }
        // Next may see an internal HTTP URL behind a TLS proxy. Host remains the browser's
        // public authority; proxies must preserve it. Do not trust arbitrary forwarded-host headers.
        const host = request.headers.get("host") ?? new URL(request.url).host;
        if (source.origin !== origin || !["http:", "https:"].includes(source.protocol) || source.host !== host) {
          throw new CosmeticError("FORBIDDEN", 403);
        }
        if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
          throw new CosmeticError("INVALID_REQUEST", 415);
        }
        let body: unknown;
        try { body = JSON.parse(await readBoundedText(request, 4096)); }
        catch (error) {
          if (error instanceof CosmeticError) throw error;
          throw new CosmeticError("INVALID_REQUEST", 400);
        }
        const result = await service.change(session, body);
        return json(result, result.confirmed ? 200 : 409);
      } catch (error) { return failure(error); }
    },
  };
}
