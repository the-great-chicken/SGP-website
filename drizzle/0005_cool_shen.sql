CREATE TABLE `player_cosmetic_sync` (
	`player_uuid` text PRIMARY KEY NOT NULL,
	`observed_at` integer NOT NULL,
	`issues` text NOT NULL,
	FOREIGN KEY (`player_uuid`) REFERENCES `players`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `cosmetics` ADD `active` integer DEFAULT false NOT NULL;