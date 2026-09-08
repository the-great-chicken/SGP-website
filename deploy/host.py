"""Prepare and operate the Linux SGP host. Rendering and packaging never install services."""

import argparse
from contextlib import closing, contextmanager
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import shutil
import signal
import sqlite3
import subprocess
import sys
import time
import tempfile
from urllib.request import urlopen


HERE = Path(__file__).resolve().parent


def run(*args, **kwargs):
    return subprocess.run([str(arg) for arg in args], check=True, **kwargs)


def digest(path):
    with Path(path).open("rb") as source:
        return hashlib.file_digest(source, "sha256").hexdigest()


def load_config(path):
    config = json.loads(Path(path).read_text())
    for key in ("app_root", "state_dir", "config_dir", "minecraft_dir", "node", "java"):
        if not re.fullmatch(r"/[A-Za-z0-9_./-]+", config[key]) or ".." in Path(config[key]).parts:
            raise ValueError(f"{key} must be an absolute Linux path without spaces or traversal")
    roots = [Path(config[key]) for key in ("app_root", "state_dir", "config_dir", "minecraft_dir")]
    for index, root in enumerate(roots):
        if root == Path("/") or any(root.is_relative_to(other) or other.is_relative_to(root) for other in roots[index + 1:]):
            raise ValueError("Application, state, configuration and Minecraft directories must be separate")
    if not re.fullmatch(r"[a-zA-Z0-9.-]+", config["domain"]):
        raise ValueError("domain must be a hostname without a scheme or path")
    if not re.fullmatch(r"[1-9][0-9]*[MG]", config["minecraft_heap"]):
        raise ValueError("minecraft_heap must be a Java heap size, such as 6G")
    for key in ("website_port", "bluemap_port"):
        if type(config[key]) is not int or not 1024 <= config[key] <= 65535:
            raise ValueError(f"{key} must be an unprivileged port")
    if config["website_port"] == config["bluemap_port"]:
        raise ValueError("Website and BlueMap need different ports")
    if not re.fullmatch(r"[A-Za-z0-9*,:./~ +_-]+", config["backup_schedule"]):
        raise ValueError("backup_schedule must be a single systemd calendar expression")
    return config


def render(config, output):
    output.mkdir(parents=True, exist_ok=True)
    for template in (HERE / "templates").iterdir():
        contents = template.read_text()
        for key, value in config.items():
            contents = contents.replace(f"@{key}@", str(value))
        (output / template.name).write_text(contents, newline="\n")
    caddy = (HERE / "Caddyfile").read_text()
    caddy = caddy.replace("{$SGP_DOMAIN}", config["domain"])
    caddy = caddy.replace("{$SGP_BLUEMAP_PORT:8100}", str(config["bluemap_port"]))
    caddy = caddy.replace("{$SGP_WEBSITE_PORT:3000}", str(config["website_port"]))
    (output / "Caddyfile").write_text(caddy, newline="\n")
    (output / "host.json").write_text(json.dumps(config, indent=2) + "\n")


def package(source, output):
    source, output = source.resolve(), output.absolute()
    if output.exists() or output.is_relative_to(source):
        raise ValueError("Use a new release directory outside the source checkout")
    if any(path.name != ".env.example" for path in source.glob(".env*")):
        raise ValueError("Build and package from a checkout without .env files")
    standalone = source / ".next/standalone"
    for name in ("server.js", "package.json", "node_modules", ".next"):
        if not (standalone / name).exists():
            raise ValueError(f"Missing standalone build component: {name}")
    revision = run("git", "rev-parse", "HEAD", cwd=source, capture_output=True, text=True).stdout.strip()
    node_version = run("node", "--version", capture_output=True, text=True).stdout.strip().removeprefix("v")
    if node_version != (source / ".node-version").read_text().strip():
        raise ValueError("Build and package with the pinned Node version")
    output.mkdir(parents=True)
    # Copy only runtime components. Next's trace may include .env and a development database.
    for name in ("server.js", "package.json"):
        shutil.copy2(standalone / name, output / name)
    for name in ("node_modules", ".next"):
        shutil.copytree(standalone / name, output / name, ignore=shutil.ignore_patterns(".env*", ".data", "cache"))
    shutil.copytree(source / ".next/static", output / ".next/static", dirs_exist_ok=True)
    shutil.copytree(source / "public", output / "public")
    # Migrations aren't reached by Next's runtime trace; include the complete locked package.
    shutil.copytree(source / "node_modules/drizzle-orm", output / "node_modules/drizzle-orm", dirs_exist_ok=True)
    shutil.copytree(source / "drizzle", output / "drizzle")
    shutil.copy2(HERE / "migrate.mjs", output / "migrate.mjs")
    (output / "data").mkdir()
    for name in ("kit-manifest.json", "item-renders.json", "cosmetic-renders.json"):
        if (source / "data" / name).exists():
            shutil.copy2(source / "data" / name, output / "data" / name)
    metadata = {"revision": revision, "node_version": node_version, "platform": sys.platform,
                "architecture": platform.machine(), "lock_sha256": digest(source / "package-lock.json")}
    (output / "release.json").write_text(json.dumps(metadata, indent=2) + "\n")
    # Release code is root-owned on the host but readable by the website service.
    for directory, _, files in os.walk(output):
        Path(directory).chmod(0o755)
        for name in files:
            path = Path(directory) / name
            path.chmod(0o755 if path.stat().st_mode & 0o111 else 0o644)
    print(f"Prepared release: {output}")


