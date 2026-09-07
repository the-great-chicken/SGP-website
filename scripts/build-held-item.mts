import { Group } from "three";
import { loadModel, parseItemDefinition, resolveModelData, type PreparedAssets } from "block-model-renderer";
import { getItemRenderInput } from "../src/lib/item-rendering";
import type { KitItem } from "../src/lib/kit-manifest";

export async function buildHeldItem(item: KitItem, assets: PreparedAssets, version: string) {
  const input = getItemRenderInput(item);
  const display = "thirdperson_righthand";
  const references = await parseItemDefinition(assets, input.id, { data: input.components, display, version });
  if (!references.length) throw new Error(`No held-item model for ${item.id}`);
  const root = new Group();
  for (const reference of references) {
    const model = await resolveModelData(assets, reference);
    root.add(await loadModel(null, assets, model, { display, version, lighting: "item" }));
  }
  root.traverse((object) => { object.userData = {}; });
  root.userData = { item: item.id, display, minecraftVersion: version };
  root.updateMatrixWorld(true);
  return root.toJSON();
}
