from __future__ import annotations

import base64
import io
import json
from pathlib import Path
import sys
import zlib

import nbtlib


PNG_1X1 = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII="
)


def write_entity_region(world: Path) -> None:
    entities = world / "dimensions/minecraft/overworld/entities"
    entities.mkdir(parents=True, exist_ok=True)
    tags = nbtlib.List[nbtlib.String](["sgp.marker"])
    records = []
    for name, data in (
        ("playable_map", "{id:1,dx:20,dy:20,dz:20}"),
        ("lieu", '{lieu:"hall",lieu_propre:"Hall",couleur:gold,dx:9,dy:9,dz:9}'),
    ):
        records.append(
            nbtlib.Compound(
                {
                    "id": nbtlib.String("minecraft:marker"),
                    "Tags": tags,
                    "CustomName": nbtlib.String(name),
                    "Pos": nbtlib.List[nbtlib.Double]([0, 0, 0]),
                    "data": nbtlib.parse_nbt(data),
                }
            )
        )

    chunk = io.BytesIO()
    nbtlib.File({"": nbtlib.Compound({"Entities": nbtlib.List[nbtlib.Compound](records)})}).write(chunk)
    compressed = zlib.compress(chunk.getvalue())
    region = bytearray(8192)
    region[:4] = bytes([0, 0, 2, 1])
    region += (len(compressed) + 1).to_bytes(4, "big") + b"\x02" + compressed
    region += b"\0" * (4096 - len(region) % 4096)
    (entities / "r.0.0.mca").write_bytes(region)


def write_command_storage(world: Path) -> None:
    storage = world / "data/sgp/command_storage.dat"
    storage.parent.mkdir(parents=True, exist_ok=True)
    nbtlib.File(
        {
            "": nbtlib.parse_nbt(
                '''{data:{contents:{data:{spawns:[
                    {id:1,list:[{x:3,y:5,z:3,title:'{text:"Spawn",color:red}'}]}
                ]}}}}'''
            )
        }
    ).save(storage, gzipped=True)
    saved = nbtlib.load(storage)
    saved.root["data"]["contents"]["data"]["spawns"][0]["list"][0]["icon"] = nbtlib.String(
        '\",{text:"\ue007",font:"sgp.misc:spawn_icons",color:"white",bold:false},\"'
    )
    saved.save(storage, gzipped=True)


def write_resource_pack(pack: Path) -> None:
    font = pack / "assets/sgp.misc/font/spawn_icons.json"
    texture = pack / "assets/sgp.misc/textures/font/spawns/galerie.png"
    font.parent.mkdir(parents=True, exist_ok=True)
    texture.parent.mkdir(parents=True, exist_ok=True)
    texture.write_bytes(PNG_1X1)
    font.write_text(
        json.dumps(
            {
                "providers": [
                    {
                        "type": "bitmap",
                        "file": "sgp.misc:font/spawns/galerie.png",
                        "chars": ["\ue007"],
                    }
                ]
            }
        ),
        encoding="utf-8",
    )


def main() -> None:
    root = Path(sys.argv[1]).resolve()
    write_entity_region(root / "inputs/world")
    write_command_storage(root / "inputs/world")
    write_resource_pack(root / "inputs/pack")


if __name__ == "__main__":
    main()
