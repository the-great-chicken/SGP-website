import { and, asc, desc, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import {
  editionAbilityMetricDefinitions,
  editionAbilityMetrics,
  editionDamageReceived,
  editionKills,
  editionPicks,
  editionPlayers,
  editions,
  kitSnapshots,
  playerRatings,
  players,
} from "./schema";

type SgpDatabase = typeof import("./client").db;

export const leaderboardMetrics = ["elo", "kills", "damage", "playtime"] as const;
export type LeaderboardMetric = (typeof leaderboardMetrics)[number];

export type PublicEdition = {
  id: number;
  number: number;
  name: string | null;
  startsAt: Date | null;
};

export type LeaderboardEntry = {
  rank: number;
  playerUuid: string;
  minecraftName: string;
  currentMinecraftName: string;
  value: number;
  detail: string;
};

export type LeaderboardSnapshot = {
  editions: PublicEdition[];
  selectedEdition: PublicEdition | null;
  lifetime: boolean;
  metric: LeaderboardMetric;
  participantCount: number;
  entries: LeaderboardEntry[];
};

export type PlayerDirectoryEntry = {
  uuid: string;
  minecraftName: string;
  aliases: string[];
  appearances: number;
  latestEditionNumber: number;
  kills: number;
  bestRating: number | null;
  favoriteKitKey: string | null;
};

export type PlayerDirectorySnapshot = {
  totalPlayers: number;
  query: string;
  players: PlayerDirectoryEntry[];
};

export type PlayerAbilityMetric = {
  kitKey: string | null;
  name: string;
  description: string;
  value: number;
  displayUnit: string;
};

export type PlayerEditionStats = {
  id: number;
  number: number;
  name: string | null;
  startsAt: Date | null;
  minecraftNameAtEvent: string;
  rating: number | null;
  rank: number | null;
  ratedEncounters: number;
  kills: number;
  deaths: number;
  damageDealt: number;
  damageReceived: number;
  picks: number;
  totalTimeTicks: number;
  favoriteKitKey: string | null;
  abilityMetrics: PlayerAbilityMetric[];
};

export type PlayerProfile = {
  uuid: string;
  currentMinecraftName: string;
  aliases: string[];
  firstEditionNumber: number;
  latestEditionNumber: number;
  lifetime: {
    appearances: number;
    kills: number;
    deaths: number;
    damageDealt: number;
    damageReceived: number;
    picks: number;
    totalTimeTicks: number;
    bestRating: number | null;
    latestRating: number | null;
    favoriteKitKey: string | null;
  };
  editions: PlayerEditionStats[];
};

type Participant = {
  playerUuid: string;
  currentMinecraftName: string;
  minecraftNameAtEvent: string;
  editionId: number;
  editionNumber: number;
};

type WorkingLeaderboardEntry = {
  playerUuid: string;
  minecraftName: string;
  currentMinecraftName: string;
  appearances: Set<number>;
  value: number | undefined;
  auxiliaryValue: number;
  peakEditionNumber: number | null;
};

type WorkingDirectoryEntry = {
  uuid: string;
  minecraftName: string;
  aliases: Set<string>;
  appearances: Set<number>;
  latestEditionNumber: number;
  kills: number;
  bestRating: number | null;
  kitTime: Map<string, number>;
};

type WorkingPlayerEdition = PlayerEditionStats & {
  kitTime: Map<string, number>;
};

export async function queryLeaderboard(
  database: SgpDatabase,
  options: { editionNumber?: number | null; metric: LeaderboardMetric },
): Promise<LeaderboardSnapshot> {
  const publicEditions = await queryPublicEditions(database);
  const selectedEdition =
    options.editionNumber === null
      ? null
      : publicEditions.find((edition) => edition.number === options.editionNumber) ??
        publicEditions[0] ??
        null;
  const lifetime = options.editionNumber === null;

  if (publicEditions.length === 0) {
    return {
      editions: [],
      selectedEdition: null,
      lifetime,
      metric: options.metric,
      participantCount: 0,
      entries: [],
    };
  }

  const scope = selectedEdition && !lifetime ? selectedEdition.id : undefined;
  const participants = await queryParticipants(database, scope);
  const entries = new Map<string, WorkingLeaderboardEntry>();

  for (const participant of participants) {
    const entry = entries.get(participant.playerUuid) ?? {
      playerUuid: participant.playerUuid,
      minecraftName: lifetime
        ? participant.currentMinecraftName
        : participant.minecraftNameAtEvent,
      currentMinecraftName: participant.currentMinecraftName,
      appearances: new Set<number>(),
      value: options.metric === "elo" ? undefined : 0,
      auxiliaryValue: 0,
      peakEditionNumber: null,
    };
    entry.appearances.add(participant.editionId);
    entries.set(participant.playerUuid, entry);
  }

  const editionNumbers = new Map(publicEditions.map((edition) => [edition.id, edition.number]));
  const condition = publicScope(scope);

  if (options.metric === "elo") {
    const rows = await database
      .select({
        editionId: playerRatings.editionId,
        playerUuid: playerRatings.playerUuid,
        rating: playerRatings.rating,
        ratedEncounters: playerRatings.ratedEncounters,
      })
      .from(playerRatings)
      .innerJoin(editions, eq(playerRatings.editionId, editions.id))
      .where(condition);

    for (const row of rows) {
      const entry = entries.get(row.playerUuid);
      if (!entry || (entry.value !== undefined && entry.value >= row.rating)) {
        continue;
      }
      entry.value = row.rating;
      entry.auxiliaryValue = row.ratedEncounters;
      entry.peakEditionNumber = editionNumbers.get(row.editionId) ?? null;
    }
  } else if (options.metric === "kills") {
    const rows = await database
      .select({ playerUuid: editionKills.killerUuid, value: editionKills.count })
      .from(editionKills)
      .innerJoin(editions, eq(editionKills.editionId, editions.id))
      .where(and(condition, isNotNull(editionKills.killerUuid)));

    for (const row of rows) {
      if (row.playerUuid !== null) {
        const entry = entries.get(row.playerUuid);
        if (entry) entry.value = (entry.value ?? 0) + row.value;
      }
    }
  } else if (options.metric === "damage") {
    const rows = await database
      .select({ playerUuid: editionDamageReceived.sourceUuid, value: editionDamageReceived.amount })
      .from(editionDamageReceived)
      .innerJoin(editions, eq(editionDamageReceived.editionId, editions.id))
      .where(
        and(
          condition,
          isNotNull(editionDamageReceived.sourceUuid),
          ne(editionDamageReceived.sourceUuid, editionDamageReceived.targetUuid),
        ),
      );

    for (const row of rows) {
      if (row.playerUuid !== null) {
        const entry = entries.get(row.playerUuid);
        if (entry) entry.value = (entry.value ?? 0) + row.value;
      }
    }
  } else {
    const rows = await database
      .select({
        playerUuid: editionPicks.playerUuid,
        totalTimeTicks: editionPicks.totalTimeTicks,
        picks: editionPicks.count,
      })
      .from(editionPicks)
      .innerJoin(editions, eq(editionPicks.editionId, editions.id))
      .where(condition);

    for (const row of rows) {
      const entry = entries.get(row.playerUuid);
      if (entry) {
        entry.value = (entry.value ?? 0) + row.totalTimeTicks;
        entry.auxiliaryValue += row.picks;
      }
    }
  }

  const ranked = [...entries.values()]
    .filter((entry) => entry.value !== undefined)
    .sort(
      (left, right) =>
        (right.value ?? 0) - (left.value ?? 0) ||
        left.minecraftName.localeCompare(right.minecraftName, "fr-FR"),
    );
  let previousValue: number | undefined;
  let previousRank = 0;

  const leaderboardEntries = ranked.map((entry, index): LeaderboardEntry => {
    const rank = entry.value === previousValue ? previousRank : index + 1;
    previousValue = entry.value;
    previousRank = rank;
    return {
      rank,
      playerUuid: entry.playerUuid,
      minecraftName: entry.minecraftName,
      currentMinecraftName: entry.currentMinecraftName,
      value: entry.value ?? 0,
      detail: getLeaderboardDetail(entry, options.metric, lifetime),
    };
  });

  return {
    editions: publicEditions,
    selectedEdition: lifetime ? null : selectedEdition,
    lifetime,
    metric: options.metric,
    participantCount: entries.size,
    entries: leaderboardEntries,
  };
}

export async function queryPlayerDirectory(
  database: SgpDatabase,
  search = "",
): Promise<PlayerDirectorySnapshot> {
  const [participants, killRows, ratingRows, kitRows] = await Promise.all([
    queryParticipants(database),
    database
      .select({ playerUuid: editionKills.killerUuid, value: editionKills.count })
      .from(editionKills)
      .innerJoin(editions, eq(editionKills.editionId, editions.id))
      .where(and(ne(editions.status, "draft"), isNotNull(editionKills.killerUuid))),
    database
      .select({ playerUuid: playerRatings.playerUuid, rating: playerRatings.rating })
      .from(playerRatings)
      .innerJoin(editions, eq(playerRatings.editionId, editions.id))
      .where(ne(editions.status, "draft")),
    database
      .select({
        playerUuid: editionPicks.playerUuid,
        kitKey: kitSnapshots.kitKey,
        totalTimeTicks: editionPicks.totalTimeTicks,
      })
      .from(editionPicks)
      .innerJoin(editions, eq(editionPicks.editionId, editions.id))
      .innerJoin(
        kitSnapshots,
        and(
          eq(editionPicks.editionId, kitSnapshots.editionId),
          eq(editionPicks.kitId, kitSnapshots.kitId),
        ),
      )
      .where(ne(editions.status, "draft")),
  ]);
  const entries = new Map<string, WorkingDirectoryEntry>();

  for (const participant of participants) {
    const entry = entries.get(participant.playerUuid) ?? {
      uuid: participant.playerUuid,
      minecraftName: participant.currentMinecraftName,
      aliases: new Set<string>(),
      appearances: new Set<number>(),
      latestEditionNumber: participant.editionNumber,
      kills: 0,
      bestRating: null,
      kitTime: new Map<string, number>(),
    };
    entry.appearances.add(participant.editionId);
    entry.latestEditionNumber = Math.max(entry.latestEditionNumber, participant.editionNumber);
    if (participant.minecraftNameAtEvent !== participant.currentMinecraftName) {
      entry.aliases.add(participant.minecraftNameAtEvent);
    }
    entries.set(participant.playerUuid, entry);
  }

  for (const row of killRows) {
    if (row.playerUuid !== null) {
      const entry = entries.get(row.playerUuid);
      if (entry) entry.kills += row.value;
    }
  }
  for (const row of ratingRows) {
    const entry = entries.get(row.playerUuid);
    if (entry && (entry.bestRating === null || row.rating > entry.bestRating)) {
      entry.bestRating = row.rating;
    }
  }
  for (const row of kitRows) {
    const entry = entries.get(row.playerUuid);
    if (entry) {
      entry.kitTime.set(
        row.kitKey,
        (entry.kitTime.get(row.kitKey) ?? 0) + row.totalTimeTicks,
      );
    }
  }

  const normalizedSearch = search.trim().slice(0, 64).toLocaleLowerCase("fr-FR");
  const allEntries = [...entries.values()];
  const filteredEntries = normalizedSearch
    ? allEntries.filter((entry) =>
        [entry.minecraftName, entry.uuid, ...entry.aliases].some((value) =>
          value.toLocaleLowerCase("fr-FR").includes(normalizedSearch),
        ),
      )
    : allEntries;

  return {
    totalPlayers: allEntries.length,
    query: search.trim().slice(0, 64),
    players: filteredEntries
      .sort((left, right) =>
        left.minecraftName.localeCompare(right.minecraftName, "fr-FR"),
      )
      .map((entry) => ({
        uuid: entry.uuid,
        minecraftName: entry.minecraftName,
        aliases: [...entry.aliases],
        appearances: entry.appearances.size,
        latestEditionNumber: entry.latestEditionNumber,
        kills: entry.kills,
        bestRating: entry.bestRating,
        favoriteKitKey: getFavoriteKit(entry.kitTime),
      })),
  };
}

export async function queryPlayerProfile(
  database: SgpDatabase,
  playerUuid: string,
): Promise<PlayerProfile | null> {
  const normalizedUuid = playerUuid.toLocaleLowerCase("en-US");
  const [player] = await database
    .select({
      uuid: players.uuid,
      currentMinecraftName: players.currentMinecraftName,
    })
    .from(players)
    .where(eq(sql<string>`lower(${players.uuid})`, normalizedUuid))
    .limit(1);

  if (!player) return null;
  const storedUuid = player.uuid;

  const participationRows = await database
    .select({
      id: editions.id,
      number: editions.number,
      name: editions.name,
      startsAt: editions.startsAt,
      minecraftNameAtEvent: editionPlayers.minecraftNameAtEvent,
    })
    .from(editionPlayers)
    .innerJoin(editions, eq(editionPlayers.editionId, editions.id))
    .where(
      and(
        eq(editionPlayers.playerUuid, storedUuid),
        ne(editions.status, "draft"),
      ),
    )
    .orderBy(desc(editions.number));

  if (participationRows.length === 0) return null;

  const editionIds = participationRows.map((edition) => edition.id);
  const [ratingRows, allRatingRows, killRows, deathRows, damageDealtRows, damageReceivedRows, pickRows, abilityRows] =
    await Promise.all([
      database
        .select({
          editionId: playerRatings.editionId,
          rating: playerRatings.rating,
          ratedEncounters: playerRatings.ratedEncounters,
        })
        .from(playerRatings)
        .where(
          and(
            eq(playerRatings.playerUuid, storedUuid),
            inArray(playerRatings.editionId, editionIds),
          ),
        ),
      database
        .select({
          editionId: playerRatings.editionId,
          playerUuid: playerRatings.playerUuid,
          rating: playerRatings.rating,
        })
        .from(playerRatings)
        .where(inArray(playerRatings.editionId, editionIds)),
      database
        .select({ editionId: editionKills.editionId, value: editionKills.count })
        .from(editionKills)
        .where(
          and(
            eq(editionKills.killerUuid, storedUuid),
            inArray(editionKills.editionId, editionIds),
          ),
        ),
      database
        .select({ editionId: editionKills.editionId, value: editionKills.count })
        .from(editionKills)
        .where(
          and(
            eq(editionKills.victimUuid, storedUuid),
            inArray(editionKills.editionId, editionIds),
          ),
        ),
      database
        .select({
          editionId: editionDamageReceived.editionId,
          value: editionDamageReceived.amount,
        })
        .from(editionDamageReceived)
        .where(
          and(
            eq(editionDamageReceived.sourceUuid, storedUuid),
            ne(editionDamageReceived.sourceUuid, editionDamageReceived.targetUuid),
            inArray(editionDamageReceived.editionId, editionIds),
          ),
        ),
      database
        .select({
          editionId: editionDamageReceived.editionId,
          value: editionDamageReceived.amount,
        })
        .from(editionDamageReceived)
        .where(
          and(
            eq(editionDamageReceived.targetUuid, storedUuid),
            inArray(editionDamageReceived.editionId, editionIds),
          ),
        ),
      database
        .select({
          editionId: editionPicks.editionId,
          kitKey: kitSnapshots.kitKey,
          count: editionPicks.count,
          totalTimeTicks: editionPicks.totalTimeTicks,
        })
        .from(editionPicks)
        .leftJoin(
          kitSnapshots,
          and(
            eq(editionPicks.editionId, kitSnapshots.editionId),
            eq(editionPicks.kitId, kitSnapshots.kitId),
          ),
        )
        .where(
          and(
            eq(editionPicks.playerUuid, storedUuid),
            inArray(editionPicks.editionId, editionIds),
          ),
        ),
      database
        .select({
          editionId: editionAbilityMetrics.editionId,
          kitKey: kitSnapshots.kitKey,
          name: editionAbilityMetricDefinitions.name,
          description: editionAbilityMetricDefinitions.description,
          value: editionAbilityMetrics.value,
          displayScale: editionAbilityMetricDefinitions.displayScale,
          displayUnit: editionAbilityMetricDefinitions.displayUnit,
        })
        .from(editionAbilityMetrics)
        .innerJoin(
          editionAbilityMetricDefinitions,
          and(
            eq(editionAbilityMetrics.editionId, editionAbilityMetricDefinitions.editionId),
            eq(editionAbilityMetrics.kitId, editionAbilityMetricDefinitions.kitId),
            eq(editionAbilityMetrics.abilityPath, editionAbilityMetricDefinitions.abilityPath),
            eq(editionAbilityMetrics.metricId, editionAbilityMetricDefinitions.metricId),
          ),
        )
        .leftJoin(
          kitSnapshots,
          and(
            eq(editionAbilityMetrics.editionId, kitSnapshots.editionId),
            eq(editionAbilityMetrics.kitId, kitSnapshots.kitId),
          ),
        )
        .where(
          and(
            eq(editionAbilityMetrics.playerUuid, storedUuid),
            inArray(editionAbilityMetrics.editionId, editionIds),
          ),
        ),
    ]);

  const byEdition = new Map<number, WorkingPlayerEdition>(
    participationRows.map((edition) => [
      edition.id,
      {
        ...edition,
        rating: null,
        rank: null,
        ratedEncounters: 0,
        kills: 0,
        deaths: 0,
        damageDealt: 0,
        damageReceived: 0,
        picks: 0,
        totalTimeTicks: 0,
        favoriteKitKey: null,
        abilityMetrics: [],
        kitTime: new Map<string, number>(),
      },
    ]),
  );

  for (const row of ratingRows) {
    const edition = byEdition.get(row.editionId);
    if (edition) {
      edition.rating = row.rating;
      edition.ratedEncounters = row.ratedEncounters;
    }
  }
  addEditionValues(byEdition, killRows, "kills");
  addEditionValues(byEdition, deathRows, "deaths");
  addEditionValues(byEdition, damageDealtRows, "damageDealt");
  addEditionValues(byEdition, damageReceivedRows, "damageReceived");

  const lifetimeKitTime = new Map<string, number>();
  for (const row of pickRows) {
    const edition = byEdition.get(row.editionId);
    if (!edition) continue;
    edition.picks += row.count;
    edition.totalTimeTicks += row.totalTimeTicks;
    if (row.kitKey !== null) {
      edition.kitTime.set(
        row.kitKey,
        (edition.kitTime.get(row.kitKey) ?? 0) + row.totalTimeTicks,
      );
      lifetimeKitTime.set(
        row.kitKey,
        (lifetimeKitTime.get(row.kitKey) ?? 0) + row.totalTimeTicks,
      );
    }
  }
  for (const row of abilityRows) {
    byEdition.get(row.editionId)?.abilityMetrics.push({
      kitKey: row.kitKey,
      name: row.name,
      description: row.description,
      value: row.value * row.displayScale,
      displayUnit: row.displayUnit,
    });
  }

  const ratingsByEdition = new Map<number, typeof allRatingRows>();
  for (const row of allRatingRows) {
    const rows = ratingsByEdition.get(row.editionId) ?? [];
    rows.push(row);
    ratingsByEdition.set(row.editionId, rows);
  }
  for (const [editionId, rows] of ratingsByEdition) {
    rows.sort((left, right) => right.rating - left.rating);
    let previousRating: number | undefined;
    let previousRank = 0;
    rows.forEach((row, index) => {
      const rank = row.rating === previousRating ? previousRank : index + 1;
      previousRating = row.rating;
      previousRank = rank;
      if (row.playerUuid === storedUuid) {
        const edition = byEdition.get(editionId);
        if (edition) edition.rank = rank;
      }
    });
  }

  const editionStats = participationRows.map((row) => {
    const edition = byEdition.get(row.id)!;
    edition.favoriteKitKey = getFavoriteKit(edition.kitTime);
    edition.abilityMetrics.sort((left, right) =>
      left.name.localeCompare(right.name, "fr-FR"),
    );
    const { kitTime, ...publicEdition } = edition;
    void kitTime;
    return publicEdition;
  });
  const aliases = new Set(
    participationRows
      .map((edition) => edition.minecraftNameAtEvent)
      .filter((name) => name !== player.currentMinecraftName),
  );
  const ratings = editionStats.filter(
    (edition): edition is PlayerEditionStats & { rating: number } => edition.rating !== null,
  );
  const latestRatedEdition = ratings[0];

  return {
    uuid: player.uuid,
    currentMinecraftName: player.currentMinecraftName,
    aliases: [...aliases],
    firstEditionNumber: Math.min(...participationRows.map((edition) => edition.number)),
    latestEditionNumber: Math.max(...participationRows.map((edition) => edition.number)),
    lifetime: {
      appearances: editionStats.length,
      kills: sumEditionStat(editionStats, "kills"),
      deaths: sumEditionStat(editionStats, "deaths"),
      damageDealt: sumEditionStat(editionStats, "damageDealt"),
      damageReceived: sumEditionStat(editionStats, "damageReceived"),
      picks: sumEditionStat(editionStats, "picks"),
      totalTimeTicks: sumEditionStat(editionStats, "totalTimeTicks"),
      bestRating: ratings.length ? Math.max(...ratings.map((edition) => edition.rating)) : null,
      latestRating: latestRatedEdition?.rating ?? null,
      favoriteKitKey: getFavoriteKit(lifetimeKitTime),
    },
    editions: editionStats,
  };
}

async function queryPublicEditions(database: SgpDatabase): Promise<PublicEdition[]> {
  return database
    .select({
      id: editions.id,
      number: editions.number,
      name: editions.name,
      startsAt: editions.startsAt,
    })
    .from(editions)
    .where(ne(editions.status, "draft"))
    .orderBy(desc(editions.number));
}

async function queryParticipants(
  database: SgpDatabase,
  editionId?: number,
): Promise<Participant[]> {
  return database
    .select({
      playerUuid: editionPlayers.playerUuid,
      currentMinecraftName: players.currentMinecraftName,
      minecraftNameAtEvent: editionPlayers.minecraftNameAtEvent,
      editionId: editions.id,
      editionNumber: editions.number,
    })
    .from(editionPlayers)
    .innerJoin(editions, eq(editionPlayers.editionId, editions.id))
    .innerJoin(players, eq(editionPlayers.playerUuid, players.uuid))
    .where(publicScope(editionId))
    .orderBy(desc(editions.number), asc(editionPlayers.minecraftNameAtEvent));
}

function publicScope(editionId?: number) {
  return editionId === undefined
    ? ne(editions.status, "draft")
    : and(ne(editions.status, "draft"), eq(editions.id, editionId));
}

function getLeaderboardDetail(
  entry: WorkingLeaderboardEntry,
  metric: LeaderboardMetric,
  lifetime: boolean,
) {
  if (metric === "elo") {
    if (lifetime && entry.peakEditionNumber !== null) {
      return `Pic atteint à l’édition ${entry.peakEditionNumber}`;
    }
    return `${entry.auxiliaryValue} rencontre${entry.auxiliaryValue > 1 ? "s" : ""} cotée${entry.auxiliaryValue > 1 ? "s" : ""}`;
  }
  if (metric === "playtime") {
    return `${entry.auxiliaryValue} sélection${entry.auxiliaryValue > 1 ? "s" : ""}`;
  }
  if (!lifetime && entry.minecraftName !== entry.currentMinecraftName) {
    return `Aujourd’hui ${entry.currentMinecraftName}`;
  }
  if (lifetime) {
    return `${entry.appearances.size} édition${entry.appearances.size > 1 ? "s" : ""}`;
  }
  return "Participation enregistrée";
}

function getFavoriteKit(kitTime: Map<string, number>): string | null {
  let favorite: string | null = null;
  let favoriteTime = -1;
  for (const [kitKey, time] of kitTime) {
    if (time > favoriteTime || (time === favoriteTime && kitKey < (favorite ?? kitKey))) {
      favorite = kitKey;
      favoriteTime = time;
    }
  }
  return favorite;
}

function addEditionValues(
  editionsById: Map<number, WorkingPlayerEdition>,
  rows: Array<{ editionId: number; value: number }>,
  field: "kills" | "deaths" | "damageDealt" | "damageReceived",
) {
  for (const row of rows) {
    const edition = editionsById.get(row.editionId);
    if (edition) edition[field] += row.value;
  }
}

function sumEditionStat(
  editionStats: PlayerEditionStats[],
  field: "kills" | "deaths" | "damageDealt" | "damageReceived" | "picks" | "totalTimeTicks",
) {
  return editionStats.reduce((total, edition) => total + edition[field], 0);
}
