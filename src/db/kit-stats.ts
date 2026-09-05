import "server-only";

import { db } from "./client";
import { queryKitStats } from "./kit-stats-query";
import type { KitStatsSnapshot } from "@/lib/kit-stats";

export async function loadKitStats(): Promise<KitStatsSnapshot> {
  return queryKitStats(db);
}
