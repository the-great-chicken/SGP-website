# Content publishing

Run publishing commands from the repository root.

## Setup

Install Python 3.11+ with `venv` support, then:

```powershell
npm run content:setup
Copy-Item publish.example.json publish.json
```

Edit the ignored `publish.json`. Paths are relative to that file. `databaseUrl` must point at the same SQLite database used by the website.

`current` supplies the current kit catalogue, cosmetic assets, and live-map overlays. Each `editions[...]` entry supplies the matching historical world/datapack/resource pack used when publishing that edition. Historical 3D maps use the separate [map archive configuration](map-archive.md).

## Refresh current content

```powershell
npm run content:refresh
```

This refreshes the kit manifest, item/cosmetic renders, and live BlueMap overlays. It does not import edition statistics.

Generated content stays outside Git, including `data/*.json`, `public/generated/`, and `public/bluemap/overlays.json`. Include the generated files in the next production build.

## Publish an edition

```powershell
npm run edition:publish -- 5
```

This prepares and validates the edition's content, imports its statistics, and keeps a database recovery copy. If `mapArchiveConfig` is configured, the same run also prepares and promotes that edition's immutable historical map revision.

For production publication from the live server, configure `editionSnapshotCommand` as described in [Historical 3D map archive](map-archive.md). The snapshot lets statistics, overlays, and the archived map read the same frozen world while Minecraft is restarted immediately after the copy.

After publishing on production, run `npm run db:sync-discordsrv` from a source checkout with access to the persistent database and Minecraft account files.

## Dry runs and recovery

```powershell
npm run content:refresh -- --prepare-only
npm run edition:publish -- 5 --prepare-only
```

`--prepare-only` validates output without publishing it. Use `--config <file>` for a different publishing configuration.

Publishing work and database recovery copies are kept under `.data/publishing/`. A lock prevents overlapping runs; remove a stale `active.lock` only after confirming the original publishing process has stopped.
