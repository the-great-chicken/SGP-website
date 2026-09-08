"""Validate the datapack-owned cosmetic declarations and API without running Minecraft."""
from __future__ import annotations

import argparse
from pathlib import Path
import re
import nbtlib

from mecha import Mecha


def check(datapack: Path) -> None:
    root = datapack / "data/sgp.cosmetics/function"
    init = (root / "initialization.mcfunction").read_text(encoding="utf-8")
    catalogue = []
    for line in init.splitlines():
        command = line.strip()
        if not re.match(r"scoreboard\s+objectives\s+add\s+sgp\.(particle|intensity|kill)\.", command):
            continue
        match = re.fullmatch(r'scoreboard\s+objectives\s+add\s+sgp\.((particle|intensity|kill)\.[a-z_]+)_unlocked\s+dummy\s+(\{.*})', command)
        assert match, f"Expected a cosmetic text/color component: {command}"
        display = nbtlib.parse_nbt(match[3]).unpack()
        assert set(display) == {"text", "color"} and re.fullmatch(r"#[0-9a-fA-F]{6}", display["color"])
        name = display["text"]
        assert name.strip() and len(name) <= 100, f"Invalid display name: {name!r}"
        catalogue.append({"id": match[1], "category": match[2], "name": name})
    assert 1 <= len(catalogue) <= 128 and len({c["id"] for c in catalogue}) == len(catalogue)
    expected = {entry["id"].replace(".", "/") + ".mcfunction" for entry in catalogue}
    actual = {path.relative_to(root / "api/equip").as_posix() for path in (root / "api/equip").rglob("*.mcfunction")}
    assert actual == expected, f"Objective/equip hook drift: {actual ^ expected}"
    disable = {
        "particle": "particles/disable_type",
        "intensity": "particles/disable_intensity",
        "kill": "kill_effects/disable",
    }
    for category, function in disable.items():
        tags = {"sgp." + entry["id"] for entry in catalogue if entry["category"] == category}
        actual = set(re.findall(r"tag @s remove (\S+)", (root / (function + ".mcfunction")).read_text(encoding="utf-8")))
        assert actual == tags, f"Disable hook/catalogue drift in {category}"

    parser = Mecha(version="1.21", multiline=True)
    paths = sorted((root / "api").rglob("*.mcfunction"))
    paths += [root / "initialization.mcfunction", root / "uninstall.mcfunction", root / "update.mcfunction"]
    paths += [root / (p + ".mcfunction") for p in [
        "particles/reset_and_replace", "particles/reset_and_replace_intensity", "kill_effects/reset_and_replace",
    ]]
    for path in paths:
        source = path.read_text(encoding="utf-8")
        parser.parse(source)

    for entry in catalogue:
        category, key = entry["id"].split(".")
        path = root / "api/equip" / category / (key + ".mcfunction")
        commands = [line for line in path.read_text(encoding="utf-8").splitlines() if line and not line.startswith("#")]
        # This boundary must reject locked requests before any destructive selection change.
        assert commands == [
            "execute unless entity @s[type=player] run return 0",
            f"execute unless score @s sgp.{entry['id']}_unlocked matches 1 run return 0",
            f"function sgp.cosmetics:{disable[category]}",
            f"tag @s add sgp.{entry['id']}",
            "return 1",
        ], f"Unexpected mutation contract: {path}"
    print(f"Validated {len(catalogue)} cosmetics and parsed {len(paths)} datapack functions; no Minecraft server used.")


if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--datapack", type=Path, default=Path("../server/world/datapacks/TGCdatapack"))
    args = cli.parse_args()
    check(args.datapack)
