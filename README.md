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

Generate the ignored kit manifest first so the edition captures the exact loadouts plus the ability names and descriptions declared by the datapack:

```powershell
.\.venv\Scripts\python.exe -m sgp_kit_exporter --datapack ..\server\world\datapacks\TGCdatapack --minecraft-version 26.1
```

The datapack's independent `stats_analysis/export_web.py` command converts a completed `command_storage.dat` and that kit manifest into one versioned, UUID-based edition bundle. Import it after applying migrations:

```powershell
npm run db:migrate
npm run db:import-edition -- <path-to-edition-bundle.json>
```

The importer validates the full bundle before opening a transaction. Reimporting the same edition number atomically replaces its kit snapshot and statistics, so publishing can be safely repeated after correcting source data.

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
.\.venv\Scripts\python.exe -m sgp_kit_exporter --datapack ..\server\world\datapacks\TGCdatapack --minecraft-version 26.1
```

The default output is `data/kit-manifest.json`. Pass `--output <path>` to write elsewhere.

### Render kit items

After generating the kit manifest, render its unique item variants with the TGC resource pack layered over the matching vanilla Minecraft client JAR:

```powershell
npm run assets:render-items
```

On Windows, the command defaults to `../TGC_PACK/TGC_Pack` and the client JAR for the manifest's Minecraft version in the standard launcher directory. Override either source with `TGC_RESOURCE_PACK_PATH` and `MINECRAFT_CLIENT_JAR_PATH`, or pass `--resource-pack <path>` and `--minecraft-client <path>` after `--`.

The command writes ignored PNG files under `public/generated/item-icons` and an ignored lookup index at `data/item-renders.json`. Missing generated assets gracefully fall back to the generic item placeholders, so normal application work does not require the resource pack. These path-based inputs are also the boundary where extracted, version-matched release artifacts can replace local checkouts later.

### Check generated data

```powershell
.\.venv\Scripts\python.exe -m sgp_kit_exporter --datapack ..\server\world\datapacks\TGCdatapack --minecraft-version 26.1 --check
```

`--check` performs the full export in memory and fails without writing if the on-disk manifest differs.

### Tests

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```
