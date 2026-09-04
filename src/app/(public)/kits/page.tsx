import type { Metadata } from "next";
import { Boxes, PackageSearch } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { KitCard } from "@/components/kit-card";
import { PageIntro } from "@/components/page-intro";
import { loadKitManifest } from "@/lib/kits";

export const metadata: Metadata = {
  title: "Kits",
  description: "Les kits et leurs équipements dans la version actuelle de la SGP.",
};

export const dynamic = "force-dynamic";

export default async function KitsPage() {
  const manifest = await loadKitManifest();
  const kits = manifest?.kits ?? [];

  return (
    <div className="shell page-stack">
      <PageIntro
        eyebrow="Arsenal actuel"
        title="Choisir son style de jeu."
        description="Chaque kit a son rythme, son équipement et sa manière de renverser une partie. Les données ci-dessous viennent directement du datapack."
        aside={
          <div className="manifest-badge">
            <Boxes size={17} />
            <span>
              <strong>{kits.length || "—"} kits</strong>
              {manifest ? `Minecraft ${manifest.minecraftVersion}` : "Manifeste absent"}
            </span>
          </div>
        }
      />

      {kits.length ? (
        <div className="kit-grid">
          {kits.map((kit) => (
            <KitCard kit={kit} key={kit.key} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={PackageSearch}
          title="Aucun manifeste de kits"
          description="Générez data/kit-manifest.json avec l’exporteur du dépôt pour afficher les kits sans recopier les données du datapack."
        />
      )}
    </div>
  );
}

