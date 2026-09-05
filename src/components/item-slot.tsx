import { Box } from "lucide-react";
import { MinecraftText } from "@/components/minecraft-text";
import {
  getItemAbbreviation,
  getItemDisplayName,
  getItemLore,
  type KitOperation,
} from "@/lib/kit-manifest";

type ItemSlotProps = {
  operation?: KitOperation;
  slotLabel: string;
  compact?: boolean;
};

export function ItemSlot({ operation, slotLabel, compact = false }: ItemSlotProps) {
  if (!operation) {
    return (
      <div className="inventory-entry is-empty" aria-label={`${slotLabel} vide`}>
        <span className="inventory-slot-label">{slotLabel}</span>
        <span className="item-slot-visual" aria-hidden="true" />
      </div>
    );
  }

  const { item } = operation;
  const name = getItemDisplayName(item);
  const nameComponent = item.components["minecraft:custom_name"];
  const lore = getItemLore(item);
  const enchantments = item.components["minecraft:enchantments"];
  const glintOverride = item.components["minecraft:enchantment_glint_override"];
  const hasGlint =
    glintOverride === true ||
    (glintOverride !== false && typeof enchantments === "object" && enchantments !== null);

  return (
    <div
      className={`inventory-entry${compact ? " is-compact" : ""}`}
      tabIndex={0}
      aria-label={`${slotLabel} : ${name}, quantité ${item.count}`}
    >
      <span className="inventory-slot-label">{slotLabel}</span>
      <span className={`item-slot-visual${hasGlint ? " has-glint" : ""}`} aria-hidden="true">
        <Box size={compact ? 18 : 24} strokeWidth={1.55} />
        <span className="item-monogram">{getItemAbbreviation(item)}</span>
        {item.count > 1 ? <strong className="stack-count">{item.count}</strong> : null}
      </span>
      <span className="minecraft-tooltip" role="tooltip">
        <strong className="minecraft-tooltip-name">
          {nameComponent ? <MinecraftText value={nameComponent} /> : name}
        </strong>
        {lore.length ? (
          <span className="minecraft-tooltip-lore">
            {lore.map((line, index) => (
              <MinecraftText className="minecraft-tooltip-line" value={line} key={index} />
            ))}
          </span>
        ) : null}
        <span className="minecraft-tooltip-meta">
          <span>{item.id}</span>
          <span>{operation.slot ?? "Ajout à l’inventaire"}</span>
        </span>
      </span>
    </div>
  );
}
