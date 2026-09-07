import type { Metadata } from "next";
import { ArrowLeft, BarChart3, Keyboard, PackageOpen, Sparkles } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { ItemSlot } from "@/components/item-slot";
import { KitPlayerModel } from "@/components/kit-player-model";
import { getKitIconSrc, getKitPreview } from "@/lib/kit-preview";
import { PageIntro } from "@/components/page-intro";
import { loadKitStats } from "@/db/kit-stats";
import {
  formatActivationKeybind,
  formatKitName,
  getKitAccent,
  getKitDisplayName,
  type KitOperation,
} from "@/lib/kit-manifest";
import { getKitMetrics } from "@/lib/kit-stats";
import { loadItemImageResolver } from "@/lib/item-renders";
import { loadKitManifest } from "@/lib/kits";

type KitPageProps = {
  params: Promise<{ key: string }>;
};

const equipmentSlots = [
  { slot: "armor.head", label: "Tête" },
  { slot: "armor.chest", label: "Torse" },
  { slot: "armor.legs", label: "Jambes" },
  { slot: "armor.feet", label: "Pieds" },
  { slot: "weapon.offhand", label: "Main secondaire" },
];

const hotbarSlots = Array.from({ length: 9 }, (_, index) => ({
  slot: `hotbar.${index}`,
  label: String(index + 1),
}));

const positionedSlots = new Set([...equipmentSlots, ...hotbarSlots].map(({ slot }) => slot));

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

  const metrics = getKitMetrics(kit.id, statsSnapshot.byKitKey[kit.key], statsSnapshot);
  const itemCount = kit.operations.reduce((sum, operation) => sum + operation.item.count, 0);
  const reserves = kit.operations.filter(
    (operation) => !operation.slot || !positionedSlots.has(operation.slot),
  );

  return (
    <div
      className="shell page-stack kit-detail"
      style={{ "--kit-accent": getKitAccent(kit) } as CSSProperties}
    >
      <Link className="back-link" href="/kits">
        <ArrowLeft size={15} /> Tous les kits
      </Link>
      <PageIntro
        eyebrow={kit.id === null ? "Kit spécial" : `Kit ${String(kit.id).padStart(2, "0")}`}
        title={getKitDisplayName(kit)}
        description={
          kit.ability
            ? `${kit.ability.name}, son équipement complet et ses tendances sur les éditions publiées.`
            : "Un équipement spécial hors des classements des kits de combat."
        }
        aside={
          <div className="manifest-badge accent-badge">
            <PackageOpen size={17} />
            <span>
              <strong>{kit.operations.length} emplacements</strong>
              {itemCount} objets au total
            </span>
          </div>
        }
      />

      <div className="kit-overview-grid">
        <section className="ability-panel">
          <div className="ability-mark" aria-hidden="true">
            {getKitIconSrc(kit) ? <Image className="kit-icon" src={getKitIconSrc(kit)!} width={48} height={48} alt="" unoptimized /> : <Sparkles size={24} />}
          </div>
          <div className="ability-copy">
            <p className="eyebrow">Capacité</p>
            <h2>{kit.ability?.name ?? "Aucune capacité active"}</h2>
            <p>
              {kit.ability?.description ??
                "Ce kit n’a pas de capacité active."}
            </p>
          </div>
          {kit.ability ? (
            <div className="ability-trigger">
              <Keyboard size={17} />
              <span>
                <small>Activation</small>
                <strong>{formatActivationKeybind(kit.ability.activationKeybind)}</strong>
              </span>
            </div>
          ) : null}
        </section>

        <section className="kit-stats-panel">
          <div className="panel-heading compact-heading">
            <div>
              <p className="eyebrow">Historique</p>
              <h2>Repères de jeu</h2>
            </div>
            <BarChart3 size={20} />
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

      <section className="loadout-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Équipement</p>
            <h2>Loadout complet</h2>
          </div>
        </div>

        <div className="loadout-workbench">
          <div className="loadout-group equipment-group">
            <div className="loadout-group-heading">
              <h3>Équipement porté</h3>
              <span>Armure et main secondaire</span>
            </div>
            <KitPlayerModel preview={getKitPreview(kit, resolveItemImage)} name={getKitDisplayName(kit)} />
            <div className="equipment-slots inventory-slots">
              {equipmentSlots.map(({ slot, label }) => (
                <ItemSlot
                  operation={findOperation(kit.operations, slot)}
                  slotLabel={label}
                  imageSrc={getOperationImage(kit.operations, slot, resolveItemImage)}
                  key={slot}
                />
              ))}
            </div>
          </div>

          <div className="loadout-group hotbar-group">
            <div className="loadout-group-heading">
              <h3>Barre rapide</h3>
              <span>Emplacements 1 à 9</span>
            </div>
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
              <div className="loadout-group-heading">
                <h3>Réserve</h3>
                <span>Objets ajoutés directement à l’inventaire</span>
              </div>
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
        </div>

        <p className="loadout-help">Survolez un objet ou sélectionnez-le au clavier pour afficher son infobulle Minecraft.</p>
      </section>
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
