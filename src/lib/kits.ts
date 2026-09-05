import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { JsonValue, KitManifest } from "./kit-manifest";

const manifestPath = path.join(process.cwd(), "data", "kit-manifest.json");

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

function isKitManifest(value: unknown): value is KitManifest {
  if (!isJsonObject(value)) {
    return false;
  }
  return (
    value.schemaVersion === 3 &&
    typeof value.datapackRelease === "string" &&
    value.datapackRelease.length > 0 &&
    typeof value.resourcePackRelease === "string" &&
    value.resourcePackRelease.length > 0 &&
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
