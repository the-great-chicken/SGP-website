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
    minecraftNameAtEvent: text("minecraft_name_at_event").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.editionId, table.playerUuid] }),
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
    manifestSchemaVersion: integer("manifest_schema_version").notNull(),
    manifest: text("manifest", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(now),
  },
  (table) => [
    primaryKey({ columns: [table.editionId, table.kitKey] }),
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
  },
  (table) => [
    primaryKey({ columns: [table.editionId, table.playerUuid] }),
    index("player_ratings_edition_rating_idx").on(table.editionId, table.rating),
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

