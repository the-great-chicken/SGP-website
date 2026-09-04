CREATE TABLE `cosmetics` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`icon` text,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `cosmetics_category_sort_idx` ON `cosmetics` (`category`,`sort_order`);--> statement-breakpoint
CREATE TABLE `edition_players` (
	`edition_id` integer NOT NULL,
	`player_uuid` text NOT NULL,
	`minecraft_name_at_event` text NOT NULL,
	PRIMARY KEY(`edition_id`, `player_uuid`),
	FOREIGN KEY (`edition_id`) REFERENCES `editions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_uuid`) REFERENCES `players`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `edition_players_player_idx` ON `edition_players` (`player_uuid`);--> statement-breakpoint
CREATE TABLE `editions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`number` integer NOT NULL,
	`name` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`starts_at` integer,
	`ends_at` integer,
	`published_at` integer,
	`minecraft_version` text NOT NULL,
	`datapack_version` text,
	`resource_pack_version` text,
	`statistics_schema_version` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `editions_number_unique` ON `editions` (`number`);--> statement-breakpoint
CREATE INDEX `editions_status_idx` ON `editions` (`status`);--> statement-breakpoint
CREATE TABLE `kit_snapshots` (
	`edition_id` integer NOT NULL,
	`kit_key` text NOT NULL,
	`manifest_schema_version` integer NOT NULL,
	`manifest` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`edition_id`, `kit_key`),
	FOREIGN KEY (`edition_id`) REFERENCES `editions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `kit_snapshots_kit_idx` ON `kit_snapshots` (`kit_key`);--> statement-breakpoint
CREATE TABLE `player_cosmetic_unlocks` (
	`player_uuid` text NOT NULL,
	`cosmetic_id` text NOT NULL,
	`unlocked_at` integer,
	`source` text,
	PRIMARY KEY(`player_uuid`, `cosmetic_id`),
	FOREIGN KEY (`player_uuid`) REFERENCES `players`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cosmetic_id`) REFERENCES `cosmetics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `player_equipment` (
	`player_uuid` text NOT NULL,
	`category` text NOT NULL,
	`cosmetic_id` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`player_uuid`, `category`),
	FOREIGN KEY (`player_uuid`) REFERENCES `players`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cosmetic_id`) REFERENCES `cosmetics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `player_equipment_cosmetic_idx` ON `player_equipment` (`cosmetic_id`);--> statement-breakpoint
CREATE TABLE `player_ratings` (
	`edition_id` integer NOT NULL,
	`player_uuid` text NOT NULL,
	`rating` real NOT NULL,
	PRIMARY KEY(`edition_id`, `player_uuid`),
	FOREIGN KEY (`edition_id`) REFERENCES `editions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_uuid`) REFERENCES `players`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `player_ratings_edition_rating_idx` ON `player_ratings` (`edition_id`,`rating`);--> statement-breakpoint
CREATE TABLE `players` (
	`uuid` text PRIMARY KEY NOT NULL,
	`current_minecraft_name` text NOT NULL,
	`discord_id` text,
	`discord_username` text,
	`discord_display_name` text,
	`discord_avatar_url` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `players_discord_id_unique` ON `players` (`discord_id`);--> statement-breakpoint
CREATE INDEX `players_minecraft_name_idx` ON `players` (`current_minecraft_name`);