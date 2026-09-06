# SGP website

This repository owns the SGP public website, its private player area, and the build-time exporters that feed it. The SGP datapack remains independently runnable and is never modified by these tools.

## Web application

The application uses Next.js App Router, TypeScript, React, Drizzle ORM and SQLite.

### Local setup

Node.js 20.19 or newer is required.

For Linux production setup, HTTPS, deployment and backup recovery, see [deploy/README.md](deploy/README.md). Production builds use the Node version pinned in `.node-version`.

```powershell
npm install
Copy-Item .env.example .env
npm run db:migrate
npm run dev
```

The public structure includes the home page, kit catalogue and kit details, leaderboards, player directory and profiles, history, and map. `/login` starts Discord OAuth with the minimal `identify` scope. `/me` validates an opaque, server-side session and resolves its Minecraft profile through the latest DiscordSRV link sync.

`/map/` is served by BlueMap through the reverse proxy; [deploy/Caddyfile](deploy/Caddyfile) provides the routing template. The theme is versioned in `public/bluemap/` and served directly by the website: set `styles: ["/bluemap/sgp.css"]` and `scripts: ["/bluemap/sgp.js"]` in BlueMap's `webapp.conf`.

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

### Refreshing content and publishing editions

One-time setup: with Python 3.11+ installed (`python3-venv` is also needed on Ubuntu), run `npm run content:setup`, then copy `publish.example.json` to ignored `publish.json`. Fill in your saved-world, datapack, resource-pack and Minecraft client paths, exact release identifiers, and edition details. Paths are relative to the configuration file. Use a stopped-world copy or backup; source files are read-only.

```powershell
npm run content:refresh
npm run edition:publish -- 5
```

`content:refresh` updates the current kit catalogue, reuses matching item images, and exports BlueMap locations and spawnpoints. BlueMap shows toggleable **Lieux** and **Points de spawn** layers. `maps[].id` is the BlueMap map id; `playableArea` and `spawnGroups` select your datapack's numbered area and spawn lists. The example selects playable area 1 and spawn groups 1 and 2.

`edition:publish` uses that edition's own saved inputs, prepares all exports, validates them, snapshots the existing SQLite database, and imports the statistics as published. It never replaces the current kit catalogue or map overlays. Set `databaseUrl` to the website database and run with its filesystem permissions on production; no website rebuild is needed for statistics.

Add `--prepare-only` to either command to validate exports without updating the website or database, or `--config <file>` to select another configuration. Every run retains its exports and any database recovery copy in `.data/publishing/`. Failed exports stop before publication. A lock prevents overlapping runs in the checkout; after an interrupted process, remove `active.lock` there only once that process has stopped. Keep edition inputs immutable and retain useful recovery copies; obsolete run directories can be removed later.

Include the generated `data/kit-manifest.json`, `data/item-renders.json`, `public/generated/item-icons/`, and `public/bluemap/overlays.json` in the next website release after refreshing current content. Exporters and styling are versioned; generated content stays outside Git. The individual commands below remain available for focused corrections.

### Individual edition exports

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

### Discord authentication and Minecraft links

Create an application in the Discord Developer Portal and register `http://localhost:3000/api/auth/discord/callback` for local development, plus the HTTPS equivalent for production. Fill `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, and `DISCORD_REDIRECT_URI` in the environment. The client secret must stay outside Git.

DiscordSRV remains the authority for Discord-to-Minecraft links. Synchronize its append-only account store after importing players and whenever account links change:

```powershell
npm run db:sync-discordsrv -- ..\server\plugins\DiscordSRV\accounts.aof
```

The path can instead be stored in `DISCORDSRV_ACCOUNTS_PATH`. Synchronization replays DiscordSRV link and unlink operations, applies the resulting one-to-one mappings atomically, clears stale website links, and ignores UUIDs that do not yet exist in the website database. Run it again after importing an edition so newly known players can be linked.

OAuth access tokens are used once to request the Discord identity and are not persisted. Website sessions use random opaque cookies whose SHA-256 hashes are stored in SQLite for 30 days. In production, the cookies are Secure and use the `__Host-` prefix.

### Private cosmetics

`/me` displays Minecraft unlocks and equipment. Players must be online to equip or unequip; offline views show the last confirmed snapshot. Particle trails need a selected intensity. The catalogue comes from the datapack and refreshes on datapack reload.

1. Install TGCPlugin and the datapack cosmetic API, enable the plugin's cosmetics bridge, and synchronize DiscordSRV links as above.
2. Generate a secret with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`. Set it in both TGCPlugin's `cosmetics.secret` and the website's `COSMETICS_BRIDGE_SECRET`.
3. Set `COSMETICS_BRIDGE_URL` to the private plugin listener: `http://127.0.0.1:8766` on the same host, or private HTTPS/a loopback tunnel across hosts. Keep host clocks synchronized.
4. Run `npm run db:migrate`, build and restart the website. Its reverse proxy must preserve the public `Host` header.

Run `npm run test:cosmetics` for website tests and `.venv/Scripts/python.exe scripts/check-cosmetic-hooks.py` to validate the datapack declarations and hooks without starting Minecraft.

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