def sqlite_snapshot(source, destination):
    # mode=ro fails on a missing DB rather than silently backing up a newly created empty database.
    with closing(sqlite3.connect(source.resolve().as_uri() + "?mode=ro", uri=True)) as database:
        with closing(sqlite3.connect(destination)) as snapshot:
            database.backup(snapshot)
            if snapshot.execute("PRAGMA integrity_check").fetchall() != [("ok",)]:
                raise RuntimeError("SQLite snapshot failed integrity_check")


@contextmanager
def host_lock(config):
    import fcntl
    with (Path(config["state_dir"]) / "operations.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        yield


def service_state(name):
    result = subprocess.run(["systemctl", "show", name, "--property=ActiveState", "--value"],
                            check=True, capture_output=True, text=True)
    state = result.stdout.strip()
    if state not in ("active", "inactive", "failed"):
        raise RuntimeError(f"{name} is {state}; wait for it to settle")
    if state != "active":
        pid = run("systemctl", "show", name, "--property=MainPID", "--value", capture_output=True, text=True).stdout.strip()
        if pid != "0":
            raise RuntimeError(f"{name} still has a running process")
    return state


def migrate(config, release, check=False):
    args = ["runuser", "-u", "sgp", "--", "env", f"DATABASE_URL=file:{config['state_dir']}/sgp.sqlite",
            config["node"], "migrate.mjs"]
    if check:
        args.append("--check")
    run(*args, cwd=release)


def activate(config, release):
    root = Path(config["app_root"])
    release = release.resolve(strict=True)
    if release.parent != (root / "releases").resolve():
        raise ValueError("Release must be directly inside app_root/releases")
    metadata = json.loads((release / "release.json").read_text())
    actual_node = run(config["node"], "--version", capture_output=True, text=True).stdout.strip()
    if metadata["platform"] != "linux" or metadata["architecture"] != platform.machine() or actual_node != "v" + metadata["node_version"]:
        raise ValueError("Release platform, architecture and Node version must match this host")
    db = Path(config["state_dir"]) / "sgp.sqlite"
    current = root / "current"
    with host_lock(config):
        # Reject an incompatible rollback while the existing website is still available.
        if db.exists():
            migrate(config, release, check=True)
        run("systemctl", "stop", "sgp-website.service")
        recovery = None
        try:
            if db.exists():
                snapshot_path = Path(config["state_dir"]) / "predeploy" / datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%f.sqlite")
                snapshot_path.parent.mkdir(mode=0o700, exist_ok=True)
                sqlite_snapshot(db, snapshot_path)
                recovery = snapshot_path
            migrate(config, release)
            cache = release / ".next/cache"
            if not cache.is_symlink():
                cache.symlink_to(Path(config["state_dir"]) / "next-cache")
            if current.is_symlink() and current.resolve() != release:
                previous = root / ".previous-next"
                previous.symlink_to(current.resolve())
                previous.replace(root / "previous")
            pending = root / ".current-next"
            pending.symlink_to(release)
            pending.replace(current)
            run("systemctl", "start", "sgp-website.service")
            for _ in range(15):
                try:
                    with urlopen(f"http://127.0.0.1:{config['website_port']}/api/health", timeout=2) as response:
                        if response.status == 200 and json.load(response) == {"status": "ok"}:
                            print(f"Activated {release.name}")
                            return
                except (OSError, ValueError):
                    pass
                time.sleep(1)
            raise RuntimeError("Website health check failed")
        except BaseException:
            run("systemctl", "stop", "sgp-website.service")
            print(f"Activation failed; website left stopped. Pre-deployment database: {recovery}", file=sys.stderr)
            raise


def backup(config):
    if not os.environ.get("RESTIC_REPOSITORY") or not os.environ.get("RESTIC_PASSWORD_FILE"):
        raise ValueError("RESTIC_REPOSITORY and RESTIC_PASSWORD_FILE are required")
    state = Path(config["state_dir"])
    minecraft = Path(config["minecraft_dir"])
    with host_lock(config):
        release = (Path(config["app_root"]) / "current").resolve(strict=True)
        for path in (state / "sgp.sqlite", minecraft / "server.properties", minecraft / "paper.jar",
                     Path(config["config_dir"]) / "website.env", release / "release.json"):
            if not path.is_file():
                raise ValueError(f"Required backup source is missing: {path}")
        # Verify credentials and repository availability before interrupting Minecraft.
        run("restic", "snapshots", "--latest", "1", stdout=subprocess.DEVNULL)
        with tempfile.TemporaryDirectory(prefix="backup-", dir=state) as staging:
            stage = Path(staging)
            create_backup_stage(config, stage, release)
            run("restic", "backup", "--tag", "sgp", stage)
            # Group by tag/host because each staging path is temporary.
            run("restic", "forget", "--tag", "sgp", "--group-by", "host,tags",
                "--keep-daily", "7", "--keep-weekly", "4", "--keep-monthly", "6", "--prune")
            run("restic", "check")
        print("Backup completed; repository check passed")


def create_backup_stage(config, stage, release):
    state = Path(config["state_dir"])
    minecraft = Path(config["minecraft_dir"])
    sqlite_snapshot(state / "sgp.sqlite", stage / "sgp.sqlite")
    shutil.copytree(release, stage / "website", ignore=shutil.ignore_patterns("cache"))
    (stage / "config").mkdir()
    for name in ("host.json", "website.env"):
        shutil.copy2(Path(config["config_dir"]) / name, stage / "config" / name)
    running = service_state("sgp-minecraft.service") == "active"
    try:
        if running:
            run("systemctl", "stop", "sgp-minecraft.service")
        if service_state("sgp-minecraft.service") == "active":
            raise RuntimeError("Minecraft must be stopped before copying its files")
        def exclude(directory, names):
            relative = Path(directory).relative_to(minecraft)
            if relative == Path("."):
                return set(names) & {"logs", "crash-reports", "cache", "libraries", "versions"}
            if relative == Path("bluemap"):
                return set(names) & {"logs"}
            if relative == Path("bluemap/web"):
                return set(names) & {"maps"}
            return set()
        shutil.copytree(minecraft, stage / "minecraft", ignore=exclude)
    finally:
        if running:
            run("systemctl", "start", "sgp-minecraft.service")
    manifest = {"created_at": datetime.now(timezone.utc).isoformat(),
                "database_sha256": digest(stage / "sgp.sqlite"),
                "release": json.loads((release / "release.json").read_text())}
    (stage / "backup.json").write_text(json.dumps(manifest, indent=2) + "\n")


def verify_restore(snapshot):
    metadata = json.loads((snapshot / "backup.json").read_text())
    db = snapshot / "sgp.sqlite"
    if digest(db) != metadata["database_sha256"]:
        raise ValueError("Restored database checksum does not match")
    with closing(sqlite3.connect(db.resolve().as_uri() + "?mode=ro", uri=True)) as database:
        if database.execute("PRAGMA integrity_check").fetchall() != [("ok",)]:
            raise ValueError("Restored database failed integrity_check")
        if database.execute("PRAGMA foreign_key_check").fetchall():
            raise ValueError("Restored database has foreign-key violations")
        database.execute("SELECT count(*) FROM __drizzle_migrations").fetchone()
    for name in ("website/server.js", "website/public/bluemap/sgp.js", "config/website.env",
                 "minecraft/server.properties", "minecraft/paper.jar"):
        if not (snapshot / name).is_file():
            raise ValueError(f"Restored snapshot is missing {name}")
    if json.loads((snapshot / "website/release.json").read_text()) != metadata["release"]:
        raise ValueError("Restored release does not match backup metadata")
    print(f"Restored files and SQLite verified: {snapshot}")


def restore_check(snapshot_id, target):
    if target.exists():
        raise ValueError("Restore target must be a new directory")
    run("restic", "restore", snapshot_id, "--tag", "sgp", "--target", target, "--verify")
    candidates = list(target.rglob("backup.json"))
    candidates = [path.parent for path in candidates if (path.parent / "sgp.sqlite").is_file()]
    if len(candidates) != 1:
        raise ValueError("Expected exactly one SGP backup in the restored snapshot")
    verify_restore(candidates[0])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, default=HERE / "host.json")
    commands = parser.add_subparsers(dest="command", required=True)
    render_args = commands.add_parser("render")
    render_args.add_argument("--output", type=Path, default=HERE / "rendered")
    package_args = commands.add_parser("package")
    package_args.add_argument("--source", type=Path, required=True)
    package_args.add_argument("--output", type=Path, required=True)
    activation = commands.add_parser("activate")
    activation.add_argument("release", type=Path)
    commands.add_parser("backup")
    restore = commands.add_parser("restore-check")
    restore.add_argument("snapshot")
    restore.add_argument("target", type=Path)
    args = parser.parse_args()
    if args.command == "package":
        package(args.source, args.output)
    elif args.command == "restore-check":
        restore_check(args.snapshot, args.target)
    else:
        config = load_config(args.config)
        if args.command == "render":
            render(config, args.output)
        elif args.command == "activate":
            activate(config, args.release)
        elif args.command == "backup":
            # systemd stop/SIGTERM should unwind the copy and restart a previously running server.
            def interrupted(_signum, _frame):
                raise KeyboardInterrupt("Backup interrupted")
            signal.signal(signal.SIGTERM, interrupted)
            backup(config)


if __name__ == "__main__":
    os.umask(0o077)
    try:
        main()
    except (ValueError, RuntimeError, OSError, sqlite3.Error, subprocess.CalledProcessError) as error:
        sys.exit(str(error))
