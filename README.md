# SGP website

This repository owns the build-time exporters and, eventually, the website that consumes their output. The SGP datapack remains independently runnable and is never modified by these tools.

## Kit manifest exporter

`items.mcfunction` remains the authoritative source for every kit loadout. The exporter uses Mecha to parse those functions and writes a deterministic, versioned JSON manifest for the website.

The exporter deliberately accepts only these command shapes:

```mcfunction
give @s <item> [count]
item replace entity @s <slot> with <item> [count]
```

Any other command, selector or ambiguous loadout stops the export with its source location. New Minecraft components do not require exporter changes because component values are copied as a generic JSON-compatible tree.

### Setup

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[test]"
```

### Export

```powershell
.\.venv\Scripts\python.exe -m sgp_kit_exporter --datapack ..\server\world\datapacks\TGCdatapack --minecraft-version 26.1
```

The default output is `data/kit-manifest.json`. Pass `--output <path>` to write elsewhere.

### Check generated data

```powershell
.\.venv\Scripts\python.exe -m sgp_kit_exporter --datapack ..\server\world\datapacks\TGCdatapack --minecraft-version 26.1 --check
```

`--check` performs the full export in memory and fails without writing if the committed manifest differs.

### Tests

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```
