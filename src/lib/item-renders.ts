import "server-only";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { KitItem } from "./kit-manifest";
import { getItemRenderSignature, type ItemRenderIndex } from "./item-rendering";

const indexPath = path.join(process.cwd(), "data", "item-renders.json");

export type ItemImageResolver = (item: KitItem) => string | null;

export async function loadItemImageResolver(): Promise<ItemImageResolver> {
  let source: string;

  try {
    source = await readFile(indexPath, "utf8");
  } catch (error) {
    if (isMissingFile(error)) {
      return () => null;
    }
    throw error;
  }

  const index: unknown = JSON.parse(source);
  if (!isItemRenderIndex(index)) {
    throw new Error(`Unsupported item render index at ${indexPath}`);
  }

  return (item) => index.items[getItemRenderKey(item)] ?? null;
}

export function getItemRenderKey(item: KitItem): string {
  return createHash("sha256").update(getItemRenderSignature(item)).digest("hex");
}

function isItemRenderIndex(value: unknown): value is ItemRenderIndex {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<ItemRenderIndex>;
  return (
    candidate.schemaVersion === 1 &&
    typeof candidate.minecraftVersion === "string" &&
    (candidate.resourcePackVersion === null || typeof candidate.resourcePackVersion === "string") &&
    typeof candidate.items === "object" &&
    candidate.items !== null &&
    !Array.isArray(candidate.items) &&
    Object.values(candidate.items).every((item) => typeof item === "string")
  );
}

function isMissingFile(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
