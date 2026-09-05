from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .exporter import ExportError, export_manifest, render_manifest


DEFAULT_OUTPUT = Path("data/kit-manifest.json")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Export SGP kit items.mcfunction files to a website manifest."
    )
    parser.add_argument(
        "--datapack",
        type=Path,
        required=True,
        help="Path to the TGCdatapack root.",
    )
    parser.add_argument(
        "--minecraft-version",
        required=True,
        help="Exact Minecraft version represented by the manifest, for example 26.1.",
    )
    parser.add_argument(
        "--datapack-release",
        required=True,
        help="Immutable datapack release identifier, such as a release tag or commit SHA.",
    )
    parser.add_argument(
        "--resource-pack-release",
        required=True,
        help="Exact TGC resource-pack release identifier used with this datapack release.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"Manifest destination (default: {DEFAULT_OUTPUT.as_posix()}).",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Fail if the destination is missing or differs; do not write.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)

    try:
        manifest = export_manifest(
            args.datapack,
            args.minecraft_version,
            args.datapack_release,
            args.resource_pack_release,
        )
        rendered = render_manifest(manifest)
    except ExportError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    output = args.output.resolve()

    if args.check:
        if not output.is_file():
            print(f"error: manifest does not exist: {output}", file=sys.stderr)
            return 1
        if output.read_text(encoding="utf-8") != rendered:
            print(
                f"error: manifest is stale: {output}\nRun the exporter without --check to update it.",
                file=sys.stderr,
            )
            return 1
        print(
            f"Kit manifest is current: {len(manifest['kits'])} kits, "
            f"{sum(len(kit['operations']) for kit in manifest['kits'])} operations."
        )
        return 0

    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_name(f".{output.name}.tmp")
    temporary.write_text(rendered, encoding="utf-8")
    temporary.replace(output)
    print(
        f"Exported {len(manifest['kits'])} kits and "
        f"{sum(len(kit['operations']) for kit in manifest['kits'])} operations to {output}."
    )
    return 0

