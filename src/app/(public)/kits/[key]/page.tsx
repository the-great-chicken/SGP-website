import type { Metadata } from "next";
import { ArrowLeft, BarChart3, Keyboard, PackageOpen, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { getCurrentSession } from "@/auth/session";
import { ItemSlot } from "@/components/item-slot";
import { KitPlayerModel } from "@/components/kit-player-model";
import { loadKitStats } from "@/db/kit-stats";
import {
  compareKits,
  formatActivationKeybind,
  formatKitName,
  getKitAccent,
  getKitDisplayName,
} from "@/lib/kit-manifest";
import { resolveKitLoadout, type ResolvedKitSlot } from "@/lib/kit-loadout";
import { loadItemImageResolver } from "@/lib/item-renders";
import { getKitIconSrc, getKitPreview } from "@/lib/kit-preview";
import { getKitMetricColor, getKitMetricDomains, getKitMetrics } from "@/lib/kit-stats";
import { loadKitManifest } from "@/lib/kits";
import { defaultKitPlayerUuid, resolveMinecraftSkin } from "@/lib/minecraft-skin";

type KitPageProps = {
  params: Promise<{ key: string }>;
};

const armorSlots = [
  { slot: "armor.head", label: "Tête" },
  { slot: "armor.chest", label: "Torse" },
  { slot: "armor.legs", label: "Jambes" },
  { slot: "armor.feet", label: "Pieds" },
];

const offhandSlot = { slot: "weapon.offhand", label: "Main secondaire" };

const hotbarSlots = Array.from({ length: 9 }, (_, index) => ({
  slot: `hotbar.${index}`,
  label: String(index + 1),
}));

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: KitPageProps): Promise<Metadata> {
  const { key } = await params;
  const manifest = await loadKitManifest();
  const kit = manifest?.kits.find((candidate) => candidate.key === key);
  const name = kit ? getKitDisplayName(kit) : formatKitName(key);
  return {
    title: name,
    description: `Loadout, capacité et statistiques agrégées du kit ${name}.`,
  };
}

