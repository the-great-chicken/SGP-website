# Linux hosting

One Ubuntu Server 26.04 LTS machine runs Caddy, the Next.js website and Paper with BlueMap. SQLite stays outside releases. These files prepare the host; nothing is installed until you run the commands below. The domain and machine location can be chosen later.

Public traffic uses HTTPS: `/` → website. The `/map` HTML document is served by the website itself so the SGP navbar/background exist at first paint; `/map/*` assets, tiles and live/SSE traffic proxy directly to BlueMap with the prefix stripped. Caddy connects to both through loopback, and BlueMap's SGP CSS/JS remain served from the website's `/bluemap/` directory. Minecraft has its separate game port.

## Prepare the host

Use a dedicated host. The installer replaces Caddy's configuration, retaining a copy of the old file, and creates `sgp` and `minecraft` service accounts. It preserves existing secret files and does not start the services.

```bash
sudo apt update
sudo apt install caddy restic openjdk-25-jre-headless python3 curl xz-utils openssl
```

Install the exact Node version from `.node-version` on both the build machine and host. From this repository, on Linux:

```bash
set -euo pipefail
version=$(cat .node-version)
case "$(uname -m)" in x86_64) arch=x64 ;; aarch64) arch=arm64 ;; *) exit 1 ;; esac
archive="node-v$version-linux-$arch.tar.xz"
curl -fSLO "https://nodejs.org/dist/v$version/$archive"
curl -fSLO "https://nodejs.org/dist/v$version/SHASUMS256.txt"
awk -v name="$archive" '$2 == name' SHASUMS256.txt | sha256sum --check --status
sudo mkdir -p /opt/node
sudo tar -xJf "$archive" --strip-components=1 -C /opt/node
export PATH="/opt/node/bin:$PATH"
```

Move the downloaded archive and checksum file outside the checkout before building. Keep the pinned runtime updated through tested releases; Ubuntu packages receive normal security updates.

Copy `deploy/host.example.json` to ignored `deploy/host.json` and edit it for the future host. Paths default to `/srv/sgp` (releases), `/var/lib/sgp` (database/cache), `/etc/sgp` (secrets), and `/srv/minecraft` (server). The remaining commands assume those defaults; use your configured paths if changed.

```bash
python3 deploy/host.py render
sudo bash deploy/rendered/install.sh "$PWD/deploy"
sudoedit /etc/sgp/website.env
sudoedit /etc/sgp/backup.env
```

`website.env` contains Discord credentials and the cosmetics bridge secret. Register its exact HTTPS callback in Discord. These values are read at service startup, never built into the release. Restart the website after changing them. Secret files stay root-owned, mode `0600`; systemd supplies them to the service.

Choose an off-machine restic repository in `backup.env` (SFTP, S3, etc.) and add its credentials as needed. Save those credentials and `/etc/sgp/restic-password` separately in a password manager: losing the host must not lose the key to its backups. This file uses simple `KEY=value` lines; quote values consistently for both systemd and Bash.

```bash
sudo bash -c 'set -a; source /etc/sgp/backup.env; set +a; restic init'
```

Run `restic init` only for a new repository. Caddy manages certificate issuance and renewal and keeps its own state under `/var/lib/caddy`. Once DNS points at the host, allow inbound TCP 80/443 and the configured Minecraft game port; keep SSH restricted to your administration access. Do not expose website port 3000, BlueMap port 8100 or cosmetics bridge port 8766. A home host also needs router forwarding and a reachable public address; those details do not change these files.

## Apply Minecraft changes yourself

1. Stop your old server and copy its complete directory into `/srv/minecraft`, including worlds, plugins, BlueMap configuration and `packs/`. Use the intended Paper version as `paper.jar`; retain the accepted EULA and give the `minecraft` account ownership of the copied directory (`sudo chown -R minecraft:minecraft /srv/minecraft`). Do not run the old and new copies simultaneously.
2. In BlueMap's `webserver.conf`, use `ip: "127.0.0.1"` and `port: 8100` (or the configured port). Keep its webroot and storage inside the Minecraft directory. Preserve the playable-area mask, pack, automatic updates and live players already configured. Keep `styles: ["/bluemap/sgp.css"]` and `scripts: ["/bluemap/sgp.js"]` in `webapp.conf`.
3. Keep the cosmetics bridge listening on loopback and set the same secret as `website.env`.

The provided service handles graceful shutdown. Backup consistency depends on running this server through `sgp-minecraft.service` and keeping world/plugin files inside its directory; avoid external symlinks or concurrent manual Java processes.

## Build and activate a release

