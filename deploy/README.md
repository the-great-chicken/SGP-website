# Linux hosting

Production runs Caddy, the Next.js website, Paper/BlueMap, SQLite, and the external historical map archive on one Linux host. The examples below use the default paths from `deploy/host.example.json`.

## Prepare the host

Install the host dependencies:

```bash
sudo apt update
sudo apt install caddy restic openjdk-25-jre-headless python3 python3-venv curl xz-utils openssl
```

Install the exact Node version from `.node-version` at `/opt/node`, then copy `deploy/host.example.json` to the ignored `deploy/host.json` and edit it for the host.

Generate and install the host configuration:

```bash
python3 deploy/host.py render
sudo bash deploy/rendered/install.sh "$PWD/deploy"
sudoedit /etc/sgp/website.env
sudoedit /etc/sgp/backup.env
```

`website.env` holds website secrets. `backup.env` configures an off-machine restic repository. Keep the restic credentials and `/etc/sgp/restic-password` somewhere independent from the server.

Initialize a new backup repository once:

```bash
sudo bash -c 'set -a; source /etc/sgp/backup.env; set +a; restic init'
```

Expose only HTTPS and the Minecraft game port publicly. Website, BlueMap, and cosmetics bridge ports stay on loopback.

## Minecraft and BlueMap

Copy the complete Minecraft server into `/srv/minecraft`, make it owned by `minecraft`, and run it through `sgp-minecraft.service`.

Use **BlueMap 5.24** with its webserver bound to loopback at the configured BlueMap port. Apply the website integration from [Live map](../docs/map.md).

Keep the cosmetics bridge on loopback and use the same bridge secret as `website.env`.

The installer also prepares `/srv/map-archive` and the restricted `snapshot-world` helper used during edition publishing. Historical archive setup is documented in [Historical 3D map archive](../docs/map-archive.md).

## Build and activate a release

Build on Linux with the same CPU architecture as production. Use a clean checkout, copy in the generated current-content files, and run:

```bash
export PATH="/opt/node/bin:$PATH"
bash deploy/build-release.sh /tmp/sgp-release
```

Transfer the resulting release directory under `/srv/sgp/releases/<unique-name>`, then activate it:

```bash
sudo python3 /srv/sgp/ops/host.py --config /etc/sgp/host.json activate /srv/sgp/releases/<unique-name>
sudo systemctl enable sgp-website sgp-minecraft
sudo systemctl start sgp-minecraft
sudo systemctl enable --now caddy
sudo systemctl reload caddy
```

Activation applies migrations, switches the current release, and checks `/api/health`. Publish content separately from a source checkout as user `sgp`; see [Content publishing](../docs/publishing.md).

After deployment, verify `/api/health`, `/`, `/map`, live markers, and Discord login. Service logs are available through:

```bash
journalctl -u sgp-website -u sgp-minecraft -u caddy
```

## Backups and recovery

Test one backup and restore before enabling the schedule:

```bash
sudo systemctl start sgp-backup
sudo bash -c 'set -a; source /etc/sgp/backup.env; set +a; python3 /srv/sgp/ops/host.py restore-check latest /var/tmp/sgp-restore-check'
sudo systemctl enable --now sgp-backup.timer
```

Backups include the website release, SQLite, host configuration/secrets, Minecraft worlds/plugins/resource pack, and published historical map revisions. Live BlueMap tiles, caches/logs, archive renderer JARs, staging data, and temporary publication snapshots are excluded.

For host loss, prepare a replacement host, run `restore-check`, then restore the returned snapshot's website, database, Minecraft directory, `map-archive/public`, and website configuration to their configured locations before activating the restored release.

For a failed release activation, use the pre-deployment SQLite snapshot reported by the activation command and reactivate the matching previous release. Do not run an older release against a database schema it does not support.
