"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { LeaderboardMetric } from "@/db/historical-stats-query";
import { formatLeaderboardValue, leaderboardMetricLabels } from "@/lib/historical-stats";
import { sortLeaderboard, type LeaderboardRow } from "@/lib/leaderboard-table";

export function LeaderboardTable({ rows, initialMetric, scope, editions, lifetime }: {
  rows: LeaderboardRow[];
  initialMetric: LeaderboardMetric;
  scope: string;
  editions: { number: number; label: string }[];
  lifetime: boolean;
}) {
  const router = useRouter();
  const [metric, setMetric] = useState(initialMetric);
  const [ascending, setAscending] = useState(false);
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase("fr");
  const entries = sortLeaderboard(rows, metric, ascending).filter((entry) => {
    if (!normalizedQuery) return true;
    return entry.minecraftName.toLocaleLowerCase("fr").includes(normalizedQuery)
      || entry.currentMinecraftName.toLocaleLowerCase("fr").includes(normalizedQuery);
  });
  const metrics = Object.keys(leaderboardMetricLabels) as LeaderboardMetric[];

  return (
    <section className="leaderboard-section" aria-label="Classement des joueurs">
      <div className="leaderboard-toolbar">
        <label>
          <span>Édition</span>
          <select value={scope} onChange={(event) => router.push(`/leaderboards?${new URLSearchParams({ edition: event.target.value, metric })}`)}>
            <option value="all">Toutes les éditions</option>
            {editions.map((edition) => <option key={edition.number} value={edition.number}>{edition.label}</option>)}
          </select>
        </label>
        <label className="leaderboard-player-search">
          <span>Joueur</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher un joueur…"
            autoComplete="off"
          />
        </label>
        <span className="leaderboard-count" role="status" aria-live="polite">
          {entries.length} joueur{entries.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="stats-table-scroll" tabIndex={0} role="region" aria-label="Tableau défilant des classements">
        <table className="stats-table">
          <thead>
            <tr>
              <th scope="col">Rang</th>
              <th scope="col">Joueur</th>
              {metrics.map((candidate) => (
                <th className="is-sortable" key={candidate} scope="col" aria-sort={metric === candidate ? ascending ? "ascending" : "descending" : "none"}>
                  <button type="button" onClick={() => {
                    setAscending(candidate === metric ? !ascending : false);
                    setMetric(candidate);
                  }}>
                    {candidate === "elo" && lifetime ? "Meilleur Elo" : leaderboardMetricLabels[candidate]}
                    {candidate !== metric ? <ArrowUpDown size={14} /> : ascending ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.length ? entries.map((entry) => (
              <tr key={entry.playerUuid}>
                <td className="table-rank">{entry.rank === null ? "—" : `#${entry.rank}`}</td>
                <th scope="row">
                  <Link className="table-player" href={`/players/${entry.playerUuid}`}>
                    <span className="player-monogram is-small" aria-hidden="true">{entry.minecraftName.slice(0, 2).toLocaleUpperCase("fr")}</span>
                    <span><strong>{entry.minecraftName}</strong>{entry.minecraftName !== entry.currentMinecraftName ? <small>{entry.currentMinecraftName}</small> : null}</span>
                  </Link>
                </th>
                {metrics.map((candidate) => <td className={candidate === metric ? "is-sorted" : undefined} key={candidate}>{entry.values[candidate] === null ? "—" : formatLeaderboardValue(candidate, entry.values[candidate])}</td>)}
              </tr>
            )) : (
              <tr>
                <td className="leaderboard-no-results" colSpan={metrics.length + 2}>
                  Aucun joueur ne correspond à cette recherche.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
