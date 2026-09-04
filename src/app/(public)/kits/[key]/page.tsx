import type { Metadata } from "next";
import { ArrowLeft, Box, PackageOpen } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { PageIntro } from "@/components/page-intro";
import {
  formatKitName,
  getItemDisplayName,
  getKitAccent,
  getKitDisplayName,
  loadKitManifest,
} from "@/lib/kits";

type KitPageProps = {
  params: Promise<{ key: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: KitPageProps): Promise<Metadata> {
  const { key } = await params;
  const manifest = await loadKitManifest();
  const kit = manifest?.kits.find((candidate) => candidate.key === key);
  const name = kit ? getKitDisplayName(kit) : formatKitName(key);
  return {
    title: name,
    description: `Équipement et aperçu du kit ${name}.`,
  };
}

export default async function KitPage({ params }: KitPageProps) {
  const [{ key }, manifest] = await Promise.all([params, loadKitManifest()]);

  if (!manifest) {
    notFound();
  }

  const kit = manifest.kits.find((candidate) => candidate.key === key);

  if (!kit) {
    notFound();
  }

  return (
    <div className="shell page-stack kit-detail" style={{ "--kit-accent": getKitAccent(kit) } as CSSProperties}>
      <Link className="back-link" href="/kits">
        <ArrowLeft size={15} /> Tous les kits
      </Link>
      <PageIntro
        eyebrow="Fiche de kit"
        title={getKitDisplayName(kit)}
        description="Inventaire actuel extrait du datapack. Les caractéristiques calculées et l’aperçu Minecraft des objets viendront enrichir cette fiche."
        aside={
          <div className="manifest-badge accent-badge">
            <PackageOpen size={17} />
            <span>
              <strong>{kit.operations.length} emplacements</strong>
              {kit.operations.reduce((sum, operation) => sum + operation.item.count, 0)} objets au total
            </span>
          </div>
        }
      />
      <section className="loadout-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Équipement</p>
            <h2>Loadout complet</h2>
          </div>
          <span className="source-chip">Schéma manifeste v{manifest.schemaVersion}</span>
        </div>
        <div className="loadout-list">
          {kit.operations.map((operation, index) => (
            <article className="loadout-row" key={`${operation.kind}-${operation.slot ?? "give"}-${index}`}>
              <span className="item-cube" aria-hidden="true">
                <Box size={20} />
              </span>
              <div className="loadout-copy">
                <strong>{getItemDisplayName(operation.item)}</strong>
                <span>{operation.item.id}</span>
              </div>
              <span className="slot-chip">{operation.slot ?? "Ajout direct"}</span>
              <strong className="item-quantity">×{operation.item.count}</strong>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
