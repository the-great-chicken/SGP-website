# SGP website

The SGP website uses Next.js, TypeScript and SQLite. This repository also owns the content exporters and BlueMap theme; the exporters only read the Minecraft source files.

## Local development

Use the Node.js version in [`.node-version`](.node-version); Node 22.8+ is required because the test gate relies on the built-in coverage thresholds added in that release. Run commands from the repository root; the examples use PowerShell (`cp` replaces `Copy-Item` on Linux/macOS).

### First setup

```powershell
npm ci
Copy-Item .env.example .env
npm run db:migrate
```

On Ubuntu/Debian, if `npm ci` needs to compile the transitive `gl` dependency, install its native build prerequisites first: `build-essential libx11-dev libxext-dev libxi-dev libglu1-mesa-dev libglew-dev pkg-config`. CI installs these automatically.

Keep your existing `.env` on subsequent runs. The default database is `.data/sgp.sqlite`; `.env`, `publish.json`, databases and generated content are ignored by Git.

### Start the website

```powershell
npm run dev
```

The website is available at [localhost:3000](http://localhost:3000). Public pages work without running Minecraft or configuring Discord. To populate kits and statistics, follow [Content publishing](docs/publishing.md); existing exports and imported editions do not need to be regenerated at every startup.

### Include the map

Start your Paper server with BlueMap's integrated webserver enabled, then keep the normal website development command running:

```powershell
npm run dev
```

Open **[localhost:3000/map](http://localhost:3000/map)**. No development reverse proxy is required. The Next app owns the `/map` HTML document, fetches BlueMap's current generated index from `BLUEMAP_INTERNAL_URL` (default `http://127.0.0.1:8100`), and injects the SGP first-paint header/loading shell. In development only, Next's fallback rewrite proxies `/map/*` assets, map data and live/SSE requests to that BlueMap origin. The real `/map` route wins before the fallback, so the generated BlueMap document itself is never served directly.

The injected document adds `<base href="/map/">`, so BlueMap's untouched relative `./assets/...`, `settings.json`, `maps/...` and live-data URLs keep resolving correctly even though the public document URL is `/map`. Hash camera/map links such as `/map#world:...` remain native BlueMap state.

In BlueMap's `webapp.conf`, keep `styles: ["/bluemap/sgp.css"]` and `scripts: ["/bluemap/sgp.js"]`. The shell also loads `sgp.css` before first paint. Its loading surface waits for BlueMap 5.23's own `mapViewer.data.mapState === "loaded"`; the mere creation of BlueMap's WebGL canvas is intentionally not treated as ready.

If BlueMap is not running, `/map` returns a navigable Slate error page instead of a raw proxy error. `content:refresh` exports data; it does not start BlueMap.

### Discord login and cosmetics (optional)

To test login, create a Discord application and fill `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` and `DISCORD_REDIRECT_URI` in `.env`. Register `http://localhost:3000/api/auth/discord/callback` in the Discord Developer Portal, then restart the dev server after configuration changes.

Set `DISCORDSRV_ACCOUNTS_PATH` to the server's `plugins/DiscordSRV/accounts.aof` and `MINECRAFT_USERCACHE_PATH` to the same server's `usercache.json`, then synchronize after Minecraft/Discord links change or new players join. If `MINECRAFT_USERCACHE_PATH` is omitted, the command also tries the standard `usercache.json` location inferred from `accounts.aof`:

```powershell
npm run db:sync-discordsrv
```

The sync refreshes current Minecraft names from `usercache.json`, creates newly discovered player identities, then applies DiscordSRV's current one-to-one links. Public player statistics still appear only after a published edition contains that player. For `/me` cosmetics, enable TGCPlugin's cosmetics bridge and the datapack cosmetic API. Set `COSMETICS_BRIDGE_URL` to its private listener (locally `http://127.0.0.1:8766`) and use the same secret for the plugin's `cosmetics.secret` and `.env`'s `COSMETICS_BRIDGE_SECRET`. Generate a secret with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Players must be online to change equipped cosmetics; offline views show their last confirmed snapshot.

## Checks

CI runs the complete gate on every pull request targeting `main` and again on every push to `main`. Configure the `Full test gate` check as required in the repository branch rules to block merges when it fails. For the same check locally, first install the Python exporter/test environment with `npm run content:setup` if `.venv` is not already set up, then run:

```powershell
npm run check
```

The gate runs lint, TypeScript typechecking, the standard TypeScript/JavaScript tests, critical-module coverage gates, every Python `test_*.py` test, the cross-process publishing integration suite, the production Next.js build, and seven Playwright browser journeys against that production build, including narrow-viewport layout/overflow checks. CI installs the pinned Chromium automatically. For a first local browser run, use `npx playwright install chromium` (on Linux, `npx playwright install --with-deps chromium` if the browser system libraries are not already installed). The narrower `test:*` scripts remain available for faster iteration on one area; `npm run test:app` runs the Next route-boundary suite and, after a production build exists, `npm run test:e2e` runs only the browser smoke suite. `scripts/check-cosmetic-hooks.py` validates the datapack cosmetic hooks without starting Minecraft.

Database-backed TypeScript tests should use `createTestDatabase(t)` from `tests/support/database.ts`; it applies the real Drizzle migrations and registers idempotent client cleanup with the Node test context. `tests/migrations.test.ts` separately protects the production upgrade path by creating a populated database at migration `0004` and then applying the current migration folder in place.

`npm run test:integration` owns tests that deliberately cross runtime/process boundaries. Its publishing test executes the real Python kit and map exporter CLIs, feeds those artifacts through the TypeScript publishing schemas and workflow, and verifies the real SQLite import. Minecraft item rendering and the external statistics exporter stay as explicit boundaries in that test so it remains deterministic and fixture-sized.

Coverage is intentionally selective rather than global. `npm run test:coverage` requires Node 22.8+ (the pinned CI/runtime is Node 24.20.0) and measures high-risk modules independently, with per-module line/branch/function floors. Gates cover historical and kit statistics queries, cosmetics service/bridge/HTTP/cache persistence, edition importing and bundle contracts, auth-session persistence, Discord OAuth and DiscordSRV reconciliation, publishing, BlueMap shell/routing, Minecraft skin-profile validation, item-render contracts, and kit-manifest/loadout presentation. Reports are written to `coverage/summary.md`, `coverage/summary.json`, the per-module LCOV files, and combined `coverage/lcov.info`; CI shows the Markdown summary in the job summary and uploads that directory. Treat these floors as regression guards: raise them when tests improve, but do not lower them merely to silence a failure. Function floors intentionally leave some headroom because Node coverage through `tsx` can report synthetic source-map wrapper/module functions even when every callable source function is exercised. The BlueMap routing gate documents this explicitly because its tiny module otherwise has a mathematical 75% ceiling under the current instrumentation; it also requires every callable routing export to be exercised by name.

Dependency install scripts are allowlisted by exact package version in `package.json`, and `.npmrc` makes unreviewed install scripts a hard failure. When an install fails after a dependency update, review the package first, then use `npm install-scripts ls` / `npm install-scripts approve <package>` rather than disabling the policy.

For schema changes, run `npm run db:generate` and commit the migration, then apply it with `npm run db:migrate`. `npm run db:studio` opens the local database editor.

## Further documentation

- [Content publishing](docs/publishing.md): refresh kits, images and map overlays; publish a finished edition.
- [Linux hosting](deploy/README.md): production services, HTTPS, secrets, deployment and backups.
