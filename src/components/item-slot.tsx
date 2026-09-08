"use client";

import { Box } from "lucide-react";
import Image from "next/image";
import { useId, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
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
  imageSrc?: string | null;
  showLabel?: boolean;
};

type TooltipPosition = {
  top: number;
  left?: number;
  right?: number;
};

export function ItemSlot({ operation, slotLabel, compact = false, imageSrc, showLabel = true }: ItemSlotProps) {
  const tooltipId = useId();
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);

  if (!operation) {
    return (
      <div className="inventory-entry is-empty" aria-label={`${slotLabel} vide`}>
        {showLabel ? <span className="inventory-slot-label">{slotLabel}</span> : null}
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

  function showTooltip(element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    const alignRight = rect.left + rect.width / 2 > window.innerWidth / 2;
    const edgeGap = 12;
    const anchorGap = 8;
    setTooltipPosition({
      top: rect.top - anchorGap,
      ...(alignRight
        ? { right: Math.max(edgeGap, window.innerWidth - rect.right - anchorGap) }
        : { left: Math.max(edgeGap, rect.left - anchorGap) }),
    });
  }

  const tooltipStyle: CSSProperties | undefined = tooltipPosition
    ? {
        top: tooltipPosition.top,
        ...(tooltipPosition.left === undefined ? {} : { left: tooltipPosition.left }),
        ...(tooltipPosition.right === undefined ? {} : { right: tooltipPosition.right }),
      }
    : undefined;

  return (
    <div
      className={`inventory-entry${compact ? " is-compact" : ""}`}
      tabIndex={0}
      aria-label={`${slotLabel} : ${name}, quantité ${item.count}`}
      aria-describedby={tooltipPosition ? tooltipId : undefined}
      onMouseEnter={(event) => showTooltip(event.currentTarget)}
      onMouseLeave={() => setTooltipPosition(null)}
      onFocus={(event) => showTooltip(event.currentTarget)}
      onBlur={() => setTooltipPosition(null)}
    >
      {showLabel ? <span className="inventory-slot-label">{slotLabel}</span> : null}
      <span
        className={`item-slot-visual${hasGlint && !imageSrc ? " has-glint" : ""}`}
        aria-hidden="true"
      >
        {imageSrc ? (
          <Image
            className="item-render"
            src={imageSrc}
            alt=""
            width={128}
            height={128}
            sizes={compact ? "36px" : "52px"}
            draggable={false}
            unoptimized
          />
        ) : (
          <>
            <Box size={compact ? 18 : 24} strokeWidth={1.55} />
            <span className="item-monogram">{getItemAbbreviation(item)}</span>
          </>
        )}
        {item.count > 1 ? <strong className="stack-count">{item.count}</strong> : null}
      </span>
      {tooltipPosition
        ? createPortal(
            <span id={tooltipId} className="minecraft-tooltip" role="tooltip" style={tooltipStyle}>
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
            </span>,
            document.body,
          )
        : null}
    </div>
  );
}
