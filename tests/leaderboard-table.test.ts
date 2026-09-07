import assert from "node:assert/strict";
import test from "node:test";
import { mergeLeaderboards, sortLeaderboard, type LeaderboardRow } from "../src/lib/leaderboard-table";
import type { LeaderboardSnapshot } from "../src/db/historical-stats-query";

const rows: LeaderboardRow[] = [
  { playerUuid: "a", minecraftName: "Alice", currentMinecraftName: "Alice", values: { elo: 1200, kills: 2, damage: 90, playtime: 1200 } },
  { playerUuid: "b", minecraftName: "Bob", currentMinecraftName: "Bob", values: { elo: null, kills: 12, damage: 5, playtime: 2400 } },
  { playerUuid: "c", minecraftName: "Charlie", currentMinecraftName: "Charlie", values: { elo: 1200, kills: 4, damage: 400, playtime: 500 } },
  { playerUuid: "d", minecraftName: "Dan", currentMinecraftName: "Dan", values: { elo: 900, kills: 0, damage: 0, playtime: 0 } },
];

test("leaderboard sorting compares numeric values and keeps missing ratings last in either direction", () => {
  assert.deepEqual(sortLeaderboard(rows, "kills", false).map((row) => row.minecraftName), ["Bob", "Charlie", "Alice", "Dan"]);
  assert.deepEqual(sortLeaderboard(rows, "damage", false).map((row) => row.minecraftName), ["Charlie", "Alice", "Bob", "Dan"]);
  assert.deepEqual(sortLeaderboard(rows, "elo", true).map((row) => row.minecraftName), ["Dan", "Alice", "Charlie", "Bob"]);
  assert.deepEqual(sortLeaderboard(rows, "elo", false).map((row) => row.rank), [1, 1, 3, null]);
  assert.deepEqual(sortLeaderboard(rows, "elo", true).map((row) => row.rank), [3, 1, 1, null]);
});

test("merging metrics retains unrated players and distinguishes missing ratings from zero scores", () => {
  const base = { editions: [], selectedEdition: null, lifetime: true, participantCount: 2 };
  const entry = { rank: 1, playerUuid: "a", minecraftName: "OldName", currentMinecraftName: "NewName", value: 1100, detail: "" };
  const snapshots: LeaderboardSnapshot[] = [
    { ...base, metric: "elo", entries: [entry] },
    { ...base, metric: "kills", entries: [{ ...entry, value: 0 }, { ...entry, playerUuid: "b", value: 8 }] },
  ];
  const merged = mergeLeaderboards(snapshots);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].values.kills, 0);
  assert.equal(merged[0].minecraftName, "OldName");
  assert.equal(merged[1].values.elo, null);
  assert.equal(merged[1].values.kills, 8);
});
