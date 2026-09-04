import { ArrowUpRight, PackageOpen, Sparkles } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import {
  formatKitName,
  getItemDisplayName,
  getKitAccent,
  type KitDefinition,
} from "@/lib/kits";

type KitCardProps = {
  kit: KitDefinition;
  compact?: boolean;
};

export function KitCard({ kit, compact = false }: KitCardProps) {
  const accent = getKitAccent(kit);
  const items = kit.operations.reduce((sum, operation) => sum + operation.item.count, 0);
  const featuredItems = kit.operations.slice(0, 3).map((operation) => getItemDisplayName(operation.item));
  const style = { "--kit-accent": accent } as CSSProperties;

  return (
    <article className={compact ? "kit-card is-compact" : "kit-card"} style={style}>
      <div className="kit-card-glow" aria-hidden="true" />
      <div className="kit-card-topline">
        <span className="kit-index">{kit.key.slice(0, 2).toUpperCase()}</span>
        <span className="kit-count">
          <PackageOpen size={14} />
          {kit.operations.length} emplacements
        </span>
      </div>
      <div className="kit-card-copy">
        <p className="kit-label">Kit</p>
        <h2>{formatKitName(kit.key)}</h2>
        <p>{featuredItems.join(" · ")}</p>
      </div>
      <div className="kit-card-footer">
        <span>
          <Sparkles size={14} /> {items} objets au total
        </span>
        <Link href={`/kits/${kit.key}`} aria-label={`Voir le kit ${formatKitName(kit.key)}`}>
          <ArrowUpRight size={18} />
        </Link>
      </div>
    </article>
  );
}

