import { ArrowUpRight, PackageOpen } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import type { KitCardView } from "@/lib/kit-manifest";
import { getKitMetrics, type KitAggregateStats, type KitStatsSnapshot } from "@/lib/kit-stats";

type KitCardProps = {
  kit: KitCardView;
  stats?: KitAggregateStats;
  statsContext?: Pick<KitStatsSnapshot, "editionCount" | "totalPicks">;
  compact?: boolean;
};

export function KitCard({ kit, stats, statsContext, compact = false }: KitCardProps) {
  const style = { "--kit-accent": kit.accent } as CSSProperties;
  const metrics = statsContext ? getKitMetrics(kit.id, stats, statsContext) : [];

  return (
    <Link
      className={compact ? "kit-card-link is-compact" : "kit-card-link"}
      href={`/kits/${kit.key}`}
      aria-label={`Voir le kit ${kit.name}`}
      style={style}
    >
      <article className="kit-card">
        <div className="kit-card-art">
          {compact ? (
            <span className="kit-index">{kit.id === null ? "—" : String(kit.id).padStart(2, "0")}</span>
          ) : null}
          {kit.iconSrc ? (
            <Image className="kit-icon" src={kit.iconSrc} width={96} height={96} alt="" unoptimized />
          ) : (
            <span className="kit-card-fallback" aria-hidden="true">{kit.name.slice(0, 1)}</span>
          )}
          <span className="kit-card-arrow" aria-hidden="true"><ArrowUpRight size={18} /></span>
        </div>

        <div className="kit-card-copy">
          {compact ? <p className="kit-label">{kit.abilityName ?? "Kit spécial"}</p> : null}
          <h2>{kit.name}</h2>
          {compact ? (
            <p className="kit-card-open">Équipement et capacité <ArrowUpRight size={14} /></p>
          ) : (
            <p className="kit-label kit-ability-below">{kit.abilityName ?? "Kit spécial"}</p>
          )}
        </div>

        <div className="kit-card-meta">
          <span><PackageOpen size={13} /> {kit.operationCount} emplacements</span>
          <span>{kit.itemCount} objets</span>
        </div>

        <div className="kit-item-preview" aria-label="Aperçu du loadout">
          {kit.featuredItems.map((item) => (
            <span className="kit-preview-item" title={item.name} key={`${item.id}-${item.name}`}>
              {item.imageSrc ? (
                <Image
                  className="kit-preview-render"
                  src={item.imageSrc}
                  alt=""
                  width={128}
                  height={128}
                  sizes="38px"
                  draggable={false}
                  unoptimized
                />
              ) : (
                item.abbreviation
              )}
            </span>
          ))}
          {kit.operationCount > kit.featuredItems.length ? (
            <span className="kit-preview-more">+{kit.operationCount - kit.featuredItems.length}</span>
          ) : null}
        </div>

        {metrics.length ? (
          <div className="kit-card-stats">
            {metrics.map((metric) => (
              <span key={metric.label}>
                <strong>{metric.value}</strong>
                {metric.label}
              </span>
            ))}
          </div>
        ) : null}
      </article>
    </Link>
  );
}
