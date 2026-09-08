import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { CosmeticView } from "./model";

const indexSchema = z.object({
  schemaVersion: z.literal(1),
  cosmetics: z.record(z.string(), z.object({
    name: z.string(), color: z.string(),
    image: z.string().regex(/^\/generated\/cosmetic-icons\/[a-zA-Z0-9_.-]+\.png$/),
  })),
});

export async function withCosmeticIcons(view: CosmeticView, filename = path.join(process.cwd(), "data/cosmetic-renders.json")): Promise<CosmeticView> {
  let contents: string;
  try { contents = await readFile(filename, "utf8"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { ...view, icons: {} };
    throw error;
  }
  const index = indexSchema.parse(JSON.parse(contents));
  const icons: Record<string, string> = {};
  for (const cosmetic of view.cosmetics) {
    const entry = index.cosmetics[cosmetic.id];
    if (entry?.name === cosmetic.name && entry.color === cosmetic.color) icons[cosmetic.id] = entry.image;
  }
  return { ...view, icons };
}