Build on Linux with the same CPU architecture as production, from a clean committed checkout with no `.env` files. Copy the [generated current-content files](../docs/publishing.md#refresh-current-content) into this checkout before building. Production statistics and player data come from SQLite.

```bash
export PATH="/opt/node/bin:$PATH"
bash deploy/build-release.sh /tmp/sgp-release
```

This installs locked dependencies without the offline renderer's graphics setup scripts, runs lint and hosting tests, builds standalone Next.js, and packages its runtime, static assets and migrations. No development database or secret files are shipped. Transfer that release directory to the host under a unique name, for example `/srv/sgp/releases/2026-09-06`, preserving file modes. Make it root-owned and keep completed releases unchanged.

```bash
sudo python3 /srv/sgp/ops/host.py --config /etc/sgp/host.json activate /srv/sgp/releases/2026-09-06
sudo systemctl enable sgp-website sgp-minecraft
sudo systemctl start sgp-minecraft
sudo systemctl enable --now caddy
sudo systemctl reload caddy
```

Activation checks runtime compatibility, stops the website, snapshots an existing database, applies migrations, switches `current`, and checks `/api/health`. First deployment creates an empty migrated database. Follow [Content publishing](../docs/publishing.md#publish-a-finished-edition) as user `sgp`, with `databaseUrl` in `publish.json` set to `file:/var/lib/sgp/sgp.sqlite`. Then, from a source checkout with dependencies and filesystem access to both the database and Minecraft account files, synchronize DiscordSRV with `DATABASE_URL=file:/var/lib/sgp/sgp.sqlite`, `DISCORDSRV_ACCOUNTS_PATH=/srv/minecraft/plugins/DiscordSRV/accounts.aof`, and `MINECRAFT_USERCACHE_PATH=/srv/minecraft/usercache.json`. The sync imports current Minecraft identities before applying Discord links, so it does not depend on an edition import. The standalone release contains only the serving runtime, not the import/sync tooling.

Check `https://YOUR_DOMAIN/api/health`, `/`, `/map`, live markers and Discord login before opening the site to players. Read failures with `journalctl -u sgp-website -u sgp-minecraft -u caddy`. Caddy forwards the public Host header to the website.

## Backups and recovery

Run one backup, then restore it into a new disposable directory before enabling the schedule:

```bash
sudo systemctl start sgp-backup
sudo bash -c 'set -a; source /etc/sgp/backup.env; set +a; python3 /srv/sgp/ops/host.py restore-check latest /var/tmp/sgp-restore-check'
sudo systemctl enable --now sgp-backup.timer
systemctl list-timers sgp-backup.timer
```

The default is daily at **05:00 UTC**. Each backup uses SQLite's online backup API, then stops Minecraft for the local world/plugin copy and restarts it before uploading. A server already stopped remains stopped. Downtime lasts as long as that copy takes; choose a schedule outside editions. Missed backups are not run automatically at boot. Leave enough free disk space for one full local copy of the server and release, plus database snapshots.

Encrypted backups contain the website release, SQLite snapshot, host settings, website secrets, worlds, plugins and resource pack. Generated BlueMap tiles at the default `bluemap/web/maps` path, caches and logs are excluded. Retention is 7 daily, 4 weekly and 6 monthly snapshots. Every successful run checks repository structure; `restore-check` downloads and verifies actual data, including SQLite integrity and foreign keys. Repeat a restore drill after hosting changes and periodically. Check backup failures with `systemctl --failed` and `journalctl -u sgp-backup`; external failure notifications still need an alert destination.

For host loss, prepare a replacement with this repository, recover your restic credentials, and run `restore-check` there. Its output identifies the restored snapshot directory. With the website, Minecraft and backup timer stopped, restore `minecraft/` into an empty server directory, `sgp.sqlite` into an empty state directory, `website/` into a new release directory, and `config/website.env` into `/etc/sgp/`. Apply the new host settings, restore service ownership (`sgp` for state, `minecraft` for server), keep secrets root-only, and activate that release. Start Minecraft and Caddy, verify the site, then re-enable backups. BlueMap regenerates omitted map tiles.

For a failed update, activation leaves the website stopped and prints the pre-deployment SQLite snapshot path. The `previous` symlink records the former release after a switch. Reactivating an older release is permitted only when its migrations match the database. If a migration changed the schema, stop the backup timer and website, preserve the entire failed state directory (including SQLite WAL/SHM files), and restore the pre-deployment snapshot into a fresh state directory as `sgp.sqlite`. Recreate its `next-cache` directory and `sgp` ownership, then activate the matching old release. Restoring this snapshot discards writes made after it; retain the failed database for reconciliation. Pre-deployment snapshots are local recovery aids, not off-machine backups; remove obsolete ones only after validating recovery.

References: [Next.js standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output), [Caddy HTTPS](https://caddyserver.com/docs/automatic-https), [SQLite backup API](https://sqlite.org/backup.html), [restic restore](https://restic.readthedocs.io/en/stable/050_restore.html).
