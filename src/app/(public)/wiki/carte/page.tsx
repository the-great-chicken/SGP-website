import type { Metadata } from "next";
import { Map as MapIcon } from "lucide-react";
import { MapTimeline } from "@/components/history/map-timeline";
import { PageIntro } from "@/components/page-intro";
import { publishedHistoryEditions } from "@/content/history/editions";
import { getMapArchiveManifest } from "@/map-archive/server";

export const metadata: Metadata = {
  title: "Évolution de la carte",
  description: "Comparez l’Arène de la SGP en 3D d’une édition à l’autre.",
};

export const dynamic = "force-dynamic";

export default async function MapHistoryPage() {
  const manifest = await getMapArchiveManifest();
  const editions = publishedHistoryEditions().map((edition) => ({
    number: edition.number,
    dateLabel: edition.dateLabel,
    shortTitle: edition.shortTitle,
    minecraftVersion: edition.minecraftVersion,
    snapshotKey: edition.map.snapshotKey,
    map: manifest.editions[edition.map.snapshotKey] ?? null,
  }));

  return (
    <div className="shell page-stack history-map-page">
      <PageIntro
        eyebrow="Archives de l’Arène"
        title="Évolution de la carte"
        description="La même Arène, édition après édition."
        aside={<span className="round-icon large"><MapIcon size={27} /></span>}
      />
      <MapTimeline editions={editions} />
    </div>
  );
}
