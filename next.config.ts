import type { NextConfig } from "next";
import { blueMapDevelopmentRewrites } from "./src/lib/bluemap-routing";

const nextConfig: NextConfig = {
  agentRules: false,
  output: "standalone",
  turbopack: {
    root: process.cwd(),
  },
  // In normal local development Next is the only public HTTP server. This
  // fallback proxies BlueMap's native assets/data after the real /map route
  // has had a chance to serve the SGP first-paint shell. Production Caddy
  // still sends /map/* straight to BlueMap to keep tiles/SSE off Node.
  async rewrites() {
    if (process.env.NODE_ENV !== "development") return [];
    return blueMapDevelopmentRewrites();
  },
  // BlueMap 5.23 keeps an EventSource open for live updates. Next's external
  // rewrite proxy otherwise closes an idle upstream socket after 30 seconds in
  // development. This setting affects only Next's proxy layer; production map
  // traffic is handled directly by Caddy.
  experimental: {
    proxyTimeout: 10 * 60 * 1000,
  },
};

export default nextConfig;
