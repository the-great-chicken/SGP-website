import { ArrowUpRight, PackageOpen, Sparkles } from "lucide-react";
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
        <div className="kit-card-glow" aria-hidden="true" />
        <div className="kit-card-topline">
          <span className="kit-index">{kit.id === null ? "—" : String(kit.id).padStart(2, "0")}</span>
          <span className="kit-count">
            <PackageOpen size={14} />
            {kit.operationCount} emplacements
          </span>
        </div>
        <div className="kit-card-copy">
          <p className="kit-label">{kit.abilityName ? "Kit à capacité" : "Kit spécial"}</p>
          <h2>{kit.name}</h2>
          <p className="kit-ability-name">
            <Sparkles size={14} /> {kit.abilityName ?? "Sans capacité active"}
          </p>
        </div>
        <div className="kit-item-preview" aria-label="Aperçu du loadout">
          {kit.featuredItems.map((item) => (
            <span className="kit-preview-item" title={`${item.name} — ${item.id}`} key={`${item.id}-${item.name}`}>
              {item.abbreviation}
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
        <div className="kit-card-footer">
          <span>{kit.itemCount} objets au total</span>
          <span className="kit-card-arrow" aria-hidden="true">
            <ArrowUpRight size={18} />
          </span>
        </div>
      </article>
    </Link>
  );
}
