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
  const entries = sortLeaderboard(rows, metric, ascending);
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
        <span className="leaderboard-count">{rows.length} joueurs</span>
      </div>
      <div className="stats-table-scroll" tabIndex={0} role="region" aria-label="Tableau défilant des classements">
        <table className="stats-table">
          <thead>
            <tr>
              <th scope="col">Rang</th>
              <th scope="col">Joueur</th>
              {metrics.map((candidate) => (
                <th key={candidate} scope="col" aria-sort={metric === candidate ? ascending ? "ascending" : "descending" : "none"}>
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
            {entries.map((entry) => (
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
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
