import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import { assetPath, particleColor, particleSprite, particleTextures, payloadVisuals } from "../scripts/cosmetic-rendering.mjs";
import { withCosmeticIcons } from "../src/cosmetics/icons";
import type { CosmeticView } from "../src/cosmetics/model";

test("new entities select assets from block states and item stacks, without entity ID mappings", () => {
  assert.deepEqual(payloadVisuals({ BlockState: { Name: "minecraft:diamond_block", Properties: { axis: "x" } } }), [
    { kind: "block", id: "minecraft:diamond_block", data: { axis: "x" } },
  ]);
  assert.deepEqual(payloadVisuals({ item: { id: "minecraft:amethyst_shard", count: 1, components: { "minecraft:item_model": "test:new" } } }), [
    { kind: "item", id: "minecraft:amethyst_shard", data: { "minecraft:item_model": "test:new" } },
  ]);
  assert.deepEqual(payloadVisuals({ CustomName: "An unsupported mob", Health: 20 }), []);
});

test("new particle definitions and client-derived emitters select their actual textures", async () => {
  const files: Record<string, unknown> = {
    "assets/test/particles/new.json": { textures: ["test:first", "test:middle", "test:last"] },
  };
  const read = async (file: string) => files[file] ?? null;
  assert.deepEqual(await particleTextures("test:new", read, {}), ["assets/test/textures/particle/middle.png"]);
  assert.deepEqual(await particleTextures("test:emitter", read, { "test:emitter": ["test:new"] }), ["assets/test/textures/particle/middle.png"]);
  await assert.rejects(particleTextures("test:missing", read, {}), /no sprite/);
  await assert.rejects(particleTextures("test:loop", read, { "test:loop": ["test:loop"] }), /Recursive/);
  assert.throws(() => assetPath("test:../../secret", "particles", "json"), /Invalid/);
});

test("particle color options override neutral-mask accents while colored pack artwork is preserved", async () => {
  assert.equal(particleColor({ color: [1, 0.5, 0] }), "#ff8000");
  assert.equal(particleColor({ color: 0xabcdef }), "#abcdef");
  assert.throws(() => particleColor({ color: [2, 0, 0] }), /Unsupported/);
  const white = await sharp({ create: { width: 4, height: 4, channels: 4, background: "#ffffff" } }).png().toBuffer();
  const tinted = await particleSprite(white, "#123456");
  const pixel = await sharp(tinted).raw().toBuffer();
  const center = (52 * 104 + 52) * 4;
  assert.deepEqual([...pixel.subarray(center, center + 3)], [0x12, 0x34, 0x56]);
  const red = await sharp({ create: { width: 4, height: 4, channels: 4, background: "#ff0000" } }).png().toBuffer();
  const preserved = await sharp(await particleSprite(red, "#123456")).raw().toBuffer();
  assert.deepEqual([...preserved.subarray(center, center + 3)], [255, 0, 0]);
  assert.equal(preserved[3], 0, "Transparent padding is preserved");
  const dot = await sharp({ create: { width: 1, height: 1, channels: 4, background: "#ffffff" } }).png().toBuffer();
  const small = await sharp(await particleSprite(dot, "#ffffff")).raw().toBuffer();
  assert.equal([...small].filter((value, index) => index % 4 === 3 && value > 0).length, 13 * 13, "A single pixel stays a small dot instead of becoming a solid tile");
});

test("generated images are matched to live metadata and missing images never block equipping", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "sgp-cosmetic-icons-"));
  const file = path.join(directory, "index.json");
  const view: CosmeticView = { status: "live", observedAt: 1, equipment: { particle: null, intensity: null, kill: null }, issues: [],
    cosmetics: [{ id: "particle.new", category: "particle", name: "New", color: "#123456", sortOrder: 0 }] };
  try {
    assert.deepEqual((await withCosmeticIcons(view, file)).icons, {});
    await writeFile(file, JSON.stringify({ schemaVersion: 1, cosmetics: { "particle.new": { name: "New", color: "#123456", image: "/generated/cosmetic-icons/new.png" } } }));
    assert.equal((await withCosmeticIcons(view, file)).icons?.["particle.new"], "/generated/cosmetic-icons/new.png");
    assert.deepEqual((await withCosmeticIcons({ ...view, cosmetics: [{ ...view.cosmetics[0], color: "#abcdef" }] }, file)).icons, {});
  } finally { await rm(directory, { recursive: true }); }
});
