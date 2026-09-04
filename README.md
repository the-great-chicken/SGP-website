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

### Database ownership

Only the Drizzle schema and generated SQL migrations belong in Git. The local database is `.data/sgp.sqlite`; the whole `.data` directory is ignored.

In production, set `DATABASE_URL` to a file on a persistent volume outside the application checkout, for example `file:/var/lib/sgp/sgp.sqlite`. Back up that volume independently of deployments. This SQLite setup assumes one writable application instance; move to a network database before running multiple replicas.

Useful commands:

```powershell
npm run typecheck
npm run lint
npm run build
npm run db:generate
npm run db:migrate
npm run db:studio
```

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

### Check generated data

```powershell
.\.venv\Scripts\python.exe -m sgp_kit_exporter --datapack ..\server\world\datapacks\TGCdatapack --minecraft-version 26.1 --check
```

`--check` performs the full export in memory and fails without writing if the on-disk manifest differs.

### Tests

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```
