# Historical 3D map archive

Historical maps are offline BlueMap 5.24 renders stored outside Git. They do not run a BlueMap server and do not depend on edition statistics, datapack markers, or live overlays.

## Configure

Create the ignored config:

```bash
cp map-archive.example.json map-archive.json
```

`archiveDirectory` should point outside the checkout (production uses `/srv/map-archive`). Each edition defines:

- `world`: saved Java world;
- `resourcePack`: matching pack, or `null`;
- `minecraftVersion` and `dimension`;
- `center`: the same logical corresponding point across editions, used for XYZ camera translation;
- `renderRadius`: X/Z half-size of the render mask;
- optional `minY`: lowest rendered world Y.

`minY` only clips BlueMap rendering; it never changes Minecraft coordinates. Render edges remain enabled so the cutoff gets proper exposed faces.

### Default archive camera

Optionally configure one BlueMap camera and the edition whose coordinates it uses:

```json
{
  "startLocation": "world:2481:230:2166:96:0.01:1.35:0:0:perspective",
  "startLocationEdition": 4
}
```

The two fields must be set together. The renderer stores the camera's XYZ offset from that edition's `center` and applies the same offset to every edition. Distance and orientation are preserved. Without these fields, each archive starts/reset at its own `center` with the neutral camera defaults.

Install the pinned BlueMap renderer once:

```bash
npm run map:setup
```

BlueMap 5.24 requires Java 25+. Set the config's `java` path if the host default is different.

## Render or replace an edition

```bash
npm run map:archive -- 2
```

Temporary source overrides are supported:

```bash
npm run map:archive -- 2 --world /backups/edition-2 --resource-pack /packs/edition-2.zip
npm run map:archive -- 1 --world /backups/edition-1 --resource-pack none
```

Renders are staged and validated before the manifest is atomically promoted, so a failed render does not replace the active map. Re-rendering creates a new immutable revision; `retainRevisions` controls how many old revisions remain.

Changing `startLocation` only affects newly rendered/re-rendered revisions.

## Publish future editions

`edition:publish` can render the historical map as part of normal publication. Set `mapArchiveConfig` in `publish.json`.

On production, also configure `editionSnapshotCommand` to call the installed `snapshot-world` host helper. The edition's world must be the live server world and its datapack must be inside that world. The helper briefly stops Minecraft, copies one frozen world snapshot, restarts Minecraft, and then publishing uses that same snapshot for statistics, overlays, and the archived map.

For offline/local publication, omit `editionSnapshotCommand` and use the configured source paths directly.

## Viewer

`/wiki/carte` enables editions present in the archive manifest. The archive viewer keeps only the 3D map, orbit/pan/zoom, edition switching, and reset.

Camera position is translated between editions relative to each full XYZ `center`; orientation and zoom are preserved. The active edition uses a 250-block high-resolution distance. Speculatively preloaded neighbors start at 125 blocks and are promoted to 250 when selected.

## Backups

Production backups include `map-archive/public`. Renderer JARs, staging data, and temporary snapshots under the private archive directory are excluded.
