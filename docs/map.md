# Live map

`/map` serves the live BlueMap through the website. The Next app owns the `/map` HTML document; BlueMap assets, tiles, and live data stay under `/map/*`. In production Caddy proxies those resource requests directly to BlueMap.

## BlueMap setup

Run **BlueMap 5.24** on the Minecraft server. The website does not install or upgrade the BlueMap plugin.

Keep these entries in BlueMap's `webapp.conf`:

```text
styles: ["/bluemap/sgp.css"]
scripts: ["/bluemap/sgp.js"]
```

For local development, BlueMap's integrated webserver normally listens on `127.0.0.1:8100`. Override that with `BLUEMAP_INTERNAL_URL` if needed.

`public/bluemap/sgp.js` applies the SGP viewer customizations: 250-block high-resolution distance, simplified UI, and arena-oriented perspective controls.

The live reset height is the midpoint of the rendered Y range. If that range changes, update `liveWorldRenderMinY` and `liveWorldRenderMaxY` in `public/bluemap/sgp.js`.

## Render mask

Terrain clipping belongs in the server's BlueMap map config, not the website. Edit `plugins/BlueMap/maps/world.conf`, keep `render-edges: true`, then run:

```text
bluemap reload light
bluemap fix-edges world
bluemap
```

The current live mask uses X 2350–2600, Z 2050–2320, and Y 195–300. If those bounds change, keep the live reset-height constants above in sync.
