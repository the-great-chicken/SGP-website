CREATE TABLE `edition_ability_metric_definitions` (
	`edition_id` integer NOT NULL,
	`kit_id` integer NOT NULL,
	`ability_path` text NOT NULL,
	`metric_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`cooldown_ticks` integer,
	`duration_ticks` integer,
	`settings` text,
	`stored_unit` text NOT NULL,
	`display_unit` text NOT NULL,
	`display_scale` real NOT NULL,
	`source` text NOT NULL,
	PRIMARY KEY(`edition_id`, `kit_id`, `ability_path`, `metric_id`),
	FOREIGN KEY (`edition_id`) REFERENCES `editions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `edition_ability_metrics` (
	`edition_id` integer NOT NULL,
	`player_uuid` text NOT NULL,
	`kit_id` integer NOT NULL,
	`ability_path` text NOT NULL,
	`metric_id` text NOT NULL,
	`value` real NOT NULL,
	PRIMARY KEY(`edition_id`, `player_uuid`, `kit_id`, `ability_path`, `metric_id`),
	FOREIGN KEY (`edition_id`) REFERENCES `editions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_uuid`) REFERENCES `players`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `edition_ability_metrics_player_idx` ON `edition_ability_metrics` (`player_uuid`);--> statement-breakpoint
CREATE TABLE `edition_damage_causes` (
	`edition_id` integer NOT NULL,
	`cause_id` integer NOT NULL,
	`name` text NOT NULL,
	PRIMARY KEY(`edition_id`, `cause_id`),
	FOREIGN KEY (`edition_id`) REFERENCES `editions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `edition_damage_received` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`edition_id` integer NOT NULL,
	`target_uuid` text NOT NULL,
	`target_kit_id` integer NOT NULL,
	`source_uuid` text,
	`source_kit_id` integer NOT NULL,
	`cause_id` integer NOT NULL,
	`amount` real NOT NULL,
	FOREIGN KEY (`edition_id`) REFERENCES `editions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_uuid`) REFERENCES `players`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_uuid`) REFERENCES `players`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `edition_damage_edition_idx` ON `edition_damage_received` (`edition_id`);--> statement-breakpoint
CREATE INDEX `edition_damage_target_idx` ON `edition_damage_received` (`target_uuid`);--> statement-breakpoint
CREATE INDEX `edition_damage_source_idx` ON `edition_damage_received` (`source_uuid`);--> statement-breakpoint
CREATE TABLE `edition_death_positions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`edition_id` integer NOT NULL,
	`dimension` text NOT NULL,
	`x` real NOT NULL,
	`y` real NOT NULL,
	`z` real NOT NULL,
	`deaths` integer NOT NULL,
	FOREIGN KEY (`edition_id`) REFERENCES `editions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `edition_death_positions_edition_idx` ON `edition_death_positions` (`edition_id`,`dimension`);--> statement-breakpoint
CREATE TABLE `edition_kills` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`edition_id` integer NOT NULL,
	`killer_uuid` text,
	`killer_kit_id` integer NOT NULL,
	`victim_uuid` text,
	`victim_kit_id` integer NOT NULL,
	`cause_id` integer NOT NULL,
	`count` integer NOT NULL,
	FOREIGN KEY (`edition_id`) REFERENCES `editions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`killer_uuid`) REFERENCES `players`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`victim_uuid`) REFERENCES `players`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `edition_kills_edition_idx` ON `edition_kills` (`edition_id`);--> statement-breakpoint
CREATE INDEX `edition_kills_killer_idx` ON `edition_kills` (`killer_uuid`);--> statement-breakpoint
CREATE INDEX `edition_kills_victim_idx` ON `edition_kills` (`victim_uuid`);--> statement-breakpoint
CREATE TABLE `edition_picks` (
	`edition_id` integer NOT NULL,
	`player_uuid` text NOT NULL,
	`kit_id` integer NOT NULL,
	`total_time_ticks` integer NOT NULL,
	`count` integer NOT NULL,
	PRIMARY KEY(`edition_id`, `player_uuid`, `kit_id`),
	FOREIGN KEY (`edition_id`) REFERENCES `editions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_uuid`) REFERENCES `players`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `edition_picks_player_idx` ON `edition_picks` (`player_uuid`);--> statement-breakpoint
CREATE TABLE `edition_statistics_metadata` (
	`edition_id` integer PRIMARY KEY NOT NULL,
	`death_position_metadata` text NOT NULL,
	`elo` text NOT NULL,
	FOREIGN KEY (`edition_id`) REFERENCES `editions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `player_ratings` ADD `rated_encounters` integer DEFAULT 0 NOT NULL;
