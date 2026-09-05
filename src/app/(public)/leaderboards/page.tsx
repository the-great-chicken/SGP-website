import type { Metadata } from "next";
import {
  BarChart3,
  CalendarDays,
  ChevronRight,
  Clock3,
  Medal,
  Trophy,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageIntro } from "@/components/page-intro";
import {
  leaderboardMetrics,
  type LeaderboardMetric,
} from "@/db/historical-stats-query";
import { loadLeaderboard } from "@/db/historical-stats";
import {
  formatCount,
  formatEditionDate,
  formatEditionLabel,
  formatLeaderboardValue,
  leaderboardMetricLabels,
} from "@/lib/historical-stats";

export const metadata: Metadata = {
  title: "Classements",
  description: "Les classements historiques de la Soirée du Grand Poulet.",
};

export const dynamic = "force-dynamic";

type LeaderboardsPageProps = {
  searchParams: Promise<{
    edition?: string | string[];
    metric?: string | string[];
  }>;
};

export default async function LeaderboardsPage({ searchParams }: LeaderboardsPageProps) {
  const parameters = await searchParams;
  const metric = parseMetric(singleValue(parameters.metric));
  const requestedEdition = parseEdition(singleValue(parameters.edition));
  const snapshot = await loadLeaderboard(requestedEdition, metric);
  const scopeValue = snapshot.lifetime
    ? "all"
    : snapshot.selectedEdition?.number.toString() ?? "";
  const scopeLabel = snapshot.lifetime
    ? "Toutes les éditions"
    : snapshot.selectedEdition
      ? formatEditionLabel(snapshot.selectedEdition)
      : "Aucune édition";

  return (
    <div className="shell page-stack">
      <PageIntro
        eyebrow="Archives compétitives"
        title="Chaque classement garde son contexte."
        description="Consultez une édition précise ou prenez du recul avec les cumuls historiques. Les pseudos d’époque restent attachés à leurs performances."
        aside={
          <nav className="metric-tabs" aria-label="Choisir une statistique">
            {leaderboardMetrics.map((candidate) => (
              <Link
                className={candidate === metric ? "is-selected" : undefined}
                href={leaderboardHref(scopeValue, candidate)}
                key={candidate}
              >
                {shortMetricLabel(candidate)}
              </Link>
            ))}
          </nav>
        }
      />

      {snapshot.editions.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="Aucune édition publique"
          description="Les premiers classements apparaîtront ici dès qu’une édition importée sera publiée ou archivée."
        />
      ) : (
        <>
          <form className="leaderboard-toolbar" method="get">
            <label>
              <span>Portée</span>
              <select defaultValue={scopeValue} name="edition">
                <option value="all">Toutes les éditions</option>
                {snapshot.editions.map((edition) => (
                  <option key={edition.id} value={edition.number}>
                    {formatEditionLabel(edition)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Statistique</span>
              <select defaultValue={metric} name="metric">
                {leaderboardMetrics.map((candidate) => (
                  <option key={candidate} value={candidate}>
                    {leaderboardMetricLabels[candidate]}
                  </option>
                ))}
              </select>
            </label>
            <button className="button primary compact-button" type="submit">
              Afficher
            </button>
          </form>

          <div className="summary-strip leaderboard-summary">
            <div>
              <CalendarDays size={18} />
              <span>
                <strong>{scopeLabel}</strong>
                {snapshot.selectedEdition
                  ? formatEditionDate(snapshot.selectedEdition.startsAt) ?? "Date non renseignée"
                  : `${snapshot.editions.length} édition${snapshot.editions.length > 1 ? "s" : ""}`}
              </span>
            </div>
            <div>
              <UsersRound size={18} />
              <span>
                <strong>{formatCount(snapshot.participantCount)} joueurs</strong>
                Participants dans cette portée
              </span>
            </div>
            <div>
              {metric === "playtime" ? <Clock3 size={18} /> : <BarChart3 size={18} />}
              <span>
                <strong>{leaderboardMetricLabels[metric]}</strong>
                {snapshot.lifetime && metric === "elo" ? "Meilleur score enregistré" : "Valeur décroissante"}
              </span>
            </div>
          </div>

          {snapshot.entries.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="Aucune valeur pour cette statistique"
              description="L’édition existe, mais le collecteur n’a fourni aucune donnée classable dans cette catégorie."
            />
          ) : (
            <section className="leaderboard-section" aria-labelledby="leaderboard-title">
              <div className="section-heading split-heading compact-heading">
                <div>
                  <p className="eyebrow">{scopeLabel}</p>
                  <h2 id="leaderboard-title">{leaderboardMetricLabels[metric]}</h2>
                </div>
                <span className="leaderboard-count">{snapshot.entries.length} résultats</span>
              </div>

              <div className="podium-grid">
                {snapshot.entries.slice(0, 3).map((entry, index) => (
                  <Link
                    className={`podium-card podium-${index + 1}`}
                    href={`/players/${entry.playerUuid}`}
                    key={entry.playerUuid}
                  >
                    <span className="podium-rank"><Medal size={17} /> #{entry.rank}</span>
                    <PlayerMonogram name={entry.minecraftName} />
                    <div>
                      <strong>{entry.minecraftName}</strong>
                      <span>{entry.detail}</span>
                    </div>
                    <b>{formatLeaderboardValue(metric, entry.value)}</b>
                  </Link>
                ))}
              </div>

              <div className="leaderboard-table" role="table" aria-label={`${leaderboardMetricLabels[metric]} — ${scopeLabel}`}>
                <div className="leaderboard-row leaderboard-head" role="row">
                  <span role="columnheader">Rang</span>
                  <span role="columnheader">Joueur</span>
                  <span role="columnheader">Contexte</span>
                  <span role="columnheader">Valeur</span>
                </div>
                {snapshot.entries.map((entry) => (
                  <Link
                    className="leaderboard-row"
                    href={`/players/${entry.playerUuid}`}
                    key={entry.playerUuid}
                    role="row"
                  >
                    <span className="table-rank" role="cell">#{entry.rank}</span>
                    <span className="table-player" role="cell">
                      <PlayerMonogram name={entry.minecraftName} small />
                      <span>
                        <strong>{entry.minecraftName}</strong>
                        {entry.minecraftName !== entry.currentMinecraftName ? (
                          <small>{entry.currentMinecraftName}</small>
                        ) : null}
                      </span>
                    </span>
                    <span className="table-detail" role="cell">{entry.detail}</span>
                    <strong className="table-value" role="cell">
                      {formatLeaderboardValue(metric, entry.value)}
                      <ChevronRight size={16} />
                    </strong>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function PlayerMonogram({ name, small = false }: { name: string; small?: boolean }) {
  return (
    <span className={`player-monogram${small ? " is-small" : ""}`} aria-hidden="true">
      {name.slice(0, 2).toLocaleUpperCase("fr-FR")}
    </span>
  );
}

function parseMetric(value: string | undefined): LeaderboardMetric {
  return leaderboardMetrics.includes(value as LeaderboardMetric)
    ? (value as LeaderboardMetric)
    : "elo";
}

function parseEdition(value: string | undefined): number | null | undefined {
  if (value === "all") return null;
  if (!value) return undefined;
  const edition = Number(value);
  return Number.isInteger(edition) && edition > 0 ? edition : undefined;
}

function leaderboardHref(edition: string, metric: LeaderboardMetric) {
  const query = new URLSearchParams({ edition, metric });
  return `/leaderboards?${query}`;
}

function shortMetricLabel(metric: LeaderboardMetric) {
  if (metric === "kills") return "Kills";
  if (metric === "damage") return "Dégâts";
  if (metric === "playtime") return "Temps";
  return "Elo";
}

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
