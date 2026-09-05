import type { Metadata } from "next";
import { Boxes, PackageSearch } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { KitBrowser } from "@/components/kit-browser";
import { PageIntro } from "@/components/page-intro";
import { loadKitStats } from "@/db/kit-stats";
import { compareKits, toKitCardView } from "@/lib/kit-manifest";
import { loadItemImageResolver } from "@/lib/item-renders";
import { loadKitManifest } from "@/lib/kits";

export const metadata: Metadata = {
  title: "Kits",
  description: "Les kits et leurs équipements dans la version actuelle de la SGP.",
};

export const dynamic = "force-dynamic";

export default async function KitsPage() {
  const [manifest, stats, resolveItemImage] = await Promise.all([
    loadKitManifest(),
    loadKitStats(),
    loadItemImageResolver(),
  ]);
  const kits = (manifest?.kits ?? [])
    .toSorted(compareKits)
    .map((kit) => toKitCardView(kit, resolveItemImage));

  return (
    <div className="shell page-stack">
      <PageIntro
        eyebrow="Arsenal actuel"
        title="Choisir son style de jeu."
        description="Parcourez chaque loadout, lisez les objets comme en jeu et comparez les tendances relevées au fil des éditions. L’équipement et les capacités viennent directement du datapack."
        aside={
          <div className="manifest-badge">
            <Boxes size={17} />
            <span>
              <strong>{kits.length || "—"} kits</strong>
              {manifest
                ? `Minecraft ${manifest.minecraftVersion}${stats.editionCount ? ` · ${stats.editionCount} édition${stats.editionCount > 1 ? "s" : ""}` : ""}`
                : "Manifeste absent"}
            </span>
          </div>
        }
      />

      {kits.length ? (
        <KitBrowser kits={kits} stats={stats} />
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

