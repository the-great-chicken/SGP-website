import assert from "node:assert/strict";
import test from "node:test";
import { patchPotionTintSource } from "../scripts/patch-block-model-renderer.mjs";

const upstreamPotionTint = `before
        } else if (type === "potion" && normalizedData["potion_contents"]?.potion) {
          const color = getPotionColor(normalizedData["potion_contents"].potion, itemColors)
          tints.push(color ?? parseColor(tint.default ?? -13083194))
after`;

test("renderer compatibility patch gives custom potion colors priority", () => {
  const patched = patchPotionTintSource(upstreamPotionTint);

  assert.equal(patched.changed, true);
  assert.match(patched.source, /potionContents\.custom_color !== undefined/);
  assert.match(patched.source, /tints\.push\(parseColor\(potionContents\.custom_color\)\)/);
  assert.match(patched.source, /Array\.isArray\(potionContents\.custom_effects\)/);
  assert.match(patched.source, /itemColors\.tables\.potions/);
  assert.match(patched.source, /effects\.push\(\.\.\.potionContents\.custom_effects\)/);
  assert.match(patched.source, /else if \(potionContents\.potion\)/);
});

test("renderer compatibility patch is idempotent", () => {
  const first = patchPotionTintSource(upstreamPotionTint);
  const second = patchPotionTintSource(first.source);

  assert.equal(second.changed, false);
  assert.equal(second.source, first.source);
});
