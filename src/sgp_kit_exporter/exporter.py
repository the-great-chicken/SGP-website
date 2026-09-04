from __future__ import annotations

import json
import math
import re
from pathlib import Path
from typing import Any

from mecha import Mecha
from mecha.ast import (
    AstCommand,
    AstItemComponent,
    AstItemRemovedDefaultComponent,
    AstItemSlot,
    AstItemStack,
    AstNbt,
    AstNbtBool,
    AstNbtByteArray,
    AstNbtCompound,
    AstNbtIntArray,
    AstNbtList,
    AstNbtLongArray,
    AstNbtValue,
    AstNumber,
    AstSelector,
)
from mecha.diagnostic import DiagnosticError


SCHEMA_VERSION = 1
SCHEMA_REFERENCE = "../schemas/kit-manifest.schema.json"
FUNCTIONS_ROOT = Path("data/sgp.kits/function/collection")
FUNCTION_NAMESPACE = "sgp.kits"
# Mecha 0.101 bundles this command tree. The two accepted command shapes and its
# generic item-component/SNBT parser are verified against every current 26.1 kit.
MECHA_COMMAND_VERSION = "1.21"

GIVE_IDENTIFIERS = {
    "give:targets:item": False,
    "give:targets:item:count": True,
}
REPLACE_IDENTIFIERS = {
    "item:replace:entity:targets:slot:with:item": False,
    "item:replace:entity:targets:slot:with:item:count": True,
}

JSON_SAFE_INTEGER_MAX = 9_007_199_254_740_991
KIT_KEY_PATTERN = re.compile(r"^[a-z0-9_]+$")


class ExportError(RuntimeError):
    """The datapack can't be represented by the kit manifest contract."""


def export_manifest(datapack: Path, minecraft_version: str) -> dict[str, Any]:
    datapack = datapack.resolve()
    if not minecraft_version.strip():
        raise ExportError("minecraft version must not be empty")
    if not datapack.is_dir():
        raise ExportError(f"datapack directory does not exist: {datapack}")

    pack_metadata = _read_pack_metadata(datapack / "pack.mcmeta")
    functions_directory = datapack / FUNCTIONS_ROOT
    if not functions_directory.is_dir():
        raise ExportError(f"kit functions directory does not exist: {functions_directory}")

    item_files = sorted(functions_directory.glob("*/items.mcfunction"))
    if not item_files:
        raise ExportError(f"no kit item functions found in {functions_directory}")

    parser = Mecha(version=MECHA_COMMAND_VERSION, multiline=True)
    kits = [
        _export_kit(parser, item_file, item_file.parent.name)
        for item_file in item_files
    ]

    return {
        "$schema": SCHEMA_REFERENCE,
        "schemaVersion": SCHEMA_VERSION,
        "minecraftVersion": minecraft_version,
        "dataPack": pack_metadata,
        "kits": kits,
    }


def render_manifest(manifest: dict[str, Any]) -> str:
    return json.dumps(manifest, ensure_ascii=False, indent=2, allow_nan=False) + "\n"


