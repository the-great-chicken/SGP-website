from __future__ import annotations

import base64
import gzip
import html
import io
import json
import math
from pathlib import Path
import re
import zlib

import nbtlib


COLORS = dict(zip(
    ("black", "dark_blue", "dark_green", "dark_aqua", "dark_red", "dark_purple", "gold", "gray", "dark_gray", "blue", "green", "aqua", "red", "light_purple", "yellow", "white"),
    ("000000", "0000aa", "00aa00", "00aaaa", "aa0000", "aa00aa", "ffaa00", "aaaaaa", "555555", "5555ff", "55ff55", "55ffff", "ff5555", "ff55ff", "ffff55", "ffffff"),
))


def number(value):
    result = float(value)
    if not math.isfinite(result):
        raise ValueError("Coordinates must be finite")
    return result


def selector_box(position, data):
    """Minecraft selector deltas include the final block, including negative deltas."""
    bounds = [(number(p) + min(number(data[f"d{axis}"]), 0), number(p) + max(number(data[f"d{axis}"]), 0) + 1)
              for axis, p in zip("xyz", position)]
    return tuple(low for low, _ in bounds) + tuple(high for _, high in bounds)


def intersection(a, b):
    result = tuple(max(a[i], b[i]) for i in range(3)) + tuple(min(a[i], b[i]) for i in range(3, 6))
    return result if all(result[i] < result[i + 3] for i in range(3)) else None


def subtract_box(box, exclusion):
    cut = intersection(box, exclusion)
    if cut is None:
        return [box]
    x, y, z, xx, yy, zz = box
    a, b, c, aa, bb, cc = cut
    pieces = [(x, y, z, a, yy, zz), (aa, y, z, xx, yy, zz),
              (a, y, z, aa, b, zz), (a, bb, z, aa, yy, zz),
              (a, b, z, aa, bb, c), (a, b, cc, aa, bb, zz)]
    return [piece for piece in pieces if all(piece[i] < piece[i + 3] for i in range(3))]


def color(value, alpha=1):
    value = str(value)
    value = COLORS.get(value, value.removeprefix("#"))
    if not re.fullmatch(r"[0-9a-fA-F]{6}", value):
        raise ValueError(f"Unsupported map color: {value}")
    return dict(zip("rgb", (int(value[i:i + 2], 16) for i in (0, 2, 4))), a=alpha)


def component_text(component):
    if isinstance(component, str):
        return component
    if isinstance(component, list):
        return "".join(component_text(part) for part in component)
    if not isinstance(component, dict) or "text" not in component:
        raise ValueError("Spawn titles must contain literal text components")
    return str(component["text"]) + "".join(component_text(part) for part in component.get("extra", []))


def read_entities(directory):
    if not directory.is_dir():
        raise ValueError(f"Missing saved entity directory: {directory}")
    for region in sorted(directory.glob("r.*.*.mca")):
        before = region.stat().st_mtime_ns
        raw = region.read_bytes()
        if len(raw) < 8192:
            raise ValueError(f"Truncated region: {region}")
        for index in range(1024):
            offset = int.from_bytes(raw[index * 4:index * 4 + 3], "big") * 4096
            if not offset:
                continue
            length = int.from_bytes(raw[offset:offset + 4], "big")
            if offset < 8192 or length < 1 or offset + 4 + length > len(raw):
                raise ValueError(f"Invalid chunk in {region}")
            kind = raw[offset + 4]
            payload = raw[offset + 5:offset + 4 + length]
            if kind & 128:
                _, rx, rz, _ = region.name.split(".")
                chunk_x, chunk_z = int(rx) * 32 + index % 32, int(rz) * 32 + index // 32
                payload = (directory / f"c.{chunk_x}.{chunk_z}.mcc").read_bytes()
                kind &= 127
            if kind == 1:
                payload = gzip.decompress(payload)
            elif kind == 2:
                payload = zlib.decompress(payload)
            elif kind != 3:
                raise ValueError(f"Unsupported region compression {kind} in {region}")
            chunk = nbtlib.File.parse(io.BytesIO(payload)).root
            for entity in chunk.get("Entities", []):
                if str(entity.get("id")) == "minecraft:marker" and "sgp.marker" in entity.get("Tags", []):
                    yield entity.unpack()
        if before != region.stat().st_mtime_ns:
            raise ValueError(f"World changed during export; use a stopped-world copy: {region}")


