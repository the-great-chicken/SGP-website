import importlib.util
from contextlib import closing
import json
import os
from pathlib import Path
import platform
import shutil
import sqlite3
import subprocess
import tempfile
import sys
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("hosting", ROOT / "deploy/host.py")
hosting = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hosting)


class HostingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.config = {key: str(self.root / key) for key in ("app_root", "state_dir", "minecraft_dir", "config_dir", "map_archive_dir")}
        for directory in self.config.values():
            Path(directory).mkdir()
        (Path(self.config["map_archive_dir"]) / "public").mkdir()
        (Path(self.config["map_archive_dir"]) / "private/snapshots").mkdir(parents=True)
        self.db = Path(self.config["state_dir"]) / "sgp.sqlite"
        with closing(sqlite3.connect(self.db)) as db:
            db.executescript("CREATE TABLE __drizzle_migrations (hash TEXT, created_at INTEGER); CREATE TABLE example (value TEXT); INSERT INTO example VALUES ('retained');")
        self.release = self.root / "release"
        self.release.mkdir()
        (self.release / "public/bluemap").mkdir(parents=True)
        for name in ("server.js", "public/bluemap/sgp.js"):
            (self.release / name).write_text("fixture")
        (self.release / "release.json").write_text('{"revision":"fixture"}')
        minecraft = Path(self.config["minecraft_dir"])
        for name in ("server.properties", "paper.jar", "world/level.dat", "plugins/BlueMap/core.conf",
                     "plugins/BlueMap/packs/TGC/pack.mcmeta", "bluemap/web/maps/world/tile.json", "logs/latest.log"):
            (minecraft / name).parent.mkdir(parents=True, exist_ok=True)
            (minecraft / name).write_text("fixture")
        (Path(self.config["config_dir"]) / "website.env").write_text("TEST_SECRET=retained")
        (Path(self.config["config_dir"]) / "host.json").write_text(json.dumps(self.config))

    def tearDown(self):
        self.temp.cleanup()

    def test_sqlite_snapshot_includes_committed_wal_and_excludes_uncommitted_rows(self):
        database = sqlite3.connect(self.db)
        database.execute("PRAGMA journal_mode=WAL")
        database.execute("INSERT INTO example VALUES ('committed in WAL')")
        database.commit()
        database.execute("INSERT INTO example VALUES ('uncommitted')")
        snapshot = self.root / "snapshot.sqlite"
        hosting.sqlite_snapshot(self.db, snapshot)
        with closing(sqlite3.connect(snapshot)) as restored:
            self.assertEqual(restored.execute("SELECT value FROM example").fetchall(),
                             [("retained",), ("committed in WAL",)])
        database.close()

    def test_missing_database_does_not_create_empty_backup(self):
        with self.assertRaises(sqlite3.OperationalError):
            hosting.sqlite_snapshot(self.root / "missing.sqlite", self.root / "backup.sqlite")
        self.assertFalse((self.root / "missing.sqlite").exists())

    def stage(self, running):
        stage = self.root / "stage"
        stage.mkdir()
        states = ["active", "inactive"] if running else ["inactive", "inactive"]
        with patch.object(hosting, "service_state", side_effect=states), patch.object(hosting, "run") as commands:
            hosting.create_backup_stage(self.config, stage, self.release)
        return stage, [call.args for call in commands.call_args_list]

    def test_cold_copy_keeps_world_plugins_pack_secrets_and_excludes_generated_maps(self):
        stage, commands = self.stage(running=True)
        self.assertEqual(commands, [("systemctl", "stop", "sgp-minecraft.service"), ("systemctl", "start", "sgp-minecraft.service")])
        for path in ("minecraft/world/level.dat", "minecraft/plugins/BlueMap/core.conf", "minecraft/plugins/BlueMap/packs/TGC/pack.mcmeta", "config/website.env"):
            self.assertTrue((stage / path).is_file())
        self.assertFalse((stage / "minecraft/bluemap/web/maps").exists())
        self.assertFalse((stage / "minecraft/logs").exists())
        hosting.verify_restore(stage)

    def test_stopped_server_stays_stopped(self):
        _, commands = self.stage(running=False)
        self.assertEqual(commands, [])

    def test_copy_failure_restarts_previously_running_minecraft(self):
        stage = self.root / "stage"
        stage.mkdir()
        copy = hosting.shutil.copytree
        def fail_world(source, *args, **kwargs):
            if source == Path(self.config["minecraft_dir"]):
                raise OSError("disk full")
            return copy(source, *args, **kwargs)
        with patch.object(hosting, "service_state", side_effect=["active", "inactive"]), patch.object(hosting, "run") as commands, patch.object(hosting.shutil, "copytree", side_effect=fail_world):
            with self.assertRaisesRegex(OSError, "disk full"):
                hosting.create_backup_stage(self.config, stage, self.release)
        self.assertEqual(commands.call_args.args, ("systemctl", "start", "sgp-minecraft.service"))

    def test_restore_detects_database_corruption(self):
        stage, _ = self.stage(running=False)
        with (stage / "sgp.sqlite").open("ab") as db:
            db.write(b"corrupt")
        with self.assertRaisesRegex(ValueError, "checksum"):
            hosting.verify_restore(stage)

    def test_restore_refuses_existing_destination_before_running_restic(self):
        with patch.object(hosting, "run") as commands:
            with self.assertRaisesRegex(ValueError, "new directory"):
                hosting.restore_check("latest", self.root)
            commands.assert_not_called()

    def test_render_configures_every_service_without_secrets(self):
        config = hosting.load_config(ROOT / "deploy/host.example.json")
        output = self.root / "rendered"
        hosting.render(config, output)
        for file in output.iterdir():
            self.assertNotRegex(file.read_text(), r"@[a-z_]+@")
        website = (output / "sgp-website.service").read_text()
        self.assertIn("Environment=HOSTNAME=127.0.0.1", website)
        self.assertIn("Environment=DATABASE_URL=file:/var/lib/sgp/sgp.sqlite", website)
        self.assertIn("Environment=BLUEMAP_INTERNAL_URL=http://127.0.0.1:8100", website)
        self.assertIn("Environment=MAP_ARCHIVE_DIR=/srv/map-archive", website)
        self.assertIn("EnvironmentFile=/etc/sgp/website.env", website)
        self.assertNotIn("TEST_SECRET", website)
        caddy = (output / "Caddyfile").read_text()
        self.assertIn("sgp.example.com", caddy)
        self.assertIn("handle /map {", caddy)
        self.assertIn("handle /map/ {", caddy)
        self.assertIn("respond 404", caddy)
        self.assertIn("handle_path /map/*", caddy)
        self.assertIn("handle_path /map-archive/*", caddy)
        self.assertIn('Cache-Control "public, max-age=31536000, immutable"', caddy)
        self.assertIn('Cache-Control "no-cache"', caddy)
        self.assertIn("encode zstd gzip", caddy)
        self.assertIn("root * /srv/map-archive/public", caddy)

    def test_config_rejects_overlapping_paths_and_line_injection(self):
        config = json.loads((ROOT / "deploy/host.example.json").read_text())
        for key, value in (("state_dir", "/srv/sgp/data"), ("domain", "example.com\nadmin off"), ("backup_schedule", "daily\nExecStart=bad")):
            candidate = dict(config, **{key: value})
            path = self.root / "host.json"
            path.write_text(json.dumps(candidate))
            with self.assertRaises(ValueError):
                hosting.load_config(path)

    def test_package_excludes_traced_env_and_database_and_includes_public_assets(self):
        source = self.root / "source"
        files = {".next/standalone/server.js": "fixture", ".next/standalone/package.json": "{}",
                 ".next/standalone/.env": "SECRET=do-not-ship", ".next/standalone/.data/sgp.sqlite": "private",
                 ".next/standalone/node_modules/fixture/index.js": "fixture", ".next/standalone/.next/server/fixture.js": "fixture",
                 ".next/static/chunk.js": "fixture", "public/bluemap/sgp.js": "theme",
                 "node_modules/drizzle-orm/migrator.js": "migration runner", "drizzle/meta/_journal.json": "{}",
                 "data/kit-manifest.json": "{}", "data/cosmetic-renders.json": "{}", "data/statistics-snapshot.json": "do-not-ship",
                 ".node-version": "24.20.0", "package-lock.json": "{}"}
        for name, contents in files.items():
            (source / name).parent.mkdir(parents=True, exist_ok=True)
            (source / name).write_text(contents)
        def command(*args, **kwargs):
            return subprocess.CompletedProcess(args, 0, stdout="fixture" if args[0] == "git" else "v24.20.0")
        output = self.root / "packaged"
        with patch.object(hosting, "run", side_effect=command):
            hosting.package(source, output)
        self.assertFalse((output / ".env").exists())
        self.assertFalse((output / ".data").exists())
        self.assertFalse((output / "data/statistics-snapshot.json").exists())
        self.assertTrue((output / "public/bluemap/sgp.js").is_file())
        self.assertTrue((output / "drizzle/meta/_journal.json").is_file())
        self.assertTrue((output / "data/kit-manifest.json").is_file())
        self.assertTrue((output / "data/cosmetic-renders.json").is_file())
        self.assertTrue((output / "migrate.mjs").is_file())

    def prepare_activation(self):
        release = Path(self.config["app_root"]) / "releases/candidate"
        shutil.copytree(self.release, release)
        (release / ".next").mkdir()
        (release / "release.json").write_text(json.dumps({"platform": "linux", "architecture": platform.machine(), "node_version": "24.20.0"}))
        self.config.update(node="node", website_port=3000)
        return release

    @unittest.skipUnless(sys.platform == "linux", "Linux host operations")
    def test_incompatible_migration_leaves_website_running(self):
        release = self.prepare_activation()
        with patch.object(hosting, "run", return_value=subprocess.CompletedProcess([], 0, stdout="v24.20.0")) as commands, patch.object(hosting, "migrate", side_effect=RuntimeError("incompatible schema")):
            with self.assertRaisesRegex(RuntimeError, "incompatible schema"):
                hosting.activate(self.config, release)
        self.assertFalse(any(call.args[0] == "systemctl" for call in commands.call_args_list))

    @unittest.skipUnless(sys.platform == "linux", "Linux host operations")
    def test_snapshot_failure_does_not_run_migrations_or_switch_release(self):
        release = self.prepare_activation()
        with patch.object(hosting, "run", return_value=subprocess.CompletedProcess([], 0, stdout="v24.20.0")) as commands, patch.object(hosting, "migrate") as migration, patch.object(hosting, "sqlite_snapshot", side_effect=OSError("disk full")):
            with self.assertRaisesRegex(OSError, "disk full"):
                hosting.activate(self.config, release)
        migration.assert_called_once_with(self.config, release, check=True)
        self.assertFalse((Path(self.config["app_root"]) / "current").exists())
        self.assertEqual(commands.call_args.args, ("systemctl", "stop", "sgp-website.service"))

    @unittest.skipUnless(sys.platform == "linux", "Linux host operations")
    def test_failed_health_check_keeps_recovery_snapshot_and_stops_website(self):
        release = self.prepare_activation()
        with patch.object(hosting, "run", return_value=subprocess.CompletedProcess([], 0, stdout="v24.20.0")) as commands, patch.object(hosting, "migrate"), patch.object(hosting, "urlopen", side_effect=OSError("unavailable")), patch.object(hosting.time, "sleep"):
            with self.assertRaisesRegex(RuntimeError, "health check failed"):
                hosting.activate(self.config, release)
        self.assertEqual(commands.call_args.args, ("systemctl", "stop", "sgp-website.service"))
        snapshots = list((Path(self.config["state_dir"]) / "predeploy").glob("*.sqlite"))
        self.assertEqual(len(snapshots), 1)
        with closing(sqlite3.connect(snapshots[0])) as database:
            self.assertEqual(database.execute("SELECT value FROM example").fetchall(), [("retained",)])

    @unittest.skipUnless(sys.platform == "linux", "Linux host operations")
    def test_failed_upload_does_not_prune_backups_and_minecraft_has_restarted(self):
        (Path(self.config["app_root"]) / "current").symlink_to(self.release)
        calls = []
        def command(*args, **kwargs):
            calls.append(args)
            if args[:2] == ("restic", "backup"):
                raise subprocess.CalledProcessError(1, args)
        with patch.dict(os.environ, RESTIC_REPOSITORY="fixture", RESTIC_PASSWORD_FILE="fixture"), patch.object(hosting, "service_state", side_effect=["active", "inactive"]), patch.object(hosting, "run", side_effect=command):
            with self.assertRaises(subprocess.CalledProcessError):
                hosting.backup(self.config)
        self.assertIn(("systemctl", "start", "sgp-minecraft.service"), calls)
        self.assertFalse(any(call[:2] == ("restic", "forget") for call in calls))
        self.assertEqual(list(Path(self.config["state_dir"]).glob("backup-*")), [])

    def test_snapshot_world_cold_copies_configured_level_and_restarts_server(self):
        minecraft = Path(self.config["minecraft_dir"])
        (minecraft / "server.properties").write_text("level-name=world\n")
        (minecraft / "world/datapacks/SGP/data.txt").parent.mkdir(parents=True)
        (minecraft / "world/datapacks/SGP/data.txt").write_text("frozen")
        target = Path(self.config["map_archive_dir"]) / "private/snapshots/edition-5-test"
        with patch.object(hosting, "service_state", side_effect=["active", "inactive"]), patch.object(hosting, "run") as commands:
            hosting.snapshot_world(self.config, target)
        self.assertEqual((target / "datapacks/SGP/data.txt").read_text(), "frozen")
        self.assertEqual([call.args for call in commands.call_args_list], [
            ("systemctl", "stop", "sgp-minecraft.service"),
            ("systemctl", "start", "sgp-minecraft.service"),
            ("chown", "-R", "sgp:sgp", target),
        ])

    def test_snapshot_world_restarts_after_copy_failure_and_removes_partial_target(self):
        target = Path(self.config["map_archive_dir"]) / "private/snapshots/edition-5-failure"
        original = hosting.shutil.copytree
        def fail(source, destination, *args, **kwargs):
            if source == Path(self.config["minecraft_dir"]) / "world":
                Path(destination).mkdir()
                raise OSError("disk full")
            return original(source, destination, *args, **kwargs)
        with patch.object(hosting, "service_state", side_effect=["active", "inactive"]), patch.object(hosting, "run") as commands, patch.object(hosting.shutil, "copytree", side_effect=fail):
            with self.assertRaisesRegex(OSError, "disk full"):
                hosting.snapshot_world(self.config, target)
        self.assertFalse(target.exists())
        self.assertEqual(commands.call_args.args, ("systemctl", "start", "sgp-minecraft.service"))

    def test_snapshot_world_removes_copy_if_ownership_transfer_fails(self):
        target = Path(self.config["map_archive_dir"]) / "private/snapshots/edition-5-chown-failure"
        def command(*args, **kwargs):
            if args[:2] == ("chown", "-R"):
                raise subprocess.CalledProcessError(1, args)
            return subprocess.CompletedProcess(args, 0)
        with patch.object(hosting, "service_state", side_effect=["inactive", "inactive"]), patch.object(hosting, "run", side_effect=command):
            with self.assertRaises(subprocess.CalledProcessError):
                hosting.snapshot_world(self.config, target)
        self.assertFalse(target.exists())

    def test_snapshot_world_rejects_targets_outside_archive_snapshot_directory(self):
        target = self.root / "elsewhere/edition-5-test"
        with patch.object(hosting, "service_state") as state, patch.object(hosting, "run") as commands:
            with self.assertRaises(ValueError):
                hosting.snapshot_world(self.config, target)
        state.assert_not_called()
        commands.assert_not_called()

    def test_archive_lock_recovers_after_dead_owner(self):
        private = Path(self.config["map_archive_dir"]) / "private"
        (private / "archive.lock").write_text("node:99999999\n")
        with hosting.archive_lock(self.config):
            self.assertTrue((private / "archive.lock").is_file())
        self.assertFalse((private / "archive.lock").exists())

    def test_backup_includes_valid_map_archive_but_not_private_renderer_state(self):
        public = Path(self.config["map_archive_dir"]) / "public"
        revision = public / "editions/edition-1/r1"
        for name in (
            "index.html",
            "settings.json",
            "maps/world/settings.json",
            "sgp-archive.json",
            "bluemap-archive.css",
            "bluemap-archive.js",
            "maps/world/tiles/0/x0/z0.prbm.gz",
        ):
            (revision / name).parent.mkdir(parents=True, exist_ok=True)
            (revision / name).write_text("{}")
        (public / "manifest.json").write_text(json.dumps({"schemaVersion": 1, "editions": {"edition-1": {
            "snapshotKey": "edition-1", "revision": "r1", "webPath": "editions/edition-1/r1"
        }}}))
        (Path(self.config["map_archive_dir"]) / "private/bluemap").mkdir()
        (Path(self.config["map_archive_dir"]) / "private/bluemap/bluemap.jar").write_text("large renderer")
        stage, _ = self.stage(running=False)
        self.assertTrue((stage / "map-archive/public/editions/edition-1/r1/index.html").is_file())
        self.assertFalse((stage / "map-archive/private").exists())
        hosting.verify_restore(stage)

    def test_restore_rejects_archive_manifest_traversal(self):
        public = Path(self.config["map_archive_dir"]) / "public"
        (public / "manifest.json").write_text(json.dumps({"schemaVersion": 1, "editions": {"edition-1": {
            "snapshotKey": "edition-1", "revision": "r1", "webPath": "../private"
        }}}))
        stage = self.root / "bad-stage"
        stage.mkdir()
        with patch.object(hosting, "service_state", side_effect=["inactive", "inactive"]):
            with self.assertRaisesRegex(ValueError, "unsafe"):
                hosting.create_backup_stage(self.config, stage, self.release)

    @unittest.skipUnless(sys.platform == "linux" and shutil.which("restic"), "Requires Linux and restic")
    def test_encrypted_restic_backup_and_verified_restore(self):
        password = self.root / "password"
        password.write_text("disposable-test-password")
        (Path(self.config["app_root"]) / "current").symlink_to(self.release)
        with patch.dict(os.environ, RESTIC_REPOSITORY=str(self.root / "repository"), RESTIC_PASSWORD_FILE=str(password), RESTIC_CACHE_DIR=str(self.root / "cache")), patch.object(hosting, "service_state", side_effect=["inactive", "inactive"]):
            hosting.run("restic", "init", stdout=subprocess.DEVNULL)
            hosting.backup(self.config)
            target = self.root / "restored"
            hosting.restore_check("latest", target)
        restored = next(target.rglob("sgp.sqlite"))
        with closing(sqlite3.connect(restored)) as database:
            self.assertEqual(database.execute("SELECT value FROM example").fetchall(), [("retained",)])
        self.assertEqual(next(target.rglob("level.dat")).read_text(), "fixture")


if __name__ == "__main__":
    unittest.main()
