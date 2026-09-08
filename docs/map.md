# Map integration

The public map is BlueMap itself, not an iframe, but the **HTML document at `/map` is owned by the Next application**. This is deliberate: the SGP header and Slate background must exist in the first response in both normal local development and production, instead of depending on a reverse proxy to rewrite BlueMap after deployment.

## Request flow

### Local development

`npm run dev` is enough as long as BlueMap's integrated webserver is running (default `127.0.0.1:8100`):

```text
GET /map
  -> Next route handler
  -> fetch BlueMap /
  -> inject SGP first-paint shell

GET /map/assets/...
GET /map/settings.json
GET /map/maps/.../live/sse
  -> Next development fallback rewrite
  -> BlueMap
```

Next applies fallback rewrites after filesystem routes, so the real `/map` route is resolved before `/map/:path*` can be proxied. Next's external rewrite implementation is a streaming HTTP proxy, which preserves BlueMap's binary assets and SSE instead of reading them through a Route Handler. A longer development proxy timeout is configured because BlueMap 5.23 keeps its EventSource open for live updates.

### Production

Caddy keeps the same public contract while avoiding unnecessary Node overhead for tiles and live traffic:

```text
GET /map        -> Next -> transformed BlueMap index
GET /map/*      -> Caddy -> BlueMap directly (prefix stripped)
GET everything else -> Next
```

`/map/` is retained as a compatibility redirect to canonical `/map`. The legacy `/api/map-shell` endpoint remains temporarily as a compatibility endpoint for an older installed Caddyfile, but new configuration does not depend on it.

## Why this architecture

Two designs were evaluated for local/production parity:

1. **Next owns `/map`, with BlueMap resources proxied separately.** This keeps the first-paint behavior in application code, works under the ordinary `npm run dev` workflow, leaves BlueMap's generated webapp untouched, and lets production Caddy bypass Node for high-volume map traffic.
2. **Require the production Caddy topology during development.** This preserves the production proxy byte-for-byte, but makes the visual behavior depend on an additional locally installed process/configuration. It is easy to test the website through the wrong port or a stale Caddyfile—the failure mode that motivated this change—and it makes an application feature invisible under the repository's standard dev command.

The first design is used. Caddy remains an optimization/deployment boundary, not a prerequisite for the map page to be structurally correct.

## BlueMap compatibility details

The generated BlueMap 5.23 index uses relative URLs such as `./assets/...` and the webapp later loads `settings.json`; its default `map-data-root` and `live-data-root` are `maps`. The injected document therefore puts `<base href="/map/">` before BlueMap's first relative URL. BlueMap's asset bundle, map hash/history format and runtime code do not need to be rewritten.

BlueMap creates its WebGL canvas in `MapViewer`'s constructor, before `BlueMapApp.load()` has loaded settings/maps. The shell therefore does **not** use canvas existence as a readiness signal. It watches BlueMap's own `window.bluemap.mapViewer.data.mapState` and fades the Slate loading surface only at `"loaded"` (or reports the `"errored"` state). Cross-document View Transitions are progressive enhancement only; the first-paint shell is correct without them.

The website's `public/bluemap/sgp.js` sets high-resolution rendering to 250 blocks, disables flat view, simplifies BlueMap 5.23's menu and enhances the first-paint map header. `content:refresh` resolves each spawn's icon through its resource-pack font and embeds the PNG in `overlays.json`. Keep `styles: ["/bluemap/sgp.css"]` and `scripts: ["/bluemap/sgp.js"]` in BlueMap's `webapp.conf`.

## Apply terrain limits on the server

The website cannot remove BlueMap terrain tiles. Edit `plugins/BlueMap/maps/world.conf` on the Minecraft server, then run these commands yourself in its console:

```text
bluemap reload light
bluemap fix-edges world
bluemap
```

Wait for rendering to finish, then reload the browser. The current configured mask includes X 2350–2600, Z 2050–2320 and Y 195–300. Keep `render-edges: true` to render the cut surfaces. A config edit alone does not reload BlueMap; refreshing website content only updates overlays.

BlueMap normally deletes tiles outside a changed mask automatically. `fix-edges` repairs remaining boundary tiles. See the official mask and command documentation when changing those server-side limits.
