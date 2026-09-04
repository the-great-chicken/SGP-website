import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const now = sql`(unixepoch() * 1000)`;

export const editions = sqliteTable(
  "editions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    number: integer("number").notNull(),
    name: text("name"),
    status: text("status", { enum: ["draft", "published", "archived"] })
      .notNull()
      .default("draft"),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
    minecraftVersion: text("minecraft_version").notNull(),
    datapackVersion: text("datapack_version"),
    resourcePackVersion: text("resource_pack_version"),
    statisticsSchemaVersion: integer("statistics_schema_version"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(now),
  },
  (table) => [
    uniqueIndex("editions_number_unique").on(table.number),
    index("editions_status_idx").on(table.status),
  ],
);

export const players = sqliteTable(
  "players",
  {
    uuid: text("uuid").primaryKey(),
    currentMinecraftName: text("current_minecraft_name").notNull(),
    discordId: text("discord_id"),
    discordUsername: text("discord_username"),
    discordDisplayName: text("discord_display_name"),
    discordAvatarUrl: text("discord_avatar_url"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(now),
  },
  (table) => [
    uniqueIndex("players_discord_id_unique").on(table.discordId),
    index("players_minecraft_name_idx").on(table.currentMinecraftName),
  ],
);

export const editionPlayers = sqliteTable(
  "edition_players",
  {
    editionId: integer("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "cascade" }),
    playerUuid: text("player_uuid")
      .notNull()
      .references(() => players.uuid, { onDelete: "cascade" }),
    sgpId: integer("sgp_id").notNull(),
    minecraftNameAtEvent: text("minecraft_name_at_event").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.editionId, table.playerUuid] }),
    uniqueIndex("edition_players_sgp_id_unique").on(table.editionId, table.sgpId),
    index("edition_players_player_idx").on(table.playerUuid),
  ],
);

export const kitSnapshots = sqliteTable(
  "kit_snapshots",
  {
    editionId: integer("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "cascade" }),
    kitKey: text("kit_key").notNull(),
    kitId: integer("kit_id"),
    manifestSchemaVersion: integer("manifest_schema_version").notNull(),
    manifest: text("manifest", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(now),
  },
  (table) => [
    primaryKey({ columns: [table.editionId, table.kitKey] }),
    uniqueIndex("kit_snapshots_edition_kit_id_unique").on(
      table.editionId,
      table.kitId,
    ),
    index("kit_snapshots_kit_idx").on(table.kitKey),
  ],
);

export const playerRatings = sqliteTable(
  "player_ratings",
  {
    editionId: integer("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "cascade" }),
    playerUuid: text("player_uuid")
      .notNull()
      .references(() => players.uuid, { onDelete: "cascade" }),
    rating: real("rating").notNull(),
    ratedEncounters: integer("rated_encounters").notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.editionId, table.playerUuid] }),
    index("player_ratings_edition_rating_idx").on(table.editionId, table.rating),
  ],
);

export const editionStatisticsMetadata = sqliteTable("edition_statistics_metadata", {
  editionId: integer("edition_id")
    .primaryKey()
    .references(() => editions.id, { onDelete: "cascade" }),
  deathPositionMetadata: text("death_position_metadata", { mode: "json" })
    .$type<Record<string, unknown>>()
    .notNull(),
  elo: text("elo", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
});

export const editionDamageCauses = sqliteTable(
  "edition_damage_causes",
  {
    editionId: integer("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "cascade" }),
    causeId: integer("cause_id").notNull(),
    name: text("name").notNull(),
  },
  (table) => [primaryKey({ columns: [table.editionId, table.causeId] })],
);

export const editionKills = sqliteTable(
  "edition_kills",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    editionId: integer("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "cascade" }),
    killerUuid: text("killer_uuid").references(() => players.uuid, {
      onDelete: "cascade",
    }),
    killerKitId: integer("killer_kit_id").notNull(),
    victimUuid: text("victim_uuid").references(() => players.uuid, {
      onDelete: "cascade",
    }),
    victimKitId: integer("victim_kit_id").notNull(),
    causeId: integer("cause_id").notNull(),
    count: integer("count").notNull(),
  },
  (table) => [
    index("edition_kills_edition_idx").on(table.editionId),
    index("edition_kills_killer_idx").on(table.killerUuid),
    index("edition_kills_victim_idx").on(table.victimUuid),
  ],
);

export const editionDamageReceived = sqliteTable(
  "edition_damage_received",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    editionId: integer("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "cascade" }),
    targetUuid: text("target_uuid")
      .notNull()
      .references(() => players.uuid, { onDelete: "cascade" }),
    targetKitId: integer("target_kit_id").notNull(),
    sourceUuid: text("source_uuid").references(() => players.uuid, {
      onDelete: "cascade",
    }),
    sourceKitId: integer("source_kit_id").notNull(),
    causeId: integer("cause_id").notNull(),
    amount: real("amount").notNull(),
  },
  (table) => [
    index("edition_damage_edition_idx").on(table.editionId),
    index("edition_damage_target_idx").on(table.targetUuid),
    index("edition_damage_source_idx").on(table.sourceUuid),
  ],
);

export const editionPicks = sqliteTable(
  "edition_picks",
  {
    editionId: integer("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "cascade" }),
    playerUuid: text("player_uuid")
      .notNull()
      .references(() => players.uuid, { onDelete: "cascade" }),
    kitId: integer("kit_id").notNull(),
    totalTimeTicks: integer("total_time_ticks").notNull(),
    count: integer("count").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.editionId, table.playerUuid, table.kitId] }),
    index("edition_picks_player_idx").on(table.playerUuid),
  ],
);

