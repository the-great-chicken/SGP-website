"""Extract representative visuals from cosmetic command branches, without executing Minecraft."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import struct
import zipfile

import nbtlib


def constant_pool(data):
    """Read JVM references without loading or running client classes."""
    size = struct.unpack_from(">H", data, 8)[0]
    pool, position, index = [None] * size, 10, 1
    while index < size:
        tag = data[position]
        position += 1
        if tag == 1:
            length = struct.unpack_from(">H", data, position)[0]
            position += 2
            pool[index] = data[position:position + length].decode("utf-8", errors="replace")
            position += length
        elif tag in (7, 8, 16, 19, 20):
            pool[index] = (tag, struct.unpack_from(">H", data, position)[0])
            position += 2
        elif tag in (9, 10, 11, 12, 17, 18):
            pool[index] = (tag, *struct.unpack_from(">HH", data, position))
            position += 4
        elif tag == 15:
            position += 3
        elif tag in (3, 4):
            position += 4
        elif tag in (5, 6):
            position += 8
            index += 1
        else:
            raise ValueError(f"Unsupported JVM constant tag {tag}")
        index += 1
    return pool, data[position:]


def particle_children(client: Path):
    """Follow direct particle providers to the particle types they emit, using client bytecode."""
    def fields(pool):
        return {index: pool[pool[entry[2]][1]] for index, entry in enumerate(pool)
            if isinstance(entry, tuple) and entry[0] == 9
            and pool[pool[entry[1]][1]] == "net/minecraft/core/particles/ParticleTypes"}

    result = {}
    with zipfile.ZipFile(client) as archive:
        pool, body = constant_pool(archive.read("net/minecraft/client/particle/ParticleResources.class"))
        # Direct providers use GETSTATIC particle-type, NEW provider; sprite factories already have particle JSON.
        for index, field in fields(pool).items():
            pattern = b"\xb2" + struct.pack(">H", index) + b"\xbb"
            offset = body.find(pattern)
            if offset < 0:
                continue
            class_index = struct.unpack_from(">H", body, offset + len(pattern))[0]
            provider = pool[pool[class_index][1]]
            children = set()
            for name in {provider, provider.split("$")[0]}:
                child_pool, _ = constant_pool(archive.read(name + ".class"))
                children.update("minecraft:" + child.lower() for child in fields(child_pool).values() if child != field)
            if children:
                result["minecraft:" + field.lower()] = sorted(children)
    return result


def tokens(command: str) -> list[str]:
    result, start, depth, quote, escaped = [], 0, 0, None, False
    for index, char in enumerate(command):
        if quote:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote:
                quote = None
        elif char in "\"'":
            quote = char
        elif char in "[{":
            depth += 1
        elif char in "]}":
            depth -= 1
        elif char.isspace() and depth == 0:
            if start < index:
                result.append(command[start:index])
            start = index + 1
    if quote or depth:
        raise ValueError(f"Unbalanced command: {command}")
    if start < len(command):
        result.append(command[start:])
    return result


def commands(source: str):
    logical = ""
    for number, line in enumerate(source.splitlines(), 1):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        logical += line.removesuffix("\\") + " "
        if not line.endswith("\\"):
            yield number, logical.strip()
            logical = ""
    if logical:
        raise ValueError("Unfinished command continuation")


def resource(value: str) -> str:
    value = value if ":" in value else "minecraft:" + value
    if not re.fullmatch(r"[a-z0-9_.-]+:[a-z0-9_./-]+", value) or ".." in value:
        raise ValueError(f"Unsupported resource location: {value}")
    return value


def extract(datapack: Path) -> dict:
    directory = datapack / "data/sgp.cosmetics/function"
    functions = {}
    for namespace in (datapack / "data").iterdir():
        for file in (namespace / "function").rglob("*.mcfunction"):
            functions[f"{namespace.name}:{file.relative_to(namespace / 'function').with_suffix('').as_posix()}"] = list(commands(file.read_text(encoding="utf-8")))
    catalogue = []
    declaration_file = directory / "initialization.mcfunction"
    for line, command in commands(declaration_file.read_text(encoding="utf-8")):
        match = re.fullmatch(r"scoreboard objectives add sgp\.((particle|intensity|kill)\.[a-z_]+)_unlocked dummy (.+)", command)
        if match:
            display = nbtlib.parse_nbt(match[3]).unpack()
            if not isinstance(display, dict) or set(display) != {"text", "color"} or not re.fullmatch(r"#[\da-fA-F]{6}", display["color"]):
                raise ValueError(f'{declaration_file}:{line}: Cosmetic {match[1]} requires a display component with literal text and a hex color, e.g. {{text:"Name",color:"#123456"}}. Update this datapack copy, or point current.datapack in publish.json at the updated datapack. content:refresh does not update source snapshots.')
            catalogue.append({"id": match[1], "category": match[2], "name": display["text"], "color": display["color"]})
    if not 1 <= len(catalogue) <= 128 or len({entry["id"] for entry in catalogue}) != len(catalogue):
        raise ValueError("Expected 1–128 unique cosmetic declarations")

    def visuals(cosmetic):
        result, visited = [], set()
        category = cosmetic["category"]
        selected = "sgp." + cosmetic["id"]

        def possible(selector):
            # Only the selected category is known. Other categories, scores and predicates vary at runtime.
            for tag in re.findall(r"(?:\[|,)tag=(!?sgp\.(?:particle|intensity|kill)\.[a-z_]+)(?=,|\])", selector):
                negative = tag.startswith("!")
                tag = tag.lstrip("!")
                if tag.startswith("sgp." + category + ".") and ((tag == selected) == negative):
                    return False
            return True

        def visit(command, location, arguments=None, stack=()):
            if command.startswith("$"):
                def substitute(match):
                    if arguments is None or match[1] not in arguments:
                        raise ValueError(f"Unresolved macro {match[0]} at {location}")
                    return str(arguments[match[1]])
                command = re.sub(r"\$\(([a-zA-Z0-9_]+)\)", substitute, command[1:])
            parts = tokens(command)
            if not parts:
                return
            if parts[0] == "execute":
                if "run" not in parts:
                    return
                end = parts.index("run")
                for index in range(1, end):
                    if parts[index] == "as" and index + 1 < end and not possible(parts[index + 1]):
                        return
                    if parts[index:index + 2] == ["if", "entity"] and index + 2 < end and not possible(parts[index + 2]):
                        return
                    if parts[index:index + 2] == ["unless", "entity"] and index + 2 < end:
                        selector = parts[index + 2]
                        if selector.startswith("@s[") and re.fullmatch(r"@s\[tag=" + re.escape(selected) + r"\]", selector):
                            return
                visit(" ".join(parts[end + 1:]), location, arguments, stack)
            elif parts[0] == "function":
                target = resource(parts[1])
                if len(parts) > 2 and parts[2] == "with":
                    raise ValueError(f"Dynamic function storage is unsupported at {location}")
                args = nbtlib.parse_nbt(parts[2]).unpack() if len(parts) > 2 else None
                key = (target, json.dumps(args, sort_keys=True))
                if target in stack:
                    raise ValueError(f"Recursive cosmetic function at {location}: {target}")
                if key in visited:
                    return
                visited.add(key)
                if target not in functions:
                    raise ValueError(f"Missing cosmetic function at {location}: {target}")
                for line, child in functions[target]:
                    visit(child, f"{target}:{line}", args, (*stack, target))
            elif parts[:2] == ["return", "run"]:
                visit(" ".join(parts[2:]), location, arguments, stack)
            elif parts[:2] == ["schedule", "function"]:
                visit("function " + parts[2], location, None, stack)
            elif parts[0] == "particle":
                match = re.fullmatch(r"([a-z0-9_:./-]+)(\{.*})?", parts[1])
                if not match:
                    raise ValueError(f"Unsupported particle at {location}")
                result.append({"kind": "particle", "id": resource(match[1]),
                    "options": nbtlib.parse_nbt(match[2]).unpack() if match[2] else {},
                    "count": int(parts[9]) if len(parts) > 9 else 1, "source": location})
            elif parts[0] == "summon":
                result.append({"kind": "entity", "id": resource(parts[1]),
                    "nbt": nbtlib.parse_nbt(parts[5]).unpack() if len(parts) > 5 else {}, "source": location})

        # Start where the cosmetic's equipped tag gates behavior, including macro calls and tick dispatchers.
        gate = re.compile(r"(?:\[|,)tag=" + re.escape(selected) + r"(?=,|\])")
        for function, lines in functions.items():
            if function.startswith("sgp.cosmetics:api/"):
                continue
            for line, command in lines:
                if gate.search(command):
                    visit(command, f"{function}:{line}")
        if not result:
            raise ValueError(f"No supported visual commands found for {cosmetic['id']}")
        return list({json.dumps(effect, sort_keys=True): effect for effect in result}.values())

    for cosmetic in catalogue:
        cosmetic["effects"] = visuals(cosmetic)
    # Generated output records its source; no hand-maintained cosmetic visual catalogue exists.
    fingerprint = hashlib.sha256(json.dumps(functions, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
    return {"schemaVersion": 1, "sourceHash": fingerprint, "cosmetics": catalogue}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--datapack", type=Path, required=True)
    parser.add_argument("--minecraft-client", type=Path, required=True)
    args = parser.parse_args()
    try:
        result = extract(args.datapack)
        result["particleChildren"] = particle_children(args.minecraft_client)
    except (ValueError, OSError) as error:
        parser.exit(1, f"{error}\n")
    print(json.dumps(result, ensure_ascii=False))
