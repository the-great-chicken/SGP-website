import type { Metadata } from "next";
import { Trophy } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { PageIntro } from "@/components/page-intro";
import { leaderboardMetrics, type LeaderboardMetric } from "@/db/historical-stats-query";
import { loadLeaderboard } from "@/db/historical-stats";
import { formatEditionLabel } from "@/lib/historical-stats";
import { mergeLeaderboards } from "@/lib/leaderboard-table";

export const metadata: Metadata = {
  title: "Classements",
  description: "Les classements historiques de la Soirée du Grand Poulet.",
};
export const dynamic = "force-dynamic";

type LeaderboardsPageProps = {
  searchParams: Promise<{ edition?: string | string[]; metric?: string | string[] }>;
};

export default async function LeaderboardsPage({ searchParams }: LeaderboardsPageProps) {
  const parameters = await searchParams;
  const requestedMetric = singleValue(parameters.metric) as LeaderboardMetric;
  const metric = leaderboardMetrics.includes(requestedMetric) ? requestedMetric : "elo";
  const edition = singleValue(parameters.edition);
  const requestedEdition = edition === "all" ? null : edition && Number.isInteger(Number(edition)) && Number(edition) > 0 ? Number(edition) : undefined;
  const snapshots = await Promise.all(leaderboardMetrics.map((candidate) => loadLeaderboard(requestedEdition, candidate)));
  const snapshot = snapshots[0];
  const scope = snapshot.lifetime ? "all" : snapshot.selectedEdition?.number.toString() ?? "";

  return (
    <div className="shell page-stack leaderboard-page">
      <PageIntro eyebrow="Résultats par édition" title="Classements" description="Comparez les joueurs sur une édition ou sur l’ensemble de leur parcours. Cliquez sur une colonne pour trier le classement." />
      {snapshot.editions.length === 0 ? (
        <EmptyState icon={Trophy} title="Aucune édition publique" description="Les premiers classements apparaîtront ici après la publication d’une édition." />
      ) : (
        <LeaderboardTable key={`${scope}-${metric}`} rows={mergeLeaderboards(snapshots)} initialMetric={metric} scope={scope} lifetime={snapshot.lifetime} editions={snapshot.editions.map((edition) => ({ number: edition.number, label: formatEditionLabel(edition) }))} />
      )}
    </div>
  );
}

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
