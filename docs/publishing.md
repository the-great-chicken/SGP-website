# Content publishing

Run these commands from the website repository root. See the [README](../README.md#local-development) for starting the website and map, and [Linux hosting](../deploy/README.md) for deployment.

## First setup

Install Python 3.11+ (`python3-venv` is also needed on Ubuntu), then:

```powershell
npm run content:setup
Copy-Item publish.example.json publish.json
```

Edit the ignored `publish.json` using [the example](../publish.example.json). Paths are relative to the configuration file. Set `databaseUrl` to the same SQLite file as the website's `DATABASE_URL`; the publishing command reads this setting from `publish.json`, not `.env`.

`current` defines the sources for today's kit catalogue and map. Each `editions["5"].source` defines that edition's own world, datapack, resource pack and matching Minecraft client JAR. Fill in its name and dates too. Use a stopped-world copy or backup, and keep finished-edition inputs immutable. Exporters only read these sources.

Set the exact datapack and resource-pack release identifiers; `resourcePackRelease` must match the pack's embedded `release.json`. For map selections, `maps[].id` is the BlueMap map id and `dimension` is the Minecraft dimension. `playableArea` and `spawnGroups` select the datapack's numbered playable-area marker and spawn lists; the example selects area 1 and groups 1 and 2.

## Refresh current content

```powershell
npm run content:refresh
```

This updates the kit manifest, renders item images (reusing unchanged assets), and exports BlueMap's **Lieux** and **Points de spawn** layers. Locations are clipped to the playable area with their exclusions preserved. It does not import statistics. Reload the map page to load the new overlays.

Generated files stay outside Git:

- `data/kit-manifest.json`
- `data/item-renders.json`
- `public/generated/item-icons/`
- `public/bluemap/overlays.json`

The dev server serves these files locally. Include them in the next production website build as described in the [hosting guide](../deploy/README.md#build-and-activate-a-release).

## Publish a finished edition

```powershell
npm run edition:publish -- 5
```

This prepares the edition's kits, images, map overlays and statistics, validates them, saves a recovery copy of an existing database, and imports the statistics as published. The current kit catalogue and map overlays stay unchanged. Repeating the same edition number atomically replaces that edition's snapshot and statistics. Statistics do not require a website rebuild.

For production, point `databaseUrl` at the persistent website database and run with its filesystem permissions. The command needs a source checkout with dependencies; the standalone serving release does not include the exporters. Synchronize DiscordSRV links afterward if the import added players (see [the README](../README.md#discord-login-and-cosmetics-optional)).

## Preview and recovery

```powershell
npm run content:refresh -- --prepare-only
npm run edition:publish -- 5 --prepare-only
```

`--prepare-only` validates all exports without updating current website files or the database. Add `--config <file>` to select another configuration.

Every run keeps its exports and any database recovery copy in `.data/publishing/`. Export failures stop before publication. A lock prevents overlapping runs in the checkout; after an interrupted process, remove its `active.lock` only once that process has stopped. Retain useful snapshots and remove obsolete run directories when no longer needed.

## Individual tools

For exporter development, the kit CLI exposes its options through `.venv/Scripts/python.exe -m sgp_kit_exporter --help`. It parses `give @s` and `item replace entity @s` commands in kit `items.mcfunction` files; unsupported commands stop the export with a source location. `--output` selects the manifest destination and `--check` checks for stale output without writing.

`npm run assets:render-items -- --resource-pack <pack-path> --minecraft-client <client.jar>` rebuilds images for `data/kit-manifest.json`. The pack's release identity must match the manifest. The website checks the image index against the manifest; regenerate both together after changing releases.

The statistics exporter is the edition datapack's `stats_analysis/export_web.py`; use `.venv-statistics` for it, since it requires a different NBT library version from the kit exporter. The combined publishing command handles that selection automatically.
