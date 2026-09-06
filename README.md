# SGP website

The SGP website uses Next.js, TypeScript and SQLite. This repository also owns the content exporters and BlueMap theme; the exporters only read the Minecraft source files.

## Local development

Use the Node.js version in [`.node-version`](.node-version). Run commands from the repository root; the examples use PowerShell (`cp` replaces `Copy-Item` on Linux/macOS).

### First setup

```powershell
npm ci
Copy-Item .env.example .env
npm run db:migrate
```

Keep your existing `.env` on subsequent runs. The default database is `.data/sgp.sqlite`; `.env`, `publish.json`, databases and generated content are ignored by Git.

### Start the website

```powershell
npm run dev
```

The website is available at [localhost:3000](http://localhost:3000). Public pages work without running Minecraft or configuring Discord. To populate kits and statistics, follow [Content publishing](docs/publishing.md); existing exports and imported editions do not need to be regenerated at every startup.

### Include the map

Install [Caddy](https://caddyserver.com/docs/install) and make `caddy` available on your PATH. Keep the website running, start your Paper server with BlueMap, and run this in a second terminal:

```powershell
caddy run --config Caddyfile.local --adapter caddyfile
```

Open **[localhost:8080](http://localhost:8080)** for the website and **[localhost:8080/map/](http://localhost:8080/map/)** for BlueMap. The versioned [Caddyfile.local](Caddyfile.local) routes `/map/` to BlueMap on `127.0.0.1:8100` and everything else to Next.js on port 3000. Keep both terminals open; Ctrl+C stops each process.

BlueMap's webserver must be enabled on that address. In its `webapp.conf`, set `styles: ["/bluemap/sgp.css"]` and `scripts: ["/bluemap/sgp.js"]`. These files and the exported overlays are served by the website, so they do not need to be copied into BlueMap's webroot.

A `/map/` **404 on port 3000** means you bypassed Caddy. A **502 on port 8080** means the upstream service for that route is unavailable. `content:refresh` exports data; it does not start BlueMap or the proxy.

### Discord login and cosmetics (optional)

To test login, create a Discord application and fill `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` and `DISCORD_REDIRECT_URI` in `.env`. Register the same callback in the Discord Developer Portal: `http://localhost:8080/api/auth/discord/callback` when using Caddy, or port 3000 when using Next.js directly. Restart the dev server after configuration changes.

Set `DISCORDSRV_ACCOUNTS_PATH` to the server's `plugins/DiscordSRV/accounts.aof`, then synchronize links after importing players or changing Minecraft/Discord links:

```powershell
npm run db:sync-discordsrv
```

Only players already imported into the website database can be linked. For `/me` cosmetics, enable TGCPlugin's cosmetics bridge and the datapack cosmetic API. Set `COSMETICS_BRIDGE_URL` to its private listener (locally `http://127.0.0.1:8766`) and use the same secret for the plugin's `cosmetics.secret` and `.env`'s `COSMETICS_BRIDGE_SECRET`. Generate a secret with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Players must be online to change equipped cosmetics; offline views show their last confirmed snapshot.

## Checks

```powershell
npm run lint
npm run typecheck
npm run test:kits
npm run test:database
npm run test:publishing
npm run test:cosmetics
npm run build
```

After installing the exporters through `npm run content:setup`, run Python tests with `.venv/Scripts/python.exe -m unittest discover -s tests -v` (`.venv/bin/python` on Linux/macOS). `scripts/check-cosmetic-hooks.py` validates the datapack cosmetic hooks without starting Minecraft.

For schema changes, run `npm run db:generate` and commit the migration, then apply it with `npm run db:migrate`. `npm run db:studio` opens the local database editor.

## Further documentation

- [Content publishing](docs/publishing.md): refresh kits, images and map overlays; publish a finished edition.
- [Linux hosting](deploy/README.md): production services, HTTPS, secrets, deployment and backups.
