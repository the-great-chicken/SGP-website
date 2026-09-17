"use client";

import { Box } from "lucide-react";
import Image from "next/image";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
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

export function ItemSlot({ operation, slotLabel, compact = false, imageSrc, showLabel = true }: ItemSlotProps) {
  const tooltipId = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const tooltip = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const element = tooltip.current;
    if (!anchor || !element) return;
    const edge = 12;
    const viewport = window.visualViewport;
    const leftEdge = (viewport?.offsetLeft ?? 0) + edge;
    const topEdge = (viewport?.offsetTop ?? 0) + edge;
    const width = viewport?.width ?? document.documentElement.clientWidth;
    const height = viewport?.height ?? window.innerHeight;
    element.style.maxWidth = `${width - edge * 2}px`;
    element.style.maxHeight = `${height - edge * 2}px`;
    const rect = anchor.getBoundingClientRect();
    const bounds = element.getBoundingClientRect();
    const above = rect.top - bounds.height - 8;
    const top = above >= topEdge ? above : rect.bottom + 8;
    element.style.left = `${Math.max(leftEdge, Math.min(rect.left, leftEdge + width - edge * 2 - bounds.width))}px`;
    element.style.top = `${Math.max(topEdge, Math.min(top, topEdge + height - edge * 2 - bounds.height))}px`;
  }, [anchor]);

  useEffect(() => {
    if (!anchor) return;
    const dismiss = () => setAnchor(null);
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !anchor.contains(event.target) && !tooltip.current?.contains(event.target)) dismiss();
    };
    const scroll = (event: Event) => {
      if (!(event.target instanceof Node) || !tooltip.current?.contains(event.target)) dismiss();
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("scroll", scroll, true);
    document.addEventListener("keydown", keydown);
    window.addEventListener("resize", dismiss);
    window.visualViewport?.addEventListener("resize", dismiss);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("scroll", scroll, true);
      document.removeEventListener("keydown", keydown);
      window.removeEventListener("resize", dismiss);
      window.visualViewport?.removeEventListener("resize", dismiss);
    };
  }, [anchor]);

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

  return (
    <button
      className={`inventory-entry${compact ? " is-compact" : ""}`}
      type="button"
      aria-label={`${slotLabel} : ${name}, quantité ${item.count}`}
      aria-describedby={anchor ? tooltipId : undefined}
      aria-expanded={Boolean(anchor)}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setAnchor(event.currentTarget);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setAnchor(null);
      }}
      onFocus={(event) => {
        if (event.currentTarget.matches(":focus-visible")) setAnchor(event.currentTarget);
      }}
      onBlur={() => setAnchor(null)}
      onClick={(event) => setAnchor(anchor ? null : event.currentTarget)}
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
      {anchor
        ? createPortal(
            <span ref={tooltip} id={tooltipId} className="minecraft-tooltip" role="tooltip">
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
    </button>
  );
}
