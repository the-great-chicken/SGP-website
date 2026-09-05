import "server-only";

import { cache } from "react";
import { db } from "./client";
import {
  queryLeaderboard,
  queryPlayerDirectory,
  queryPlayerProfile,
  type LeaderboardMetric,
} from "./historical-stats-query";

export async function loadLeaderboard(
  editionNumber: number | null | undefined,
  metric: LeaderboardMetric,
) {
  return queryLeaderboard(db, { editionNumber, metric });
}

export async function loadPlayerDirectory(search: string) {
  return queryPlayerDirectory(db, search);
}

export const loadPlayerProfile = cache(async (uuid: string) => queryPlayerProfile(db, uuid));
