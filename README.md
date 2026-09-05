# SGP website

This repository owns the SGP public website, its private player area, and the build-time exporters that feed it. The SGP datapack remains independently runnable and is never modified by these tools.

## Web application

The application uses Next.js App Router, TypeScript, React, Drizzle ORM and SQLite.

### Local setup

Node.js 20.19 or newer is required.

```powershell
npm install
Copy-Item .env.example .env
npm run db:migrate
npm run dev
```

The public structure currently includes the home page, kit catalogue and kit details, leaderboards, player directory and profiles, history, and map. `/login` is the future Discord entry point and `/me` is the private player-area shell. Authentication and authorization still need to be connected before private player data is exposed.

The kit catalogue is searchable and sortable. Each kit page presents its ability, a slot-based loadout with Minecraft-style text-component tooltips, rendered item models, and aggregate popularity, elimination/death ratio, and damage-per-minute statistics across published or archived editions.

### Database ownership

Only the Drizzle schema and generated SQL migrations belong in Git. The local database is `.data/sgp.sqlite`; the whole `.data` directory is ignored.

In production, set `DATABASE_URL` to a file on a persistent volume outside the application checkout, for example `file:/var/lib/sgp/sgp.sqlite`. Back up that volume independently of deployments. This SQLite setup assumes one writable application instance; move to a network database before running multiple replicas.

Useful commands:

```powershell
npm run typecheck
npm run lint
npm run build
npm run test:kits
npm run test:database
npm run assets:render-items
npm run db:generate
npm run db:migrate
npm run db:studio
```

### Publishing a completed edition

Choose the immutable datapack and resource-pack release identifiers used for the edition. Generate the ignored kit manifest from that exact datapack release; it captures those identifiers alongside the loadouts, ability names and descriptions:

```powershell
$datapackRelease = "<datapack-release>"
$resourcePackRelease = "<resource-pack-release>"
.\.venv\Scripts\python.exe -m sgp_kit_exporter --datapack ..\server\world\datapacks\TGCdatapack --minecraft-version 26.1 --datapack-release $datapackRelease --resource-pack-release $resourcePackRelease
```

Separately, the datapack's `stats_analysis/export_web.py` exports only a portable statistics snapshot. It never reads the kit manifest or website edition metadata:

```powershell
python ..\server\world\datapacks\TGCdatapack\stats_analysis\export_web.py <path-to-command_storage.dat> --datapack-release $datapackRelease --output data\statistics-snapshot.json
```

The website combines and validates both files while importing. Edition publishing fields are supplied here, and datapack/resource-pack versions stored in SQLite are derived from the artifacts:

```powershell
npm run db:migrate
npm run db:import-edition -- data\statistics-snapshot.json --kit-manifest data\kit-manifest.json --edition 5 --name "Cinquième édition" --status published --starts-at 2026-08-01T18:00:00+02:00 --ends-at 2026-08-01T22:00:00+02:00 --published-at 2026-08-02T10:00:00Z
```

The importer rejects different datapack release identifiers before opening a transaction, then validates all player, kit, ability and damage-cause relationships. Reimporting the same edition number atomically replaces its kit snapshot and statistics, so publishing can be safely repeated after correcting source data.

## Kit manifest exporter

`items.mcfunction` remains the authoritative source for every kit loadout. The exporter uses Mecha to parse those functions and writes a deterministic, versioned JSON manifest for the website.

The exporter deliberately accepts only these command shapes:

```mcfunction
give @s <item> [count]
item replace entity @s <slot> with <item> [count]
```

Any other command, selector or ambiguous loadout stops the export with its source location. New Minecraft components do not require exporter changes because component values are copied as a generic JSON-compatible tree.

### Setup

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[test]"
```

### Export

```powershell
.\.venv\Scripts\python.exe -m sgp_kit_exporter --datapack ..\server\world\datapacks\TGCdatapack --minecraft-version 26.1 --datapack-release <datapack-release> --resource-pack-release <resource-pack-release>
```

The default output is `data/kit-manifest.json`. Pass `--output <path>` to write elsewhere.

### Render kit items

After generating the kit manifest, render its unique item variants with the TGC resource pack layered over the matching vanilla Minecraft client JAR:

```powershell
npm run assets:render-items
```

On Windows, the command defaults to `../TGC_PACK/TGC_Pack` and the client JAR for the manifest's Minecraft version in the standard launcher directory. Override either source with `TGC_RESOURCE_PACK_PATH` and `MINECRAFT_CLIENT_JAR_PATH`, or pass `--resource-pack <path>` and `--minecraft-client <path>` after `--`.

The renderer first checks the resource pack's embedded `release.json` against the exact resource-pack release named by the kit manifest. It then writes ignored PNG files under `public/generated/item-icons` and an ignored lookup index at `data/item-renders.json`. That index records the datapack, resource-pack and Minecraft releases; the website rejects it if any identity differs from the currently loaded manifest. Missing generated assets gracefully fall back to the generic item placeholders, so normal application work does not require the resource pack.

### Check generated data

```powershell
.\.venv\Scripts\python.exe -m sgp_kit_exporter --datapack ..\server\world\datapacks\TGCdatapack --minecraft-version 26.1 --datapack-release <datapack-release> --resource-pack-release <resource-pack-release> --check
```

`--check` performs the full export in memory and fails without writing if the on-disk manifest differs.

### Tests

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```
