import type { KitItem, KitOperation } from "./kit-manifest";
import { stableStringify } from "./item-rendering";

const hotbarSlots = Array.from({ length: 9 }, (_, index) => `hotbar.${index}`);
const inventorySlots = Array.from({ length: 27 }, (_, index) => `inventory.${index}`);
const playerStorageSlots = [...hotbarSlots, ...inventorySlots];

const unstackableItems = new Set([
  "bow",
  "crossbow",
  "trident",
  "mace",
  "shield",
  "elytra",
  "fishing_rod",
  "flint_and_steel",
  "shears",
  "brush",
  "carrot_on_a_stick",
  "warped_fungus_on_a_stick",
  "goat_horn",
  "wolf_armor",
  "turtle_helmet",
  "potion",
  "splash_potion",
  "lingering_potion",
  "enchanted_book",
  "written_book",
  "bundle",
  "water_bucket",
  "lava_bucket",
  "milk_bucket",
  "powder_snow_bucket",
  "cod_bucket",
  "salmon_bucket",
  "pufferfish_bucket",
  "tropical_fish_bucket",
  "axolotl_bucket",
  "tadpole_bucket",
]);

const sixteenStackItems = new Set([
  "egg",
  "snowball",
  "ender_pearl",
  "bucket",
  "honey_bottle",
  "armor_stand",
]);

export type ResolvedKitSlot = {
  slot: string;
  operation: KitOperation;
  /**
   * The manifest item whose generated image should be reused. Synthetic stacks created while
   * simulating /give can have a different count, so their render signature does not necessarily
   * exist in data/item-renders.json.
   */
  renderItem: KitItem;
};

export type ResolvedKitLoadout = {
  bySlot: Map<string, ResolvedKitSlot>;
  inventory: ResolvedKitSlot[];
  overflow: ResolvedKitSlot[];
};

/**
 * Resolve the command sequence into the inventory that a player actually ends up with.
 *
 * `item replace` targets an explicit slot. `/give`, on the other hand, has no slot in the
 * datapack source: Minecraft first tops up compatible stacks, then fills free player-storage
 * slots from the hotbar into the main inventory. Simulating that distinction keeps `/give`
 * items out of the generic “Inventaire” bucket when they really belong in the hotbar.
 */
export function resolveKitLoadout(operations: KitOperation[]): ResolvedKitLoadout {
  const bySlot = new Map<string, ResolvedKitSlot>();
  const overflow: ResolvedKitSlot[] = [];

  for (const operation of operations.toSorted(compareOperations)) {
    if (operation.kind === "replace" && operation.slot) {
      bySlot.set(operation.slot, {
        slot: operation.slot,
        operation: cloneOperation(operation),
        renderItem: operation.item,
      });
      continue;
    }

    if (operation.kind !== "give") {
      continue;
    }

    placeGivenItem(bySlot, overflow, operation);
  }

  return {
    bySlot,
    inventory: inventorySlots.flatMap((slot) => {
      const entry = bySlot.get(slot);
      return entry ? [entry] : [];
    }),
    overflow,
  };
}

function placeGivenItem(
  bySlot: Map<string, ResolvedKitSlot>,
  overflow: ResolvedKitSlot[],
  operation: KitOperation,
) {
  const maxStackSize = getMaxStackSize(operation.item);
  let remaining = Math.max(0, Math.trunc(operation.item.count));

  // Minecraft fills matching non-full stacks before occupying a new slot.
  if (maxStackSize > 1) {
    for (const slot of playerStorageSlots) {
      if (!remaining) break;
      const existing = bySlot.get(slot);
      if (!existing || !canStack(existing.operation.item, operation.item)) continue;

      const room = Math.max(0, maxStackSize - existing.operation.item.count);
      if (!room) continue;

      const added = Math.min(room, remaining);
      existing.operation = withItemCount(existing.operation, existing.operation.item.count + added);
      remaining -= added;
    }
  }

  for (const slot of playerStorageSlots) {
    if (!remaining) break;
    if (bySlot.has(slot)) continue;

    const count = Math.min(maxStackSize, remaining);
    bySlot.set(slot, {
      slot,
      operation: withItemCount(operation, count),
      renderItem: operation.item,
    });
    remaining -= count;
  }

  // `/give` drops anything that cannot fit. This is deliberately not reported as “Inventaire”.
  while (remaining > 0) {
    const count = Math.min(maxStackSize, remaining);
    overflow.push({
      slot: "overflow",
      operation: withItemCount(operation, count),
      renderItem: operation.item,
    });
    remaining -= count;
  }
}

function compareOperations(a: KitOperation, b: KitOperation) {
  return a.source.line - b.source.line || a.source.endLine - b.source.endLine;
}

function cloneOperation(operation: KitOperation): KitOperation {
  return {
    ...operation,
    item: {
      ...operation.item,
      components: { ...operation.item.components },
      removedComponents: [...operation.item.removedComponents],
    },
  };
}

function withItemCount(operation: KitOperation, count: number): KitOperation {
  return {
    ...operation,
    item: {
      ...operation.item,
      count,
      components: { ...operation.item.components },
      removedComponents: [...operation.item.removedComponents],
    },
  };
}

function canStack(a: KitItem, b: KitItem) {
  return (
    a.id === b.id &&
    stableStringify(a.components) === stableStringify(b.components) &&
    stableStringify(a.removedComponents) === stableStringify(b.removedComponents)
  );
}

export function getMaxStackSize(item: KitItem): number {
  const componentValue = item.components["minecraft:max_stack_size"];
  if (typeof componentValue === "number" && Number.isFinite(componentValue)) {
    return clampStackSize(componentValue);
  }

  if (typeof item.components["minecraft:max_damage"] === "number") return 1;

  const id = stripNamespace(item.id);
  if (isUnstackableItem(id)) return 1;
  if (isSixteenStackItem(id)) return 16;
  return 64;
}

function clampStackSize(value: number) {
  return Math.max(1, Math.min(99, Math.trunc(value)));
}

function stripNamespace(id: string) {
  const separator = id.indexOf(":");
  return separator === -1 ? id : id.slice(separator + 1);
}

function isUnstackableItem(id: string) {
  if (
    /_(?:sword|pickaxe|axe|shovel|hoe|helmet|chestplate|leggings|boots|horse_armor|boat|chest_boat|raft|chest_raft|minecart|bed)$/.test(
      id,
    )
  ) {
    return true;
  }
  return unstackableItems.has(id);
}

function isSixteenStackItem(id: string) {
  if (/(?:_sign|_hanging_sign|_banner)$/.test(id)) return true;
  return sixteenStackItems.has(id);
}
