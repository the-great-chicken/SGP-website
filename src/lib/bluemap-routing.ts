export const DEFAULT_BLUEMAP_INTERNAL_URL = "http://127.0.0.1:8100";

export function resolveBlueMapOrigin(configured = process.env.BLUEMAP_INTERNAL_URL): URL {
  const raw = configured?.trim() || DEFAULT_BLUEMAP_INTERNAL_URL;
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("BLUEMAP_INTERNAL_URL must use http or https");
  }
  if (url.username || url.password) {
    throw new Error("BLUEMAP_INTERNAL_URL must not contain credentials");
  }
  // BlueMap's integrated webserver is expected at its web root. Keeping this
  // origin-only also makes the dev rewrite and production shell fetch agree.
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url;
}

export function blueMapDevRewriteDestination(configured = process.env.BLUEMAP_INTERNAL_URL): string {
  return `${resolveBlueMapOrigin(configured).origin}/:path*`;
}

export function blueMapDevelopmentRewrites(configured = process.env.BLUEMAP_INTERNAL_URL) {
  return {
    fallback: [
      {
        source: "/map/:path*",
        destination: blueMapDevRewriteDestination(configured),
      },
    ],
  };
}
