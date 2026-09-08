import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("cosmetic_effects", Path(__file__).resolve().parents[1] / "scripts/cosmetic-effects.py")
effects = importlib.util.module_from_spec(spec)
spec.loader.exec_module(effects)


class CosmeticEffectsTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.pack = Path(self.temp.name)
        self.write("sgp.cosmetics:initialization", 'scoreboard objectives add sgp.particle.future_unlocked dummy {text:"Future",color:"#123456"}\n')

    def write(self, id, code):
        namespace, key = id.split(":")
        path = self.pack / "data" / namespace / "function" / (key + ".mcfunction")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(code, encoding="utf-8")

    def extracted(self):
        return effects.extract(self.pack)["cosmetics"][0]["effects"]

    def test_new_particle_and_macro_helper_without_cosmetic_mapping(self):
        self.write("sgp.cosmetics:tick", 'execute as @a[tag=sgp.particle.future] at @s run function future:helper {effect:"minecraft:cherry_leaves",count:7}\n')
        self.write("future:helper", '$execute at @s run particle $(effect) ~ ~ ~ 0 0 0 0 $(count)\n')
        actual = self.extracted()
        self.assertEqual([(e["id"], e["count"]) for e in actual], [("minecraft:cherry_leaves", 7)])

    def test_excludes_other_cosmetic_branches_in_shared_helper(self):
        self.write("sgp.cosmetics:tick", 'execute as @a[tag=sgp.particle.future] run function future:shared\n')
        self.write("future:shared", 'execute if entity @s[tag=sgp.particle.future] run particle flame\nexecute if entity @s[tag=sgp.particle.other] run particle smoke\nexecute unless entity @s[tag=sgp.particle.future] run particle cloud\n')
        self.assertEqual([e["id"] for e in self.extracted()], ["minecraft:flame"])

    def test_new_entity_preserves_its_payload_and_does_not_choose_an_icon(self):
        self.write("sgp.cosmetics:tick", 'execute as @a[tag=sgp.particle.future] run summon minecraft:item_display ~ ~ ~ {item:{id:"minecraft:amethyst_shard",count:1,components:{"minecraft:custom_model_data":{strings:["future"]}}}}\n')
        entity = self.extracted()[0]
        self.assertEqual(entity["id"], "minecraft:item_display")
        self.assertEqual(entity["nbt"]["item"]["id"], "minecraft:amethyst_shard")

    def test_particle_options_and_continuations(self):
        self.write("sgp.cosmetics:tick", 'execute as @a[tag=sgp.particle.future] at @s \\\n run particle minecraft:dust{color:[1.0f,0.0f,0.0f],scale:1.0f} ~ ~ ~ 0 0 0 0 3\n')
        particle = self.extracted()[0]
        self.assertEqual(particle["count"], 3)
        self.assertEqual(particle["options"]["color"], [1, 0, 0])

    def test_recursive_and_dynamic_functions_fail_with_source(self):
        self.write("sgp.cosmetics:tick", 'execute as @a[tag=sgp.particle.future] run function future:helper\n')
        self.write("future:helper", 'function future:helper\n')
        with self.assertRaisesRegex(ValueError, "Recursive cosmetic function"):
            self.extracted()
        self.write("future:helper", 'function future:macro with storage future:args\n')
        with self.assertRaisesRegex(ValueError, "Dynamic function storage"):
            self.extracted()

    def test_no_visuals_is_an_explicit_error(self):
        self.write("sgp.cosmetics:tick", 'execute as @a[tag=sgp.particle.future] run playsound minecraft:entity.cat.ambient master @s\n')
        with self.assertRaisesRegex(ValueError, "No supported visual commands"):
            self.extracted()

    def test_outdated_snapshot_error_identifies_source_and_configuration(self):
        self.write("sgp.cosmetics:initialization", 'scoreboard objectives add sgp.particle.future_unlocked dummy "Future"\n')
        with self.assertRaisesRegex(ValueError, r"initialization\.mcfunction:1:.*current\.datapack.*does not update source snapshots"):
            self.extracted()


if __name__ == "__main__":
    unittest.main()
