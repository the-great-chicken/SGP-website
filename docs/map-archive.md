# Historical 3D map archive

Historical maps are **offline BlueMap renders**, not extra BlueMap servers. Each edition is rendered once into an immutable revision under the external map archive, and `/wiki/carte` embeds those files with a deliberately minimal viewer.

The archive is independent from edition statistics. In particular, Editions 1–4 can be rendered, replaced or left unavailable without creating database rows.

## One-time configuration

Copy the ignored configuration file from the example:

```bash
cp map-archive.example.json map-archive.json
```

`archiveDirectory` should normally stay outside the Git checkout (production uses `/srv/map-archive`). For each historical edition configure:

- `world`: that edition's saved Java world;
- `resourcePack`: its matching pack, or `null` if unavailable;
- `minecraftVersion`: the version that world was played on;
- `center.x`, `center.y` and `center.z`: the same logical point in every edition. The full XYZ point is the initial/reset orbit target, but users can freely pan away from it afterward;
- `renderRadius`: half-size of the square X/Z render mask around the centre;
- optional `minY`: lowest world Y included in the render. It only clips rendering; it does not change Minecraft coordinates or the camera centre.

No datapack markers, playable-area metadata, player positions or map overlays are read by this archive renderer.

BlueMap 5.24 requires Java 25 or newer. Point the config's `java` field at that runtime if `java` on the host is different. Install the pinned CLI once:

```bash
npm run map:setup
```

The renderer JAR is stored under the archive's private directory and is not committed or backed up.

## Render or replace one edition

```bash
npm run map:archive -- 2
```

You can override the configured inputs without editing the file:

```bash
npm run map:archive -- 2 --world /backups/edition-2 --resource-pack /packs/edition-2.zip
npm run map:archive -- 1 --world /backups/edition-1 --resource-pack none
```

A render is built entirely under `private/staging`. Only after BlueMap finishes, required output files are validated, and the source fingerprints still match does a short archive lock promote the immutable revision and atomically replace `public/manifest.json`. A failed render therefore cannot damage the currently visible edition. `retainRevisions` controls how many revisions are kept for easy rollback/recovery.

The public layout is intentionally simple:

```text
map-archive/
  public/
    manifest.json
    editions/edition-2/<revision>/...
      bluemap-archive.css
      bluemap-archive.js
      sgp-controls.mjs
  private/
    bluemap/
    staging/
    snapshots/
```

Each revision carries its own tiny SGP viewer CSS/JS bridge and the exact SGP camera-control shim used by that revision, so later website changes cannot alter an immutable historical map. The public provenance file contains versions, fingerprints and spatial metadata, but never absolute source paths.

When `minY` is present, the generated BlueMap box render-mask gets a `min-y` bound while remaining unbounded above. `render-edges: true` stays enabled so the retained blocks get proper exposed faces at the cutoff.

## Future editions during normal publication

`edition:publish` can use the same archive renderer. Add the future edition to `map-archive.json`, then set these top-level fields in `publish.json`:

```json
{
  "mapArchiveConfig": "map-archive.json",
  "editionSnapshotCommand": [
    "sudo",
    "/usr/bin/python3",
    "/srv/sgp/ops/host.py",
    "--config",
    "/etc/sgp/host.json",
    "snapshot-world"
  ]
}
```

When `editionSnapshotCommand` is enabled, that edition's `source.world` must be the live server world and `source.datapack` must be inside it. The host helper:

1. takes the host operations lock;
2. stops Minecraft if it is running;
3. copies the complete overworld into `map-archive/private/snapshots/`;
4. restarts Minecraft immediately;
5. gives the snapshot back to the unprivileged `sgp` publisher.

Statistics, map overlays and the historical BlueMap render then all read that **same frozen world**. The slow work happens after Minecraft is back online, and the temporary snapshot is removed at the end of the publishing run.

For local/offline publication, omit `editionSnapshotCommand`; the configured source paths are used directly.

## Viewer behaviour

`/wiki/carte` lists the editions from the normal history content and enables only those present in the archive manifest. BlueMap's normal UI is removed; the iframe keeps orbit/pan/zoom plus the SGP edition selector and reset button. Player/marker polling and SSE are disposed after startup, and empty live-data files prevent noisy initial marker requests.

The archived BlueMap webapp stays stock 5.24 and uses the same 250-block high-resolution view distance as the live map. The timeline also reapplies that distance at runtime, so already-published immutable revisions do not need replacement solely for this viewer setting. Its injected SGP shim changes only the arena camera assumptions: left-drag pans in the camera's screen plane, the orbit target has a free Y instead of terrain-height snapping, and perspective angle is no longer reduced as distance grows. Orbit/rotation and zoom continue through BlueMap's own controls. If the expected 5.24 internals are not present, the shim logs a warning and leaves stock controls running.

BlueMap's camera URL is translated from one edition to another relative to the full XYZ `center`. If the camera is 20 blocks above one edition's logical centre, it remains 20 blocks above the next edition's centre. Distance, rotation, angle, tilt, projection and perspective mode are preserved unchanged. Fresh loads and reset use the edition's full XYZ centre through BlueMap's `start-location`.

## Backups

Production restic backups include `map-archive/public` and validate every manifest-referenced revision. Private renderer JARs, render staging and temporary world snapshots are excluded. Immutable public files are hard-linked into the local backup staging directory where the filesystem supports it, so preparing a backup does not duplicate the archive on disk before restic deduplication.