export const editionAbilityMetricDefinitions = sqliteTable(
  "edition_ability_metric_definitions",
  {
    editionId: integer("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "cascade" }),
    kitId: integer("kit_id").notNull(),
    abilityPath: text("ability_path").notNull(),
    metricId: text("metric_id").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    cooldownTicks: integer("cooldown_ticks"),
    durationTicks: integer("duration_ticks"),
    settings: text("settings", { mode: "json" }).$type<Record<string, unknown> | null>(),
    storedUnit: text("stored_unit").notNull(),
    displayUnit: text("display_unit").notNull(),
    displayScale: real("display_scale").notNull(),
    source: text("source", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.editionId, table.kitId, table.abilityPath, table.metricId],
    }),
  ],
);

export const editionAbilityMetrics = sqliteTable(
  "edition_ability_metrics",
  {
    editionId: integer("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "cascade" }),
    playerUuid: text("player_uuid")
      .notNull()
      .references(() => players.uuid, { onDelete: "cascade" }),
    kitId: integer("kit_id").notNull(),
    abilityPath: text("ability_path").notNull(),
    metricId: text("metric_id").notNull(),
    value: real("value").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [
        table.editionId,
        table.playerUuid,
        table.kitId,
        table.abilityPath,
        table.metricId,
      ],
    }),
    index("edition_ability_metrics_player_idx").on(table.playerUuid),
  ],
);

export const editionDeathPositions = sqliteTable(
  "edition_death_positions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    editionId: integer("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "cascade" }),
    dimension: text("dimension").notNull(),
    x: real("x").notNull(),
    y: real("y").notNull(),
    z: real("z").notNull(),
    deaths: integer("deaths").notNull(),
  },
  (table) => [
    index("edition_death_positions_edition_idx").on(
      table.editionId,
      table.dimension,
    ),
  ],
);

export const cosmetics = sqliteTable(
  "cosmetics",
  {
    id: text("id").primaryKey(),
    category: text("category").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    icon: text("icon"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("cosmetics_category_sort_idx").on(table.category, table.sortOrder)],
);

export const playerCosmeticUnlocks = sqliteTable(
  "player_cosmetic_unlocks",
  {
    playerUuid: text("player_uuid")
      .notNull()
      .references(() => players.uuid, { onDelete: "cascade" }),
    cosmeticId: text("cosmetic_id")
      .notNull()
      .references(() => cosmetics.id, { onDelete: "cascade" }),
    unlockedAt: integer("unlocked_at", { mode: "timestamp_ms" }),
    source: text("source"),
  },
  (table) => [primaryKey({ columns: [table.playerUuid, table.cosmeticId] })],
);

export const playerEquipment = sqliteTable(
  "player_equipment",
  {
    playerUuid: text("player_uuid")
      .notNull()
      .references(() => players.uuid, { onDelete: "cascade" }),
    category: text("category").notNull(),
    cosmeticId: text("cosmetic_id")
      .notNull()
      .references(() => cosmetics.id, { onDelete: "cascade" }),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(now),
  },
  (table) => [
    primaryKey({ columns: [table.playerUuid, table.category] }),
    index("player_equipment_cosmetic_idx").on(table.cosmeticId),
  ],
);
