import type { Metadata } from "next";
import { ArrowLeft, BarChart3, Keyboard, PackageOpen, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { ItemSlot } from "@/components/item-slot";
import { KitPlayerModel } from "@/components/kit-player-model";
import { loadKitStats } from "@/db/kit-stats";
import {
  compareKits,
  formatActivationKeybind,
  formatKitName,
  getKitAccent,
  getKitDisplayName,
  type KitOperation,
} from "@/lib/kit-manifest";
import { loadItemImageResolver } from "@/lib/item-renders";
import { getKitIconSrc, getKitPreview } from "@/lib/kit-preview";
import { getKitMetrics } from "@/lib/kit-stats";
import { loadKitManifest } from "@/lib/kits";

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

const positionedSlots = new Set(
  [...armorSlots, offhandSlot, ...hotbarSlots].map(({ slot }) => slot),
);

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
  const [{ key }, manifest, statsSnapshot] = await Promise.all([
    params,
    loadKitManifest(),
    loadKitStats(),
  ]);

  if (!manifest) {
    notFound();
  }
  const resolveItemImage = await loadItemImageResolver(manifest);

  const kit = manifest.kits.find((candidate) => candidate.key === key);
  if (!kit) {
    notFound();
  }

  const allKits = manifest.kits.toSorted(compareKits);
  const name = getKitDisplayName(kit);
  const metrics = getKitMetrics(kit.id, statsSnapshot.byKitKey[kit.key], statsSnapshot);
  const itemCount = kit.operations.reduce((sum, operation) => sum + operation.item.count, 0);
  const reserves = kit.operations.filter(
    (operation) => !operation.slot || !positionedSlots.has(operation.slot),
  );
  const offhandOperation = findOperation(kit.operations, offhandSlot.slot);
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
              return (
                <Link
                  href={`/kits/${candidate.key}`}
                  className={active ? "is-active" : undefined}
                  aria-current={active ? "page" : undefined}
                  style={{ "--kit-link-accent": getKitAccent(candidate) } as CSSProperties}
                  key={candidate.key}
                >
                  <span className="kit-detail-list-icon" aria-hidden="true">
                    {candidateIconSrc ? (
                      <Image src={candidateIconSrc} width={22} height={22} alt="" unoptimized />
                    ) : (
                      <span className="kit-detail-list-fallback">{candidateName.slice(0, 1)}</span>
                    )}
                  </span>
                  <span>{candidateName}</span>
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
                  {armorSlots.map(({ slot, label }) => (
                    <ItemSlot
                      operation={findOperation(kit.operations, slot)}
                      slotLabel={label}
                      imageSrc={getOperationImage(kit.operations, slot, resolveItemImage)}
                      key={slot}
                    />
                  ))}
                </div>
                <div className="kit-model-surface">
                  <KitPlayerModel preview={getKitPreview(kit)} name={name} />
                </div>
              </div>
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
                    {hotbarSlots.map(({ slot, label }) => (
                      <ItemSlot
                        operation={findOperation(kit.operations, slot)}
                        slotLabel={label}
                        imageSrc={getOperationImage(kit.operations, slot, resolveItemImage)}
                        key={slot}
                      />
                    ))}
                  </div>
                </div>

                {reserves.length ? (
                  <div className="loadout-group reserve-group">
                    <h3>Inventaire</h3>
                    <div className="reserve-slots inventory-slots">
                      {reserves.map((operation, index) => (
                        <ItemSlot
                          operation={operation}
                          slotLabel={operation.slot ? "Inventaire" : "Ajout direct"}
                          imageSrc={resolveItemImage(operation.item)}
                          key={`${operation.source.line}-${index}`}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                {offhandOperation ? (
                  <div className="loadout-group offhand-group">
                    <h3>Main secondaire</h3>
                    <div className="offhand-slots inventory-slots">
                      <ItemSlot
                        operation={offhandOperation}
                        slotLabel={offhandSlot.label}
                        imageSrc={resolveItemImage(offhandOperation.item)}
                      />
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
                  {metrics.map((metric) => (
                    <article className="kit-metric" key={metric.label}>
                      <span>{metric.label}</span>
                      <strong>{metric.value}</strong>
                      <small>{metric.detail}</small>
                    </article>
                  ))}
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

function findOperation(operations: KitOperation[], slot: string) {
  return operations.find((operation) => operation.slot === slot);
}

function getOperationImage(
  operations: KitOperation[],
  slot: string,
  resolveItemImage: (item: KitOperation["item"]) => string | null,
) {
  const operation = findOperation(operations, slot);
  return operation ? resolveItemImage(operation.item) : null;
}
