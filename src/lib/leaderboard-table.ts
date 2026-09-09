import type { LeaderboardMetric, LeaderboardSnapshot } from "../db/historical-stats-query";

export type LeaderboardRow = {
  playerUuid: string;
  minecraftName: string;
  currentMinecraftName: string;
  values: Record<LeaderboardMetric, number | null>;
};

export function mergeLeaderboards(snapshots: LeaderboardSnapshot[]): LeaderboardRow[] {
  const rows = new Map<string, LeaderboardRow>();
  for (const snapshot of snapshots) {
    for (const entry of snapshot.entries) {
      const row = rows.get(entry.playerUuid) ?? {
        playerUuid: entry.playerUuid,
        minecraftName: entry.minecraftName,
        currentMinecraftName: entry.currentMinecraftName,
        values: { elo: null, kills: null, damage: null, playtime: null },
      };
      row.values[snapshot.metric] = entry.value;
      rows.set(entry.playerUuid, row);
    }
  }
  return [...rows.values()];
}

export function sortLeaderboard(rows: LeaderboardRow[], metric: LeaderboardMetric, ascending: boolean) {
  const ranked = rows.toSorted((a, b) => {
    const left = a.values[metric];
    const right = b.values[metric];
    if (left === null || right === null) return left === right ? a.minecraftName.localeCompare(b.minecraftName, "fr") : left === null ? 1 : -1;
    return right - left || a.minecraftName.localeCompare(b.minecraftName, "fr");
  });
  let previous: number | null = null;
  let rank: number | null = null;
  const result = ranked.map((row, index) => {
    const value = row.values[metric];
    if (value !== previous) rank = value === null ? null : index + 1;
    previous = value;
    return { ...row, rank };
  });
  return ascending ? result.toSorted((a, b) => {
    const left = a.values[metric];
    const right = b.values[metric];
    if (left === null || right === null) return left === right ? 0 : left === null ? 1 : -1;
    return left - right || a.minecraftName.localeCompare(b.minecraftName, "fr");
  }) : result;
}

export function sortLeaderboardByPlayerName(
  rows: LeaderboardRow[],
  metric: LeaderboardMetric,
  ascending: boolean,
) {
  const ranked = sortLeaderboard(rows, metric, false);
  return ranked.toSorted((a, b) => {
    const comparison = a.minecraftName.localeCompare(b.minecraftName, "fr", { sensitivity: "base" });
    if (comparison) return ascending ? comparison : -comparison;
    return a.playerUuid.localeCompare(b.playerUuid);
  });
}
