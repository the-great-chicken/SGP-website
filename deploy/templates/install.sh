#!/usr/bin/env bash
set -euo pipefail
[[ $EUID == 0 ]] || { echo "Run with sudo on the intended Linux host." >&2; exit 1; }
[[ $# == 1 ]] || { echo "Usage: sudo bash rendered/install.sh /path/to/repository/deploy" >&2; exit 2; }
source_dir=$(realpath "$1")
cd "$(dirname "$0")"
test -f "$source_dir/host.py"
test -x @node@
test -x @java@
caddy adapt --config Caddyfile --adapter caddyfile --validate >/dev/null
systemd-analyze calendar '@backup_schedule@' >/dev/null
systemd-analyze verify ./sgp-*.service ./sgp-backup.timer
for account in sgp minecraft; do
    if ! id "$account" >/dev/null 2>&1; then
        useradd --system --user-group --no-create-home --shell /usr/sbin/nologin "$account"
    fi
done
install -d -m 0755 @app_root@ @app_root@/ops @app_root@/releases
install -d -o sgp -g sgp -m 0700 @state_dir@ @state_dir@/next-cache
install -d -o minecraft -g minecraft -m 0750 @minecraft_dir@
install -d -m 0700 @config_dir@
install -m 0644 "$source_dir/host.py" @app_root@/ops/host.py
install -m 0600 host.json @config_dir@/host.json
for name in website backup; do
    install -m 0600 "$name.env.example" "@config_dir@/$name.env.example"
    if [[ ! -e "@config_dir@/$name.env" ]]; then
        install -m 0600 "$name.env.example" "@config_dir@/$name.env"
    fi
done
if [[ ! -e @config_dir@/restic-password ]]; then
    (umask 077; openssl rand -base64 48 > @config_dir@/restic-password)
fi
install -m 0644 sgp-*.service sgp-backup.timer /etc/systemd/system/
if [[ -f /etc/caddy/Caddyfile ]]; then
    cp -p /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.before-sgp.$(date +%s)"
fi
install -m 0644 Caddyfile /etc/caddy/Caddyfile
systemctl daemon-reload
echo 'Configuration installed. Fill secrets and restore/copy Minecraft before starting services; see deploy/README.md.'
