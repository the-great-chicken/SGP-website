import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

export type JsonValue =
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type KitItem = {
  id: string;
  count: number;
  components: Record<string, JsonValue>;
  removedComponents: string[];
};

export type KitOperation = {
  kind: "give" | "replace";
  slot?: string;
  item: KitItem;
  source: {
    line: number;
    endLine: number;
  };
};

export type KitAbility = {
  path: string;
  name: string;
  description: string;
  activationKeybind: string;
  descriptionComponents: JsonValue[];
};

export type KitDefinition = {
  id: number | null;
  key: string;
  name: string | null;
  color: string | null;
  icon: string | null;
  ability: KitAbility | null;
  function: string;
  operations: KitOperation[];
};

export type KitManifest = {
  schemaVersion: 2;
  minecraftVersion: string;
  dataPack: {
    id: string;
    minFormat: number;
    maxFormat: number;
  };
  kits: KitDefinition[];
};

const manifestPath = path.join(process.cwd(), "data", "kit-manifest.json");

const kitNameOverrides: Record<string, string> = {
  eclaireur: "Éclaireur",
  peaceful: "Paisible",
};

const minecraftColors: Record<string, string> = {
  aqua: "#55ffff",
  black: "#111419",
  blue: "#5555ff",
  dark_aqua: "#00aaaa",
  dark_blue: "#3448a4",
  dark_gray: "#555b66",
  dark_green: "#00aa58",
  dark_purple: "#aa00aa",
  dark_red: "#aa2430",
  gold: "#f0ad37",
  gray: "#a5a8b0",
  green: "#55ff82",
  light_purple: "#ff70dc",
  red: "#ff555f",
  white: "#f5f3ea",
  yellow: "#fff06a",
};

export async function loadKitManifest(): Promise<KitManifest | null> {
  let source: string;

  try {
    source = await readFile(manifestPath, "utf8");
  } catch (error) {
    if (isMissingFile(error)) {
      return null;
    }
    throw error;
  }

  const manifest: unknown = JSON.parse(source);
  if (!isKitManifest(manifest)) {
    throw new Error(`Unsupported kit manifest at ${manifestPath}`);
  }
  return manifest;
}

export function formatKitName(key: string): string {
  if (kitNameOverrides[key]) {
    return kitNameOverrides[key];
  }
  return key
    .split("_")
    .map((part) => part.charAt(0).toLocaleUpperCase("fr-FR") + part.slice(1))
    .join(" ");
}

export function getKitDisplayName(kit: KitDefinition): string {
  return kit.name ?? formatKitName(kit.key);
}

export function getItemDisplayName(item: KitItem): string {
  const customName = item.components["minecraft:custom_name"];
  if (isJsonObject(customName) && typeof customName.text === "string") {
    return customName.text;
  }
  const pathPart = item.id.split(":").at(-1) ?? item.id;
  return pathPart.replaceAll("_", " ");
}

export function getKitAccent(kit: KitDefinition): string {
  if (kit.color && minecraftColors[kit.color]) {
    return minecraftColors[kit.color];
  }

  for (const operation of kit.operations) {
    const customName = operation.item.components["minecraft:custom_name"];
    if (!isJsonObject(customName) || typeof customName.color !== "string") {
      continue;
    }
    if (customName.color.startsWith("#")) {
      return customName.color;
    }
    if (minecraftColors[customName.color]) {
      return minecraftColors[customName.color];
    }
  }
  return "#f0ad37";
}

function isKitManifest(value: unknown): value is KitManifest {
  if (!isJsonObject(value)) {
    return false;
  }
  return (
    value.schemaVersion === 2 &&
    typeof value.minecraftVersion === "string" &&
    Array.isArray(value.kits)
  );
}

function isJsonObject(value: unknown): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMissingFile(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
