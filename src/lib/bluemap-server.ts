import "server-only";

import { injectBlueMapShell, renderMapUnavailablePage } from "./bluemap-shell";
import { resolveBlueMapOrigin } from "./bluemap-routing";

export async function serveBlueMapShell(): Promise<Response> {
  try {
    const response = await fetch(resolveBlueMapOrigin(), {
      cache: "no-store",
      headers: { accept: "text/html" },
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) {
      console.error(`BlueMap shell upstream returned ${response.status}`);
      return unavailableResponse();
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("text/html")) {
      console.error(`BlueMap shell upstream returned unexpected content type: ${contentType || "unknown"}`);
      return unavailableResponse();
    }

    return new Response(injectBlueMapShell(await response.text()), {
      status: 200,
      headers: mapHtmlHeaders(),
    });
  } catch (error) {
    console.error("BlueMap shell request failed", error);
    return unavailableResponse();
  }
}

function unavailableResponse(): Response {
  const headers = mapHtmlHeaders();
  headers.set("retry-after", "3");
  return new Response(renderMapUnavailablePage(), {
    status: 503,
    headers,
  });
}

function mapHtmlHeaders(): Headers {
  return new Headers({
    "cache-control": "no-store",
    "content-type": "text/html; charset=utf-8",
    "referrer-policy": "strict-origin-when-cross-origin",
  });
}
