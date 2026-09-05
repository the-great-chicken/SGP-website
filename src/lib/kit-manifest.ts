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

export type KitCardItem = {
  id: string;
  name: string;
  abbreviation: string;
};

export type KitCardView = {
  id: number | null;
  key: string;
  name: string;
  accent: string;
  abilityName: string | null;
  operationCount: number;
  itemCount: number;
  featuredItems: KitCardItem[];
  searchText: string;
};

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

const keybindNames: Record<string, string> = {
  "key.drop": "Jeter l’objet",
  "key.use": "Utiliser l’objet",
};

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

export function getMinecraftText(value: JsonValue | undefined): string {
  if (value === undefined || typeof value === "boolean") {
    return "";
  }
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(getMinecraftText).join("");
  }

  const ownText =
    typeof value.text === "string"
      ? value.text
      : typeof value.keybind === "string"
        ? formatActivationKeybind(value.keybind)
        : typeof value.translate === "string"
          ? value.translate
          : "";
  return ownText + getMinecraftText(value.extra);
}

export function getItemDisplayName(item: KitItem): string {
  const customName = getMinecraftText(item.components["minecraft:custom_name"]).trim();
  if (customName) {
    return customName;
  }
  const pathPart = item.id.split(":").at(-1) ?? item.id;
  return formatIdentifier(pathPart);
}

export function getItemLore(item: KitItem): JsonValue[] {
  const lore = item.components["minecraft:lore"];
  return Array.isArray(lore) ? lore : [];
}

export function getItemAbbreviation(item: KitItem): string {
  const words = getItemDisplayName(item)
    .replace(/[’']/g, " ")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 2);
  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toLocaleUpperCase("fr-FR");
  }
  return (words[0] ?? "?").slice(0, 2).toLocaleUpperCase("fr-FR");
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
    const color = getMinecraftColor(customName.color);
    if (color) {
      return color;
    }
  }
  return "#f0ad37";
}

export function getMinecraftColor(color: string): string | undefined {
  if (minecraftColors[color]) {
    return minecraftColors[color];
  }
  return /^#[0-9a-f]{6}$/i.test(color) ? color : undefined;
}

export function formatActivationKeybind(keybind: string): string {
  return keybindNames[keybind] ?? formatIdentifier(keybind.replace(/^key\./, ""));
}

export function compareKits(a: KitDefinition, b: KitDefinition): number {
  if (a.id === null && b.id !== null) {
    return 1;
  }
  if (a.id !== null && b.id === null) {
    return -1;
  }
  if (a.id !== null && b.id !== null && a.id !== b.id) {
    return a.id - b.id;
  }
  return getKitDisplayName(a).localeCompare(getKitDisplayName(b), "fr-FR");
}

export function toKitCardView(kit: KitDefinition): KitCardView {
  const featuredItems = kit.operations.slice(0, 3).map(({ item }) => ({
    id: item.id,
    name: getItemDisplayName(item),
    abbreviation: getItemAbbreviation(item),
  }));
  const itemNames = kit.operations.map(({ item }) => getItemDisplayName(item));

  return {
    id: kit.id,
    key: kit.key,
    name: getKitDisplayName(kit),
    accent: getKitAccent(kit),
    abilityName: kit.ability?.name ?? null,
    operationCount: kit.operations.length,
    itemCount: kit.operations.reduce((sum, operation) => sum + operation.item.count, 0),
    featuredItems,
    searchText: [getKitDisplayName(kit), kit.ability?.name, ...itemNames]
      .filter(Boolean)
      .join(" ")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLocaleLowerCase("fr-FR"),
  };
}

export function isJsonObject(value: JsonValue | undefined): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatIdentifier(value: string): string {
  return value
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toLocaleUpperCase("fr-FR") + part.slice(1))
    .join(" ");
}