export default async function KitPage({ params }: KitPageProps) {
  const [{ key }, manifest, statsSnapshot, session] = await Promise.all([
    params,
    loadKitManifest(),
    loadKitStats(),
    getCurrentSession(),
  ]);

  if (!manifest) {
    notFound();
  }

  const kit = manifest.kits.find((candidate) => candidate.key === key);
  if (!kit) {
    notFound();
  }
  const [resolveItemImage, playerSkin] = await Promise.all([
    loadItemImageResolver(manifest),
    resolveMinecraftSkin(session?.player?.uuid ?? defaultKitPlayerUuid),
  ]);

  const allKits = manifest.kits.toSorted(compareKits);
  const metricDomains = getKitMetricDomains(allKits, statsSnapshot);
  const name = getKitDisplayName(kit);
  const metrics = getKitMetrics(kit.id, statsSnapshot.byKitKey[kit.key], statsSnapshot);
  const itemCount = kit.operations.reduce((sum, operation) => sum + operation.item.count, 0);
  const loadout = resolveKitLoadout(kit.operations);
  const offhandEntry = loadout.bySlot.get(offhandSlot.slot);
  const iconSrc = getKitIconSrc(kit);

  return (
    <div
      className="shell page-stack kit-detail"
      style={{ "--kit-accent": getKitAccent(kit) } as CSSProperties}
    >
      <div className="kit-detail-frame">
        <aside className="kit-detail-sidebar" aria-label="Tous les kits">
          <div className="kit-detail-sidebar-heading">
            <p className="eyebrow">Kits</p>
            <h2>Tous les kits</h2>
          </div>
          <nav className="kit-detail-kit-list">
            {allKits.map((candidate) => {
              const candidateName = getKitDisplayName(candidate);
              const candidateIconSrc = getKitIconSrc(candidate);
              const active = candidate.key === kit.key;
              const linkStyle = { "--kit-link-accent": getKitAccent(candidate) } as CSSProperties;
              const content = (
                <>
                  <span className="kit-detail-list-icon" aria-hidden="true">
                    {candidateIconSrc ? (
                      <Image src={candidateIconSrc} width={22} height={22} alt="" unoptimized />
                    ) : (
                      <span className="kit-detail-list-fallback">{candidateName.slice(0, 1)}</span>
                    )}
                  </span>
                  <span>{candidateName}</span>
                </>
              );

              if (active) {
                return (
                  <span
                    className="kit-detail-kit-link is-active"
                    aria-current="page"
                    style={linkStyle}
                    key={candidate.key}
                  >
                    {content}
                  </span>
                );
              }

              return (
                <Link
                  href={`/kits/${candidate.key}`}
                  className="kit-detail-kit-link"
                  style={linkStyle}
                  key={candidate.key}
                >
                  {content}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="kit-detail-main">
          <div className="kit-detail-breadcrumb">
            <Link href="/kits"><ArrowLeft size={14} /> Tous les kits</Link>
            <span aria-hidden="true">/</span>
            <span>{name}</span>
          </div>

          <section className="kit-detail-heading">
            <div className="kit-title-icon" aria-hidden="true">
              {iconSrc ? <Image src={iconSrc} width={48} height={48} alt="" unoptimized /> : <Sparkles size={23} />}
            </div>
            <div>
              <p className="eyebrow">Kit</p>
              <h1>{name}</h1>
            </div>
            <div className="manifest-badge accent-badge kit-detail-count">
              <PackageOpen size={16} />
              <span>
                <strong>{kit.operations.length} emplacements</strong>
                {itemCount} objets au total
              </span>
            </div>
          </section>

          <div className="kit-detail-layout">
            <section className="kit-model-panel" aria-labelledby="kit-model-heading">
              <div className="kit-model-panel-heading">
                <h2 id="kit-model-heading">Équipement porté</h2>
                <span>{name}</span>
              </div>
              <div className="kit-model-stage">
                <div className="kit-model-equipment inventory-slots" aria-label="Armure portée">
                  {armorSlots.map(({ slot, label }) => {
                    const entry = loadout.bySlot.get(slot);
                    return (
                      <ItemSlot
                        operation={entry?.operation}
                        slotLabel={label}
                        imageSrc={getResolvedItemImage(entry, resolveItemImage)}
                        showLabel={false}
                        key={slot}
                      />
                    );
                  })}
                </div>
                <div className="kit-model-surface">
                  <KitPlayerModel preview={getKitPreview(kit)} name={name} skin={playerSkin} />
                </div>
              </div>
              {offhandEntry ? (
                <div className="kit-model-offhand">
                  <span>Main secondaire</span>
                  <div className="kit-model-offhand-slot inventory-slots">
                    <ItemSlot
                      operation={offhandEntry.operation}
                      slotLabel={offhandSlot.label}
                      imageSrc={getResolvedItemImage(offhandEntry, resolveItemImage)}
                      showLabel={false}
                    />
                  </div>
                </div>
              ) : null}
            </section>

            <div className="kit-information">
              <section className="ability-detail">
                <p className="eyebrow">Capacité</p>
                <h2>{kit.ability?.name ?? "Aucune capacité active"}</h2>
                <p className="ability-description">
                  {kit.ability?.description ?? "Ce kit n’a pas de capacité active."}
                </p>
                {kit.ability ? (
                  <div className="ability-key">
                    <span><Keyboard size={15} /> Activation</span>
                    <strong>{formatActivationKeybind(kit.ability.activationKeybind)}</strong>
                  </div>
                ) : null}
              </section>

              <section className="loadout-panel refined-loadout-panel">
                <div className="loadout-panel-heading">
                  <h2>Équipement</h2>
                  <span className="small-label">Survoler un objet pour voir ses détails</span>
                </div>

                <div className="loadout-group hotbar-group">
                  <h3>Barre rapide</h3>
                  <div className="hotbar-slots inventory-slots">
                    {hotbarSlots.map(({ slot, label }) => {
                      const entry = loadout.bySlot.get(slot);
                      return (
                        <ItemSlot
                          operation={entry?.operation}
                          slotLabel={label}
                          imageSrc={getResolvedItemImage(entry, resolveItemImage)}
                          key={slot}
                        />
                      );
                    })}
                  </div>
                </div>

                {loadout.inventory.length ? (
                  <div className="loadout-group reserve-group">
                    <h3>Inventaire</h3>
                    <div className="reserve-slots inventory-slots">
                      {loadout.inventory.map((entry, index) => (
                        <ItemSlot
                          operation={entry.operation}
                          slotLabel="Inventaire"
                          imageSrc={getResolvedItemImage(entry, resolveItemImage)}
                          key={`${entry.slot}-${entry.operation.source.line}-${index}`}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                {loadout.overflow.length ? (
                  <div className="loadout-group reserve-group">
                    <h3>Surplus hors inventaire</h3>
                    <div className="reserve-slots inventory-slots">
                      {loadout.overflow.map((entry, index) => (
                        <ItemSlot
                          operation={entry.operation}
                          slotLabel="Objet donné au sol"
                          imageSrc={getResolvedItemImage(entry, resolveItemImage)}
                          key={`overflow-${entry.operation.source.line}-${index}`}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

              </section>

              <section className="kit-stats-panel refined-kit-stats">
                <div className="panel-heading compact-heading">
                  <div>
                    <p className="eyebrow">Historique</p>
                    <h2>Statistiques</h2>
                  </div>
                  <BarChart3 size={19} />
                </div>
                <div className="kit-metric-grid">
                  {metrics.map((metric) => {
                    const metricColor = getKitMetricColor(metric.rawValue, metricDomains[metric.key]);
                    const metricStyle = metricColor
                      ? ({ "--kit-metric-color": metricColor } as CSSProperties)
                      : undefined;
                    return (
                      <article
                        className={metricColor ? "kit-metric has-scale-color" : "kit-metric"}
                        style={metricStyle}
                        key={metric.label}
                      >
                        <span>{metric.key === "ratio" ? "K/D" : metric.label}</span>
                        <strong>{metric.value}</strong>
                        <small>{metric.detail}</small>
                      </article>
                    );
                  })}
                </div>
                <p className="stats-caption">
                  {statsSnapshot.editionCount
                    ? `Cumul de ${statsSnapshot.editionCount} édition${statsSnapshot.editionCount > 1 ? "s" : ""} publiée${statsSnapshot.editionCount > 1 ? "s" : ""} ou archivée${statsSnapshot.editionCount > 1 ? "s" : ""}.`
                    : "Les statistiques apparaîtront après la publication d’une première édition."}
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getResolvedItemImage(
  entry: ResolvedKitSlot | undefined,
  resolveItemImage: (item: ResolvedKitSlot["renderItem"]) => string | null,
) {
  return entry ? resolveItemImage(entry.renderItem) : null;
}
