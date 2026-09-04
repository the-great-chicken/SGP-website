ALTER TABLE `kit_snapshots` ADD `kit_id` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `kit_snapshots_edition_kit_id_unique` ON `kit_snapshots` (`edition_id`,`kit_id`);