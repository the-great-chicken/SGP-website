ALTER TABLE `edition_players` ADD `sgp_id` integer NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `edition_players_sgp_id_unique` ON `edition_players` (`edition_id`,`sgp_id`);