from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from jsonschema import Draft202012Validator

from sgp_kit_exporter import ExportError, export_manifest, render_manifest


REPOSITORY = Path(__file__).resolve().parents[1]
FIXTURE_DATAPACK = REPOSITORY / "tests/fixtures/datapack"
SCHEMA = json.loads(
    (REPOSITORY / "schemas/kit-manifest.schema.json").read_text(encoding="utf-8")
)


class ExporterTests(unittest.TestCase):
    def test_exports_multiline_items_to_schema_valid_json(self) -> None:
        manifest = export_manifest(FIXTURE_DATAPACK, "26.1")
        Draft202012Validator(SCHEMA).validate(manifest)

        self.assertEqual(manifest["schemaVersion"], 2)
        self.assertEqual(manifest["dataPack"]["minFormat"], 101.1)
        self.assertEqual(len(manifest["kits"]), 1)

        kit = manifest["kits"][0]
        self.assertEqual(kit["id"], 3)
        self.assertEqual(kit["name"], "Exemple")
        self.assertEqual(kit["color"], "aqua")
        self.assertEqual(kit["ability"]["path"], "test_dash")
        self.assertEqual(kit["ability"]["name"], "Ruée d’essai")
        self.assertEqual(
            kit["ability"]["description"],
            "Fait avancer le joueur pour tester l’export.",
        )
        self.assertEqual(kit["ability"]["activationKeybind"], "key.drop")

        operations = kit["operations"]
        self.assertEqual(len(operations), 2)
        self.assertEqual(operations[0]["kind"], "give")
        self.assertEqual(operations[0]["item"]["id"], "minecraft:trident")
        self.assertEqual(operations[0]["item"]["count"], 17)
        self.assertIs(
            operations[0]["item"]["components"]["minecraft:custom_data"]["enabled"],
            True,
        )
        self.assertEqual(operations[1]["slot"], "armor.feet")
        self.assertEqual(operations[1]["item"]["count"], 1)

        rendered = render_manifest(manifest)
        self.assertEqual(rendered, render_manifest(export_manifest(FIXTURE_DATAPACK, "26.1")))
        self.assertIn("Test trident", rendered)

    def test_rejects_unsupported_loadout_commands(self) -> None:
        with self.assertRaisesRegex(ExportError, "unsupported loadout command"):
            self._export_function("say this-does-not-belong-here")

    def test_rejects_non_self_target(self) -> None:
        with self.assertRaisesRegex(ExportError, "plain @s selector"):
            self._export_function("give @a stone")

    def test_rejects_duplicate_explicit_slots(self) -> None:
        with self.assertRaisesRegex(ExportError, "was already assigned"):
            self._export_function(
                "item replace entity @s hotbar.0 with stone\n"
                "item replace entity @s hotbar.0 with dirt"
            )

    def test_rejects_empty_loadouts(self) -> None:
        with self.assertRaisesRegex(ExportError, "contains no item operations"):
            self._export_function("# Empty loadouts are not publishable")

    def _export_function(self, contents: str) -> dict[str, object]:
        with tempfile.TemporaryDirectory() as temporary_directory:
            datapack = Path(temporary_directory)
            (datapack / "pack.mcmeta").write_text(
                json.dumps(
                    {
                        "id": "test",
                        "pack": {
                            "description": "test",
                            "min_format": 101.1,
                            "max_format": 101.1,
                        },
                    }
                ),
                encoding="utf-8",
            )
            function_directory = (
                datapack
                / "data/sgp.kits/function/collection/example"
            )
            function_directory.mkdir(parents=True)
            (function_directory / "items.mcfunction").write_text(
                contents,
                encoding="utf-8",
            )
            initialization = (
                datapack / "data/sgp.kits/function/initialization.mcfunction"
            )
            initialization.parent.mkdir(parents=True, exist_ok=True)
            initialization.write_text(
                'data merge storage sgp:kits '
                '{kit_id_order:[{kit_id:3,kit_path:example,'
                'ability_path:test_dash}],example:{kit:example,'
                'kit_color:aqua,kit_name:"Exemple",kit_icon:"E",'
                'ability_name:"Test",ability_hover:['
                '{text:"Activation : "},{keybind:"key.drop"},'
                '{text:"\\nDescription"}]}}',
                encoding="utf-8",
            )
            return export_manifest(datapack, "26.1")


class CurrentManifestTests(unittest.TestCase):
    def test_committed_manifest_matches_expected_inventory_shape(self) -> None:
        path = REPOSITORY / "data/kit-manifest.json"
        if not path.is_file():
            self.skipTest("current kit manifest has not been generated")

        manifest = json.loads(path.read_text(encoding="utf-8"))
        Draft202012Validator(SCHEMA).validate(manifest)

        self.assertEqual(len(manifest["kits"]), 13)
        self.assertEqual(
            sum(len(kit["operations"]) for kit in manifest["kits"]),
            113,
        )
        self.assertEqual(
            sum(
                operation["kind"] == "give"
                for kit in manifest["kits"]
                for operation in kit["operations"]
            ),
            3,
        )


if __name__ == "__main__":
    unittest.main()
