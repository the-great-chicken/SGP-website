# Map settings

The website's `public/bluemap/sgp.js` sets high-resolution rendering to 250 blocks, disables flat view, and simplifies BlueMap 5.23's menu. `content:refresh` resolves each spawn's icon through its resource-pack font and embeds the PNG in `overlays.json`.

## Apply terrain limits on the server

The website cannot remove BlueMap terrain tiles. Edit `plugins/BlueMap/maps/world.conf` on the Minecraft server, then run these commands yourself in its console:

```text
bluemap reload light
bluemap fix-edges world
bluemap
```

Wait for rendering to finish, then reload the browser. The current configured mask includes X 2350–2600, Z 2050–2320 and Y 195–300. Keep `render-edges: true` to render the cut surfaces. A config edit alone does not reload BlueMap; refreshing website content only updates overlays.

BlueMap normally deletes tiles outside a changed mask automatically. `fix-edges` repairs remaining boundary tiles. See the official [mask documentation](https://bluemap.bluecolored.de/wiki/customization/Masks.html) and [commands](https://bluemap.bluecolored.de/wiki/getting-started/Commands.html).
