# SGP website

Next.js/TypeScript website for SGP, with SQLite-backed statistics, content exporters, the live BlueMap integration, and the historical map archive.

## Local development

Use the Node.js version from [`.node-version`](.node-version).

```powershell
npm ci
Copy-Item .env.example .env
npm run db:migrate
npm run dev
```

The site runs at [localhost:3000](http://localhost:3000). Keep your existing `.env` on later runs; local databases, publishing configuration, and generated content are ignored by Git.

### Live map

To use `/map`, run the Minecraft server with BlueMap 5.24 and follow [Live map](docs/map.md).

### Optional Discord/cosmetics integration

For Discord login, configure `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, and `DISCORD_REDIRECT_URI` in `.env`, and register the matching callback URL in Discord.

To import DiscordSRV links and current Minecraft names, set `DISCORDSRV_ACCOUNTS_PATH` and `MINECRAFT_USERCACHE_PATH`, then run:

```powershell
npm run db:sync-discordsrv
```

Cosmetic changes use the TGCPlugin bridge. Configure `COSMETICS_BRIDGE_URL` and the same `COSMETICS_BRIDGE_SECRET` on both sides. Players must be online to change equipped cosmetics.

## Checks

Run the same main gate used by CI:

```powershell
npm run check
```

It covers linting, typechecking, automated tests, the production build, and browser tests. The narrower `test:*` scripts in `package.json` are available for targeted work.

For schema changes, run `npm run db:generate` and commit the migration. Apply migrations with `npm run db:migrate`.

## Documentation

- [Content publishing](docs/publishing.md)
- [Live map](docs/map.md)
- [Historical 3D map archive](docs/map-archive.md)
- [History content](docs/history.md)
- [Linux hosting](deploy/README.md)
