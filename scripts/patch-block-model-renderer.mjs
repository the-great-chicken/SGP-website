import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ORIGINAL_POTION_TINT = `        } else if (type === "potion" && normalizedData["potion_contents"]?.potion) {
          const color = getPotionColor(normalizedData["potion_contents"].potion, itemColors)
          tints.push(color ?? parseColor(tint.default ?? -13083194))`;

const PATCHED_POTION_TINT = `        } else if (type === "potion" && normalizedData["potion_contents"]) {
          const potionContents = normalizedData["potion_contents"]
          if (potionContents.custom_color !== undefined && potionContents.custom_color !== null) {
            tints.push(parseColor(potionContents.custom_color))
          } else if (Array.isArray(potionContents.custom_effects) && potionContents.custom_effects.length) {
            const effects = []
            if (potionContents.potion) {
              for (const entry of itemColors.tables.potions[normalize(potionContents.potion)] ?? []) {
                const [id, amplifier] = Array.isArray(entry) ? entry : [entry, 0]
                effects.push({ id, amplifier })
              }
            }
            effects.push(...potionContents.custom_effects)
            let red = 0, green = 0, blue = 0, totalWeight = 0
            for (const effect of effects) {
              const colorHex = itemColors.tables.effects[normalize(effect?.id ?? "")]
              if (colorHex === undefined) continue
              const color = parseInt(String(colorHex).replace("#", ""), 16)
              const rawAmplifier = Number(effect?.amplifier ?? 0)
              const amplifier = Number.isFinite(rawAmplifier) ? Math.max(0, Math.trunc(rawAmplifier)) : 0
              const weight = amplifier + 1
              red += weight * ((color >> 16) & 0xFF)
              green += weight * ((color >> 8) & 0xFF)
              blue += weight * (color & 0xFF)
              totalWeight += weight
            }
            const color = totalWeight
              ? "#" + (((Math.round(red / totalWeight) << 16) | (Math.round(green / totalWeight) << 8) | Math.round(blue / totalWeight)) >>> 0).toString(16).padStart(6, "0")
              : parseColor(tint.default ?? -13083194)
            tints.push(color)
          } else if (potionContents.potion) {
            const color = getPotionColor(potionContents.potion, itemColors)
            tints.push(color ?? parseColor(tint.default ?? -13083194))
          } else {
            tints.push(parseColor(tint.default ?? -13083194))
          }`

export function patchPotionTintSource(source) {
  if (source.includes(PATCHED_POTION_TINT)) {
    return { source, changed: false };
  }
  if (!source.includes(ORIGINAL_POTION_TINT)) {
    throw new Error(
      "block-model-renderer potion tint implementation changed; review the local compatibility patch",
    );
  }
  return {
    source: source.replace(ORIGINAL_POTION_TINT, PATCHED_POTION_TINT),
    changed: true,
  };
}

export async function ensureBlockModelRendererPotionTintPatch() {
  let packageEntry;
  try {
    packageEntry = import.meta.resolve("block-model-renderer");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ERR_MODULE_NOT_FOUND") {
      console.log("block-model-renderer is not installed; skipping potion tint compatibility patch");
      return;
    }
    throw error;
  }
  const nodeEntryPath = fileURLToPath(packageEntry);
  const modelsPath = path.join(path.dirname(nodeEntryPath), "core", "models.js");
  const source = await readFile(modelsPath, "utf8");
  const patched = patchPotionTintSource(source);
  if (patched.changed) {
    await writeFile(modelsPath, patched.source, "utf8");
    console.log("Patched block-model-renderer to honor potion_contents.custom_color");
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  ensureBlockModelRendererPotionTintPatch().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
