import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import sharp from "sharp";
import { prepareAssets, readFile as readAsset, renderBlock, renderItem, renderTexture } from "block-model-renderer";
import { collage, intensityDots, particleColor, particleSprite, particleTextures, payloadVisuals, type Effect, type EffectExport } from "./cosmetic-rendering.mts";

const run = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));

async function main() {
  const args = process.argv.slice(2);
  const options: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!["--datapack", "--resource-pack", "--minecraft-client", "--minecraft-version"].includes(args[i]) || !args[i + 1]) throw new Error(`Unknown or incomplete option: ${args[i]}`);
    options[args[i]] = args[i + 1];
  }
  for (const key of ["--datapack", "--resource-pack", "--minecraft-client", "--minecraft-version"]) if (!options[key]) throw new Error(`Missing ${key}`);
  const python = process.env.COSMETICS_PYTHON ?? path.join(root, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
  const { stdout } = await run(python, [path.join(root, "scripts/cosmetic-effects.py"), "--datapack", path.resolve(options["--datapack"]), "--minecraft-client", path.resolve(options["--minecraft-client"])], {
    encoding: "utf8", maxBuffer: 16 * 1024 * 1024, windowsHide: true,
    env: { ...process.env, PYTHONUTF8: "1", PYTHONDONTWRITEBYTECODE: "1" },
  });
  const exported = JSON.parse(stdout) as EffectExport;
  const assets = await prepareAssets([path.resolve(options["--resource-pack"]), path.resolve(options["--minecraft-client"])], { cache: true, version: options["--minecraft-version"] });
  async function json(file: string): Promise<unknown | null> {
    const bytes = await readAsset(file, assets);
    return bytes ? JSON.parse(Buffer.from(bytes).toString("utf8")) : null;
  }
  const rendered = new Map<string, Promise<Uint8Array[]>>();
  function images(effect: Effect, color: string) {
    const signature = JSON.stringify({ ...effect, count: undefined, source: undefined, color });
    if (!rendered.has(signature)) rendered.set(signature, renderEffect(effect, color));
    return rendered.get(signature)!;
  }
  async function renderEffect(effect: Effect, color: string): Promise<Uint8Array[]> {
    const payload = effect.kind === "entity" ? effect.nbt : effect.options;
    const visuals = payloadVisuals(payload);
    // Particle options carry block states or item stacks too; these use the same asset renderer.
    if (visuals.length) return Promise.all(visuals.map((visual) => visual.kind === "block"
      ? renderBlock({ id: visual.id, blockstates: visual.data as Record<string, string>, assets, version: options["--minecraft-version"], width: 112, height: 112 })
      : renderItem({ id: visual.id, components: visual.data, assets, version: options["--minecraft-version"], width: 112, height: 112 })));
    if (effect.kind === "entity") throw new Error(`Unsupported entity shape ${effect.id} at ${effect.source}: summon data has no block state or item stack`);
    const textures = await particleTextures(effect.id, json, exported.particleChildren);
    return Promise.all(textures.map(async (texture) => particleSprite(await renderTexture({ texture, assets }), color, particleColor(effect.options ?? {}))));
  }
  const directory = path.join(process.cwd(), "public/generated/cosmetic-icons");
  await mkdir(directory, { recursive: true });
  await mkdir(path.join(process.cwd(), "data"), { recursive: true });
  const entries: Record<string, { name: string; color: string; image: string }> = {};
  const intensityCount = (effects: Effect[]) => Math.max(1, ...effects.map((effect) => effect.count ?? 0));
  const maximum = Math.max(1, ...exported.cosmetics.filter((c) => c.category === "intensity").map((c) => intensityCount(c.effects)));
  const errors: string[] = [];
  for (const cosmetic of exported.cosmetics) {
    try {
      let output: Buffer;
      if (cosmetic.category === "intensity") {
        output = await sharp(intensityDots(intensityCount(cosmetic.effects), maximum, cosmetic.color)).png().toBuffer();
      } else {
        const buffers = (await Promise.all(cosmetic.effects.map((effect) => images(effect, cosmetic.color)))).flat();
        const unique = [...new Map(buffers.map((image) => [createHash("sha256").update(image).digest("hex"), image])).values()];
        output = await collage(unique, cosmetic.color);
      }
      const hash = createHash("sha256").update(output).digest("hex").slice(0, 20);
      const filename = `${cosmetic.id}-${hash}.png`;
      await writeFile(path.join(directory, filename), output);
      entries[cosmetic.id] = { name: cosmetic.name, color: cosmetic.color, image: `/generated/cosmetic-icons/${filename}` };
      console.log(`Rendered ${cosmetic.id}`);
    } catch (error) {
      errors.push(`${cosmetic.id}: ${error instanceof Error ? error.message : error}`);
    }
  }
  if (errors.length) throw new Error(`Cosmetic images were not published:\n${errors.join("\n")}`);
  const index = { schemaVersion: 1, sourceHash: exported.sourceHash, minecraftVersion: options["--minecraft-version"], cosmetics: entries };
  const target = path.join(process.cwd(), "data/cosmetic-renders.json");
  await writeFile(`${target}.tmp`, JSON.stringify(index, null, 2) + "\n");
  await rename(`${target}.tmp`, target);
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
