import io
import json
from pathlib import Path
import tempfile
import unittest
import zlib

import nbtlib

from sgp_map_exporter.exporter import export_overlays, selector_box, subtract_box


class MapExporterTests(unittest.TestCase):
    def test_selector_extents_include_end_blocks_for_both_directions(self):
        self.assertEqual(selector_box([10, 20, 30], {"dx": -3, "dy": 0, "dz": 5}), (7, 20, 30, 11, 21, 36))

    def test_exclusion_removes_only_the_intersection_without_overlapping_pieces(self):
        box = (0, 0, 0, 10, 10, 10)
        pieces = subtract_box(box, (2, 4, -1, 8, 7, 5))
        volume = sum((p[3] - p[0]) * (p[4] - p[1]) * (p[5] - p[2]) for p in pieces)
        self.assertEqual(volume, 1000 - 6 * 3 * 5)
        for x in range(10):
            for y in range(10):
                for z in range(10):
                    point = (x + .5, y + .5, z + .5)
                    matches = sum(all(p[i] <= point[i] < p[i + 3] for i in range(3)) for p in pieces)
                    excluded = 2 <= point[0] < 8 and 4 <= point[1] < 7 and point[2] < 5
                    self.assertEqual(matches, 0 if excluded else 1)

    def test_saved_world_exports_locations_and_only_selected_spawn_groups(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            entities = root / "dimensions/minecraft/overworld/entities"
            entities.mkdir(parents=True)
            tags = nbtlib.List[nbtlib.String](["sgp.marker"])
            records = []
            for name, data in (
                ("playable_map", "{id:1,dx:20,dy:20,dz:20}"),
                ("lieu", '{lieu:"hall",lieu_propre:"Hall <test>",couleur:gold,dx:9,dy:9,dz:9,exclusion_box:{x:2,y:4,z:2,dx:3,dy:2,dz:3}}'),
            ):
                records.append(nbtlib.Compound({"id": nbtlib.String("minecraft:marker"), "Tags": tags,
                    "CustomName": nbtlib.String(name), "Pos": nbtlib.List[nbtlib.Double]([0, 0, 0]), "data": nbtlib.parse_nbt(data)}))
            chunk = io.BytesIO()
            nbtlib.File({"": nbtlib.Compound({"Entities": nbtlib.List[nbtlib.Compound](records)})}).write(chunk)
            compressed = zlib.compress(chunk.getvalue())
            region = bytearray(8192)
            region[:4] = bytes([0, 0, 2, 1])
            region += (len(compressed) + 1).to_bytes(4, "big") + b"\x02" + compressed
            region += b"\0" * (4096 - len(region) % 4096)
            (entities / "r.0.0.mca").write_bytes(region)
            storage = root / "data/sgp/command_storage.dat"
            storage.parent.mkdir(parents=True)
            nbtlib.File({"": nbtlib.parse_nbt('''{data:{contents:{data:{spawns:[
                {id:1,list:[{x:3,y:5,z:3,title:'{text:"Spawn <test>",color:red}'}]},
                {id:2,list:[{x:4,y:5,z:4,title:'{text:"Other group"}'}]}
            ]}}}}''')}).save(storage, gzipped=True)
            before = {p: p.read_bytes() for p in root.rglob("*") if p.is_file()}
            config = [{"id": "world", "dimension": "minecraft:overworld", "playableArea": 1, "spawnGroups": [1]}]
            result = export_overlays(root, config)
            markers = result["maps"]["world"]
            self.assertEqual(len(markers["sgp-spawns"]["markers"]), 1)
            spawn = markers["sgp-spawns"]["markers"]["spawn-1-0"]
            self.assertEqual(spawn["position"], {"x": 3, "y": 5, "z": 3})
            self.assertIn("Spawn &lt;test&gt;", spawn["html"])
            locations = list(markers["sgp-locations"]["markers"].values())
            self.assertEqual(len(locations), 6)
            self.assertEqual(sum(marker["listed"] for marker in locations), 1)
            self.assertEqual(locations[0]["detail"], "Hall &lt;test&gt;")
            self.assertEqual(result, export_overlays(root, config))
            self.assertEqual(before, {p: p.read_bytes() for p in root.rglob("*") if p.is_file()})
            json.dumps(result, allow_nan=False)
            config[0]["spawnGroups"] = [99]
            with self.assertRaisesRegex(ValueError, "spawn group"):
                export_overlays(root, config)


if __name__ == "__main__":
    unittest.main()