def location_markers(entities, area):
    result = {}
    for entity in entities:
        if entity.get("CustomName") != "lieu":
            continue
        data, position = entity["data"], entity["Pos"]
        box = intersection(selector_box(position, data), area)
        if box is None:
            continue
        key, label = data["lieu"], data["lieu_propre"]
        if not re.fullmatch(r"[A-Za-z0-9_-]+", key) or f"location-{key}-0" in result:
            raise ValueError(f"Invalid or duplicate location id: {key}")
        pieces = [box]
        if "exclusion_box" in data:
            exclusion = data["exclusion_box"]
            origin = [number(position[i]) + number(exclusion[axis]) for i, axis in enumerate("xyz")]
            pieces = subtract_box(box, selector_box(origin, exclusion))
        for index, (x, y, z, xx, yy, zz) in enumerate(pieces):
            result[f"location-{key}-{index}"] = {
                "type": "extrude", "label": label, "detail": html.escape(label), "listed": index == 0,
                "position": {"x": (x + xx) / 2, "y": (y + yy) / 2, "z": (z + zz) / 2},
                "shape": [{"x": x, "z": z}, {"x": xx, "z": z}, {"x": xx, "z": zz}, {"x": x, "z": zz}],
                "shapeMinY": y, "shapeMaxY": yy, "depthTest": False,
                "lineWidth": 1, "lineColor": color(data["couleur"], 0.8), "fillColor": color(data["couleur"], 0.06),
            }
    return dict(sorted(result.items()))


def spawn_icon(spawn, resource_pack):
    # The datapack inserts this fragment between quoted text components in its spawn menu.
    component = nbtlib.parse_nbt(spawn["icon"][2:-2]).unpack()
    namespace, name = component["font"].split(":")
    assets = resource_pack.resolve() / "assets"
    font_path = (assets / namespace / "font" / f"{name}.json").resolve()
    if not font_path.is_relative_to(assets):
        raise ValueError("Spawn font must be inside the resource pack")
    font = json.loads(font_path.read_text(encoding="utf-8"))
    provider = next((p for p in font["providers"] if p["type"] == "bitmap" and p["chars"] == [component["text"]]), None)
    if provider is None:
        raise ValueError(f"Missing spawn icon glyph: {component['text']}")
    namespace, name = provider["file"].split(":")
    texture = (assets / namespace / "textures" / name).resolve()
    if not texture.is_relative_to(assets) or texture.suffix != ".png":
        raise ValueError("Spawn icon must be a PNG inside the resource pack")
    return "data:image/png;base64," + base64.b64encode(texture.read_bytes()).decode("ascii")


def spawn_markers(spawns, groups, area, resource_pack):
    result = {}
    for group_id in groups:
        matching = [entry for entry in spawns if entry.get("id") == group_id]
        if len(matching) != 1:
            raise ValueError(f"Expected one spawn group with id {group_id}")
        for index, spawn in enumerate(matching[0]["list"]):
            position = {axis: number(spawn[axis]) for axis in "xyz"}
            if not all(area[i] <= position[axis] < area[i + 3] for i, axis in enumerate("xyz")):
                continue
            title = spawn["title"]
            component = nbtlib.parse_nbt(title).unpack() if isinstance(title, str) else title
            label = component_text(component)
            if not label.strip():
                raise ValueError("Spawn title must not be empty")
            tint = color(component.get("color", "gold") if isinstance(component, dict) else "gold")
            css_color = f"rgb({tint['r']},{tint['g']},{tint['b']})"
            result[f"spawn-{group_id}-{index}"] = {
                "type": "html", "label": label, "position": position, "listed": True, "classes": [],
                "html": f'<div class="sgp-spawn-marker" style="--spawn-color:{css_color}"><img src="{spawn_icon(spawn, resource_pack)}" alt="" width="32" height="32"><span>{html.escape(label)}</span></div>',
            }
    return result


def export_overlays(world: Path, maps: list[dict], resource_pack: Path):
    world = world.resolve()
    storage_path = world / "data/sgp/command_storage.dat"
    before = storage_path.stat().st_mtime_ns
    spawns = nbtlib.load(storage_path).root["data"]["contents"]["data"]["spawns"].unpack()
    dimensions, result = {}, {}
    for config in maps:
        dimension = config["dimension"]
        if not re.fullmatch(r"[a-z0-9_.-]+:[a-z0-9_/-]+", dimension) or ".." in dimension:
            raise ValueError(f"Invalid dimension: {dimension}")
        if config["id"] in result:
            raise ValueError(f"Duplicate BlueMap map id: {config['id']}")
        if dimension not in dimensions:
            namespace, name = dimension.split(":")
            dimensions[dimension] = list(read_entities(world / "dimensions" / namespace / name / "entities"))
        entities = dimensions[dimension]
        areas = [entity for entity in entities if entity.get("CustomName") == "playable_map" and entity.get("data", {}).get("id") == config["playableArea"]]
        if len(areas) != 1:
            raise ValueError(f"Expected one playable_map marker with id {config['playableArea']}")
        area = selector_box(areas[0]["Pos"], areas[0]["data"])
        result[config["id"]] = {
            "sgp-locations": {"label": "Lieux", "toggleable": True, "defaultHidden": True, "markers": location_markers(entities, area)},
            "sgp-spawns": {"label": "Points de spawn", "toggleable": True, "defaultHidden": False, "markers": spawn_markers(spawns, config["spawnGroups"], area, resource_pack)},
        }
    if before != storage_path.stat().st_mtime_ns:
        raise ValueError("Command storage changed during export; use a saved-world copy")
    return {"schemaVersion": 1, "maps": result}