def _read_pack_metadata(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise ExportError(f"pack metadata does not exist: {path}")

    try:
        document = json.loads(path.read_text(encoding="utf-8"))
        datapack_id = document["id"]
        pack = document["pack"]
        min_format = pack["min_format"]
        max_format = pack["max_format"]
    except (json.JSONDecodeError, KeyError, TypeError) as exc:
        raise ExportError(f"invalid pack metadata in {path}: {exc}") from exc

    if not isinstance(datapack_id, str) or not datapack_id:
        raise ExportError(f"invalid datapack id in {path}")
    if not _is_json_number(min_format) or not _is_json_number(max_format):
        raise ExportError(f"pack min_format and max_format must be numbers in {path}")

    return {
        "id": datapack_id,
        "minFormat": min_format,
        "maxFormat": max_format,
    }


def _export_kit(parser: Mecha, path: Path, kit_key: str) -> dict[str, Any]:
    if not KIT_KEY_PATTERN.fullmatch(kit_key):
        raise ExportError(f"invalid kit directory name {kit_key!r}: {path.parent}")

    try:
        root = parser.parse(
            path.read_text(encoding="utf-8"),
            filename=path,
            multiline=True,
        )
    except (OSError, UnicodeError, DiagnosticError) as exc:
        raise ExportError(str(exc)) from exc

    function = f"{FUNCTION_NAMESPACE}:collection/{kit_key}/items"
    operations = [
        _export_operation(command, function)
        for command in root.commands
    ]
    if not operations:
        raise ExportError(f"{function}: loadout contains no item operations")

    explicit_slots: dict[str, int] = {}
    for operation in operations:
        if operation["kind"] != "replace":
            continue
        slot = operation["slot"]
        if slot in explicit_slots:
            raise ExportError(
                f"{function}:{operation['source']['line']}: slot {slot!r} was already "
                f"assigned on line {explicit_slots[slot]}"
            )
        explicit_slots[slot] = operation["source"]["line"]

    return {
        "key": kit_key,
        "function": function,
        "operations": operations,
    }


def _export_operation(command: AstCommand, function: str) -> dict[str, Any]:
    source = {
        "line": command.location.lineno,
        "endLine": command.end_location.lineno,
    }

    if command.identifier in GIVE_IDENTIFIERS:
        has_count = GIVE_IDENTIFIERS[command.identifier]
        expected_arguments = 3 if has_count else 2
        _require_argument_count(command, expected_arguments, function)
        _require_self_selector(command.arguments[0], command, function)
        item = _require_item_stack(command.arguments[1], command, function)
        count = _read_count(command.arguments[2], command, function) if has_count else 1
        return {
            "kind": "give",
            "item": _export_item(item, count, command, function),
            "source": source,
        }

    if command.identifier in REPLACE_IDENTIFIERS:
        has_count = REPLACE_IDENTIFIERS[command.identifier]
        expected_arguments = 4 if has_count else 3
        _require_argument_count(command, expected_arguments, function)
        _require_self_selector(command.arguments[0], command, function)

        slot = command.arguments[1]
        if not isinstance(slot, AstItemSlot):
            raise _command_error(command, function, "expected a concrete item slot")

        item = _require_item_stack(command.arguments[2], command, function)
        count = _read_count(command.arguments[3], command, function) if has_count else 1
        return {
            "kind": "replace",
            "slot": slot.value,
            "item": _export_item(item, count, command, function),
            "source": source,
        }

    raise _command_error(
        command,
        function,
        f"unsupported loadout command {command.identifier!r}",
    )


def _require_argument_count(
    command: AstCommand,
    expected: int,
    function: str,
) -> None:
    if len(command.arguments) != expected:
        raise _command_error(
            command,
            function,
            f"expected {expected} parsed arguments, got {len(command.arguments)}",
        )


def _require_self_selector(
    argument: object,
    command: AstCommand,
    function: str,
) -> None:
    if not isinstance(argument, AstSelector):
        raise _command_error(command, function, "loadout target must be @s")
    if argument.variable != "s" or argument.arguments:
        raise _command_error(command, function, "loadout target must be the plain @s selector")


def _require_item_stack(
    argument: object,
    command: AstCommand,
    function: str,
) -> AstItemStack:
    if not isinstance(argument, AstItemStack):
        raise _command_error(command, function, "expected an item stack")
    return argument


def _read_count(
    argument: object,
    command: AstCommand,
    function: str,
) -> int:
    if not isinstance(argument, AstNumber) or not isinstance(argument.value, int):
        raise _command_error(command, function, "item count must be an integer")
    if argument.value < 1:
        raise _command_error(command, function, "item count must be positive")
    return argument.value


def _export_item(
    item: AstItemStack,
    count: int,
    command: AstCommand,
    function: str,
) -> dict[str, Any]:
    if item.identifier.is_tag:
        raise _command_error(command, function, "item stacks cannot use item tags")
    if item.data_tags is not None:
        raise _command_error(command, function, "legacy item data tags are not supported")

    components: dict[str, Any] = {}
    removed_components: list[str] = []

    for argument in item.arguments:
        if isinstance(argument, AstItemComponent):
            key = argument.key.get_canonical_value()
            if key in components or key in removed_components:
                raise _command_error(
                    command,
                    function,
                    f"duplicate item component {key!r}",
                )
            components[key] = _nbt_to_json(argument.value, command, function)
        elif isinstance(argument, AstItemRemovedDefaultComponent):
            key = argument.key.get_canonical_value()
            if key in components or key in removed_components:
                raise _command_error(
                    command,
                    function,
                    f"duplicate item component {key!r}",
                )
            removed_components.append(key)
        else:
            raise _command_error(
                command,
                function,
                f"unsupported item argument {type(argument).__name__}",
            )

    return {
        "id": item.identifier.get_canonical_value(),
        "count": count,
        "components": components,
        "removedComponents": removed_components,
    }


def _nbt_to_json(
    node: AstNbt,
    command: AstCommand,
    function: str,
) -> Any:
    if isinstance(node, AstNbtBool):
        return bool(node.value)

    if isinstance(node, AstNbtValue):
        value = node.value.unpack() if hasattr(node.value, "unpack") else node.value
        if isinstance(value, bool):
            return value
        if isinstance(value, int):
            if abs(value) > JSON_SAFE_INTEGER_MAX:
                raise _command_error(
                    command,
                    function,
                    f"integer {value} cannot be represented safely in website JSON",
                )
            return value
        if isinstance(value, float):
            if not math.isfinite(value):
                raise _command_error(
                    command,
                    function,
                    f"non-finite number {value!r} cannot be represented in JSON",
                )
            return value
        if isinstance(value, str):
            return value
        raise _command_error(
            command,
            function,
            f"unsupported NBT scalar {type(value).__name__}",
        )

    if isinstance(node, AstNbtCompound):
        result: dict[str, Any] = {}
        for entry in node.entries:
            key = entry.key.value
            if key in result:
                raise _command_error(
                    command,
                    function,
                    f"duplicate NBT compound key {key!r}",
                )
            result[key] = _nbt_to_json(entry.value, command, function)
        return result

    if isinstance(
        node,
        (AstNbtList, AstNbtByteArray, AstNbtIntArray, AstNbtLongArray),
    ):
        return [_nbt_to_json(element, command, function) for element in node.elements]

    raise _command_error(
        command,
        function,
        f"unsupported NBT node {type(node).__name__}",
    )


def _command_error(command: AstCommand, function: str, message: str) -> ExportError:
    return ExportError(f"{function}:{command.location.lineno}: {message}")


def _is_json_number(value: object) -> bool:
    return (
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and (not isinstance(value, float) or math.isfinite(value))
    )
