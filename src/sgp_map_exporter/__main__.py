import argparse
import json
from pathlib import Path

from .exporter import export_overlays


def main():
    parser = argparse.ArgumentParser(description="Export BlueMap overlays from a saved Minecraft 26.1 world.")
    parser.add_argument("--world", type=Path, required=True)
    parser.add_argument("--maps", type=Path, required=True, help="JSON map-selection configuration")
    parser.add_argument("--resource-pack", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    overlays = export_overlays(args.world, json.loads(args.maps.read_text(encoding="utf-8")), args.resource_pack)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(overlays, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(f"Exported map overlays: {args.output}")


if __name__ == "__main__":
    main()
